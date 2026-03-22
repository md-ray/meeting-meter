// Cloudflare Pages Advanced Mode — handles /api/* routes, passes static to Pages
const MS_AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const ALLOWED_HOSTS = ['outlook.office365.com', 'outlook.live.com', 'calendar.google.com', 'calendar.yahoo.com'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return new Response(null, { status: 204, headers: CORS });
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
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

async function fetchICS(request) {
  let url;
  try {
    const payload = await request.json();
    url = payload.url;
  } catch {
    return jsonError('Invalid JSON', 400);
  }
  if (!url) return jsonError('Missing URL', 400);

  const lower = url.toLowerCase();
  const isAllowed = ALLOWED_HOSTS.some(h => lower.includes(h)) || lower.endsWith('.ics');
  if (!isAllowed) return jsonError('URL must be an ICS calendar link', 400);

  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'MeetingMeter/1.0' } });
    if (!resp.ok) return jsonError(`Upstream returned ${resp.status}`, 502);

    const data = await resp.text();
    if (!data.trimStart().startsWith('BEGIN:VCALENDAR')) {
      return jsonError('Not a valid ICS file', 400);
    }
    return new Response(data, {
      status: 200,
      headers: { 'Content-Type': 'text/calendar', ...CORS },
    });
  } catch (e) {
    return jsonError(e.message, 502);
  }
}

function jsonError(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
