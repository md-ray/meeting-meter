// Cloudflare Pages Function — proxy /api/fetch-ics to fetch published calendar URLs
const ALLOWED_HOSTS = ['outlook.office365.com', 'outlook.live.com', 'calendar.google.com', 'calendar.yahoo.com'];

export async function onRequestPost(context) {
  let url;
  try {
    const payload = await context.request.json();
    url = payload.url;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing URL' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Validate URL against allowlist
  const lower = url.toLowerCase();
  const isAllowed = ALLOWED_HOSTS.some(h => lower.includes(h)) || lower.endsWith('.ics');
  if (!isAllowed) {
    return new Response(JSON.stringify({ error: 'URL must be an ICS calendar link' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'MeetingMeter/1.0' },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `Upstream returned ${resp.status}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await resp.text();
    if (!data.trimStart().startsWith('BEGIN:VCALENDAR')) {
      return new Response(JSON.stringify({ error: 'Not a valid ICS file' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
