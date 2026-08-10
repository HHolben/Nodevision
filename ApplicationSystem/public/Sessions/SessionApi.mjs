// Nodevision/ApplicationSystem/public/Sessions/SessionApi.mjs
// This module wraps the authenticated browser API used by the Nodevision Session selector and editor.

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `Session API request failed with ${response.status}.`);
  return data;
}

export async function listSessions() {
  return readJson(await fetch("/api/sessions", { cache: "no-store" }));
}

export async function readSession(scope, id) {
  const params = new URLSearchParams({ scope, id });
  const data = await readJson(await fetch(`/api/sessions/read?${params}`, { cache: "no-store" }));
  return data.session;
}

export async function createUserSession(name) {
  const data = await readJson(await fetch("/api/sessions/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }));
  return data.session;
}

export async function saveUserSession(id, source) {
  const data = await readJson(await fetch("/api/sessions/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, source }),
  }));
  return data.session;
}

export async function duplicateBuiltInSession(id, name = "") {
  const data = await readJson(await fetch("/api/sessions/duplicate-builtin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, name }),
  }));
  return data.session;
}

