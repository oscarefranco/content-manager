// ══════════════════════════════════════════════════════════════════════════
// GITHUB OAUTH SSO
// ══════════════════════════════════════════════════════════════════════════

const OAUTH_CLIENT_ID = 'Ov23liqIsK38zHrDUlDj';
const OAUTH_PROXY_URL = 'https://github-oauth-proxy.oscarfranco.workers.dev';
const OAUTH_REDIRECT_URI = 'https://oscarefranco.github.io/content-manager/team.html';
const OAUTH_SCOPES = 'repo read:user';

function initiateGitHubLogin() {
  const state = crypto.randomUUID();
  localStorage.setItem('oauth_state', state);
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(OAUTH_REDIRECT_URI)}&scope=${encodeURIComponent(OAUTH_SCOPES)}&state=${state}`;
  window.location.href = authUrl;
}

async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  if (!code) return false;

  // Validate state to prevent CSRF
  const savedState = localStorage.getItem('oauth_state');
  if (returnedState !== savedState) {
    console.error('OAuth state mismatch');
    toast('GitHub sign-in failed: state mismatch', 'warning');
    window.history.replaceState({}, '', window.location.pathname);
    return false;
  }
  localStorage.removeItem('oauth_state');

  // Clean URL immediately
  window.history.replaceState({}, '', window.location.pathname);

  try {
    const resp = await fetch(OAUTH_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await resp.json();
    if (data.access_token) {
      localStorage.setItem('gh_models_token', data.access_token);
      localStorage.setItem('gh_auth_method', 'oauth');
      toast('✓ Signed in with GitHub successfully!', 'success');
      return true;
    } else {
      toast(`GitHub sign-in failed: ${data.error_description || data.error || 'Unknown error'}`, 'warning');
      return false;
    }
  } catch (e) {
    toast(`GitHub sign-in failed: ${e.message}`, 'warning');
    return false;
  }
}

function logoutGitHub() {
  localStorage.removeItem('gh_models_token');
  localStorage.removeItem('gh_auth_method');
  updateAuthBadge();
  toast('Signed out', 'info');
  location.reload();
}

