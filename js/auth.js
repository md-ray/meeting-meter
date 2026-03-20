// MeetingMeter — MSAL PKCE Auth (pure client-side, no backend)
(function () {
  const CLIENT_ID = 'f9aeefd6-71ae-4107-a456-cfce05aef6ae';
  const AUTHORITY = 'https://login.microsoftonline.com/common';
  const SCOPES = ['Calendars.Read', 'User.Read'];
  const TOKEN_KEY = 'mm_token';

  let msalInstance = null;

  function ensureMsal() {
    if (!msalInstance) {
      msalInstance = new msal.PublicClientApplication({
        auth: {
          clientId: CLIENT_ID,
          authority: AUTHORITY,
          redirectUri: window.location.origin + '/',
        },
        cache: {
          cacheLocation: 'localStorage',
          storeAuthStateInCookie: false,
        },
      });
    }
    return msalInstance;
  }

  async function login() {
    const client = ensureMsal();
    try {
      const resp = await client.loginPopup({ scopes: SCOPES });
      if (resp && resp.account) {
        client.setActiveAccount(resp.account);
      }
      return resp;
    } catch (err) {
      console.error('Login failed:', err);
      throw err;
    }
  }

  async function getToken() {
    const client = ensureMsal();
    const account = client.getActiveAccount() || (client.getAllAccounts()[0] ?? null);
    if (!account) throw new Error('Not logged in');

    try {
      const resp = await client.acquireTokenSilent({ scopes: SCOPES, account });
      return resp.accessToken;
    } catch (err) {
      // Silent failed — try popup
      const resp = await client.acquireTokenPopup({ scopes: SCOPES });
      return resp.accessToken;
    }
  }

  function isLoggedIn() {
    const client = ensureMsal();
    return client.getAllAccounts().length > 0;
  }

  function logout() {
    const client = ensureMsal();
    client.logoutPopup();
    localStorage.removeItem('mm_events');
  }

  window.MeetingMeterAuth = { login, logout, getToken, isLoggedIn, ensureMsal };
})();
