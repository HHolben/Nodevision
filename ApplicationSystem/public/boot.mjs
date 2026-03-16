const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginButton = loginForm?.querySelector('button[type="submit"]');

let appStarted = false;

function applyStoredTheme() {
  try {
    const stored = localStorage.getItem('nodevision_theme');
    if (stored === 'dark' || stored === 'light') {
      document.documentElement.dataset.nvTheme = stored;
      document.documentElement.style.colorScheme = stored;
    }
  } catch {
    // ignore
  }
}

function setUiState({ showAppView = false } = {}) {
  if (showAppView) {
    loginScreen?.classList.add('hidden');
    appShell?.classList.remove('hidden');
  } else {
    loginScreen?.classList.remove('hidden');
    appShell?.classList.add('hidden');
  }
}

async function fetchSession() {
  try {
    const response = await fetch('/api/session', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      console.debug('Session endpoint responded with', response.status);
      return null;
    }

    const payload = await response.json();
    return payload.loggedIn ? payload : null;
  } catch (err) {
    console.error('Failed to read session', err);
    return null;
  }
}

async function startApp() {
  if (appStarted) {
    return;
  }
  appStarted = true;
  try {
    await import('./main.mjs');
  } catch (err) {
    console.error('Unable to start Nodevision', err);
    loginError.textContent = 'Failed to start the workspace.';
    appStarted = false;
  }
}

function updateLoginError(message) {
  if (loginError) {
    loginError.textContent = message;
  }
}

async function attemptLogin(credentials) {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (response.ok) {
    return response.json();
  }

  const payload = await response
    .json()
    .catch(() => ({ error: 'Unable to authenticate' }));
  throw new Error(payload?.error ?? 'Unable to authenticate');
}

async function handleLogin(event) {
  event.preventDefault();
  updateLoginError('');

  const formData = new FormData(loginForm);
  const username = formData.get('username')?.toString().trim() ?? '';
  const password = formData.get('password')?.toString() ?? '';

  if (!username || !password) {
    updateLoginError('Both username and password are required.');
    return;
  }

  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in…';
  }

  try {
    await attemptLogin({ username, password });
    setUiState({ showAppView: true });
    await startApp();
  } catch (err) {
    updateLoginError(err?.message ?? 'Login failed.');
    setUiState({ showAppView: false });
  } finally {
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = 'Log in';
    }
  }
}

async function init() {
  applyStoredTheme();
  loginForm?.addEventListener('submit', handleLogin);

  try {
    const session = await fetchSession();
    if (session) {
      setUiState({ showAppView: true });
      await startApp();
    } else {
      setUiState({ showAppView: false });
    }
  } finally {
    document.body?.classList.remove('booting');
  }
}

init();
