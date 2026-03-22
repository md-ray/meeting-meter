// MeetingMeter — Device Code Flow Auth (uses Microsoft public client ID, no app registration needed)
(function () {
  const CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e'; // Microsoft Graph CLI (pre-approved in all tenants)
  const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
  const SCOPES = 'Calendars.Read User.Read offline_access';
  const TOKEN_KEY = 'mm_token';

  // Proxy endpoints (relative — works with server.py or Cloudflare Worker)
  const DEVICECODE_URL = '/api/devicecode';
  const TOKEN_URL = '/api/token';

  async function startDeviceCodeFlow() {
    const resp = await fetch(DEVICECODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}`,
    });
    if (!resp.ok) throw new Error('Failed to get device code: ' + resp.status);
    return resp.json();
  }

  async function pollForToken(deviceCode, interval = 5, expiresIn = 900) {
    const deadline = Date.now() + expiresIn * 1000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, interval * 1000));
      try {
        const resp = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `client_id=${CLIENT_ID}&device_code=${encodeURIComponent(deviceCode)}&grant_type=urn:ietf:params:oauth:grant-type:device_code`,
        });
        const data = await resp.json();
        if (data.access_token) {
          saveToken(data);
          return data;
        }
        if (data.error === 'authorization_pending') continue;
        if (data.error === 'slow_down') { interval += 5; continue; }
        throw new Error(data.error_description || data.error || 'Token polling failed');
      } catch (err) {
        if (err.message.includes('authorization_pending')) continue;
        throw err;
      }
    }
    throw new Error('Device code expired. Please try again.');
  }

  function saveToken(tokenData) {
    const stored = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
  }

  async function getToken() {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) throw new Error('Not logged in');
    const stored = JSON.parse(raw);

    // If token still valid, return it
    if (stored.access_token && stored.expires_at > Date.now() + 60000) {
      return stored.access_token;
    }

    // Try refresh
    if (stored.refresh_token) {
      const resp = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `client_id=${CLIENT_ID}&refresh_token=${encodeURIComponent(stored.refresh_token)}&grant_type=refresh_token&scope=${encodeURIComponent(SCOPES)}`,
      });
      const data = await resp.json();
      if (data.access_token) {
        saveToken(data);
        return data.access_token;
      }
    }

    throw new Error('Token expired. Please reconnect.');
  }

  function isLoggedIn() {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return false;
    try {
      const stored = JSON.parse(raw);
      return !!(stored.access_token && stored.expires_at > Date.now());
    } catch (_) { return false; }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('mm_events');
  }

  window.MeetingMeterAuth = {
    startDeviceCodeFlow,
    pollForToken,
    getToken,
    isLoggedIn,
    logout,
  };
})();
