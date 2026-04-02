// MeetingMeter Cloudflare Worker — API proxy + static assets
const MS_AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';

// Strict hostname allowlist for ICS fetch (checked against parsed URL hostname)
const ALLOWED_ICS_HOSTS = [
  'outlook.office365.com',
  'outlook.live.com',
  'calendar.google.com',
  'calendar.yahoo.com',
];

// Private/internal IP ranges to block (anti-SSRF)
const PRIVATE_IP_PATTERNS = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^fc00:/i, /^fe80:/i, /^::1$/, /^localhost$/i,
];

const ALLOWED_ORIGIN = 'https://meeting.mdray.id';

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  // Allow same origin + local dev
  const allowed = origin === ALLOWED_ORIGIN
    || origin.endsWith('.saviourcat.workers.dev')
    || origin.startsWith('http://localhost:')
    || origin.startsWith('http://127.0.0.1:');

  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // API routes
    if (request.method === 'POST') {
      if (url.pathname === '/api/devicecode') {
        return proxyMS(request, `${MS_AUTHORITY}/devicecode`);
      }
      if (url.pathname === '/api/token') {
        return proxyMS(request, `${MS_AUTHORITY}/token`);
      }
      if (url.pathname === '/api/fetch-ics') {
        return fetchICS(request);
      }
    }

    // Everything else → static files
    return env.ASSETS.fetch(request);
  },
};

async function proxyMS(request, targetUrl) {
  const body = await request.text();
  const resp = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

async function fetchICS(request) {
  let targetUrl;
  try {
    const payload = await request.json();
    targetUrl = payload.url;
  } catch {
    return jsonError('Invalid JSON', 400, request);
  }
  if (!targetUrl || typeof targetUrl !== 'string') {
    return jsonError('Missing URL', 400, request);
  }

  // Parse and validate URL
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return jsonError('Invalid URL format', 400, request);
  }

  // Must be HTTPS
  if (parsed.protocol !== 'https:') {
    return jsonError('Only HTTPS URLs are allowed', 400, request);
  }

  // Block private/internal IPs (anti-SSRF)
  const hostname = parsed.hostname;
  if (PRIVATE_IP_PATTERNS.some(p => p.test(hostname))) {
    return jsonError('Internal addresses are not allowed', 403, request);
  }

  // Strict hostname allowlist — must exactly match
  if (!ALLOWED_ICS_HOSTS.includes(hostname.toLowerCase())) {
    return jsonError(
      'URL must be from a supported calendar provider (Outlook, Google Calendar, Yahoo Calendar)',
      400,
      request,
    );
  }

  // Max response size: 10MB (prevent abuse)
  try {
    const resp = await fetch(targetUrl, {
      headers: { 'User-Agent': 'MeetingMeter/1.0' },
      redirect: 'follow',
    });
    if (!resp.ok) return jsonError(`Upstream returned ${resp.status}`, 502, request);

    const contentLength = parseInt(resp.headers.get('content-length') || '0');
    if (contentLength > 10 * 1024 * 1024) {
      return jsonError('Calendar file too large (max 10MB)', 413, request);
    }

    const data = await resp.text();
    if (data.length > 10 * 1024 * 1024) {
      return jsonError('Calendar file too large (max 10MB)', 413, request);
    }

    if (!data.trimStart().startsWith('BEGIN:VCALENDAR')) {
      return jsonError('Not a valid ICS file', 400, request);
    }

    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'text/calendar', ...corsHeaders(request) },
    });
  } catch (e) {
    return jsonError('Failed to fetch calendar', 502, request);
  }
}

function jsonError(msg, status, request) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}
