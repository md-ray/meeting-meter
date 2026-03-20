// MeetingMeter — Device Code Auth Flow
// Same mechanism as Microsoft Graph CLI Tools — no Azure app registration needed
(function () {
  const CLIENT_ID = '14d82eec-204b-4c2f-b7e8-296a70dab67e';
  const SCOPES = 'Calendars.Read User.Read offline_access';
  const TOKEN_KEY = 'mm_token';
  const POLL_INTERVAL = 3000; // poll every 3 seconds

  // Use local proxy to bypass CORS on Microsoft endpoints
  const API_BASE = window.location.origin + '/api';

  // Start device code flow
  async function startDeviceCodeFlow() {
    const resp = await fetch(`${API_BASE}/devicecode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `client_id=${CLIENT_ID}&scope=${encodeURIComponent(SCOPES)}`,
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error_description || `Device code request failed: ${resp.status}`);
    }

    return await resp.json();
    // Returns: { device_code, user_code, verification_uri, expires_in, interval, message }
  }

  // Poll for token after user completes login
  async function pollForToken(deviceCode, expiresIn) {
    const deadline = Date.now() + expiresIn * 1000;

    return new Promise((resolve, reject) => {
      const timer = setInterval(async () => {
        if (Date.now() > deadline) {
          clearInterval(timer);
          reject(new Error('Device code expired. Please try again.'));
          return;
        }

        try {
          const resp = await fetch(`${API_BASE}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn:ietf:params:oauth:grant-type:device_code&client_id=${CLIENT_ID}&device_code=${encodeURIComponent(deviceCode)}`,
          });

          const data = await resp.json();

          if (data.error === 'authorization_pending') {
            // User hasn't completed login yet — keep polling
            return;
          }

          if (data.error === 'slow_down') {
            // Back off (handled by interval already)
            return;
          }

          if (data.error) {
            clearInterval(timer);
            reject(new Error(data.error_description || data.error));
            return;
          }

          // Success!
          clearInterval(timer);
          const tokenData = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: Date.now() + data.expires_in * 1000,
            scope: data.scope,
          };
          localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
          resolve(tokenData);
        } catch (err) {
          // Network error — keep trying
          console.warn('Poll error:', err);
        }
      }, POLL_INTERVAL);
    });
  }

  // Refresh token silently
  async function refreshToken() {
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (!stored || !stored.refresh_token) throw new Error('No refresh token');

    const resp = await fetch(`${API_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&client_id=${CLIENT_ID}&refresh_token=${encodeURIComponent(stored.refresh_token)}&scope=${encodeURIComponent(SCOPES)}`,
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error_description || data.error);

    const tokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || stored.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      scope: data.scope,
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokenData));
    return tokenData;
  }

  // Get valid access token (auto-refresh if expired)
  async function getToken() {
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (!stored) throw new Error('Not logged in');

    // Refresh if expiring within 5 minutes
    if (stored.expires_at - Date.now() < 5 * 60 * 1000) {
      const refreshed = await refreshToken();
      return refreshed.access_token;
    }

    return stored.access_token;
  }

  function isLoggedIn() {
    const stored = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    return !!(stored && stored.access_token);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('mm_events');
  }

  // Full login flow — returns { userCode, verificationUri, promise }
  // Caller shows the code to user, promise resolves when auth completes
  async function login() {
    const deviceResp = await startDeviceCodeFlow();
    const tokenPromise = pollForToken(deviceResp.device_code, deviceResp.expires_in);

    return {
      userCode: deviceResp.user_code,
      verificationUri: deviceResp.verification_uri,
      message: deviceResp.message,
      tokenPromise: tokenPromise,
    };
  }

  window.MeetingMeterAuth = { login, logout, getToken, isLoggedIn, refreshToken };
})();
