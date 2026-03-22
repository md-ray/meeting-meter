// Cloudflare Pages Function — proxy /api/token to Microsoft
const MS_AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';

export async function onRequestPost(context) {
  const body = await context.request.text();

  const resp = await fetch(`${MS_AUTHORITY}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
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
