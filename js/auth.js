// MeetingMeter — MSAL PKCE Auth
(function () {
  const msalConfig = {
    auth: {
      clientId: '14d82eec-204b-4c2f-b7e8-296a70dab67e',
      authority: 'https://login.microsoftonline.com/common',
      redirectUri: window.location.origin + '/meetingmeter/',
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false,
    },
  };

  const loginScopes = { scopes: ['Calendars.Read', 'User.Read'] };
  let msalInstance = null;

  function ensureMsal() {
    if (!msalInstance) {
      msalInstance = new msal.PublicClientApplication(msalConfig);
    }
    return msalInstance;
  }

  async function login() {
    const client = ensureMsal();
    try {
      const resp = await client.loginPopup(loginScopes);
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
    if (!account) throw new Error('No account found. Please log in.');
    try {
      const resp = await client.acquireTokenSilent({ ...loginScopes, account });
      return resp.accessToken;
    } catch (err) {
      // fallback to popup
      const resp = await client.acquireTokenPopup(loginScopes);
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
  }

  // expose globally
  window.MeetingMeterAuth = { login, logout, getToken, isLoggedIn, ensureMsal };
})();
