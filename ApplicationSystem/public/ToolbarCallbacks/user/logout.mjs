// Nodevision/ApplicationSystem/public/ToolbarCallbacks/user/logout.mjs
// Ensures the API session ends before returning to the entry point.
export default async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (err) {
    console.warn('Logout request failed', err);
  }
  window.location.href = '/';
}
