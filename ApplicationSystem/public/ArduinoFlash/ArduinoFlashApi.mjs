// Nodevision/ApplicationSystem/public/ArduinoFlash/ArduinoFlashApi.mjs
// Thin browser API wrapper for server-side Arduino CLI and serial routes.

export async function apiJson(url, init = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Request failed (${response.status})`);
  return payload;
}

export const ArduinoFlashApi = {
  status: () => apiJson("/api/arduino-flash/status"),
  ports: () => apiJson("/api/arduino-flash/ports"),
  detectedBoards: () => apiJson("/api/arduino-flash/boards/detected"),
  boards: () => apiJson("/api/arduino-flash/boards"),
  libraries: () => apiJson("/api/arduino-flash/libraries"),
  installLibrary: (name) => apiJson("/api/arduino-flash/libraries/install", {
    method: "POST",
    body: JSON.stringify({ name }),
  }),
  verify: ({ filePath, fqbn }) => apiJson("/api/arduino-flash/verify", {
    method: "POST",
    body: JSON.stringify({ filePath, fqbn }),
  }),
  upload: ({ filePath, fqbn, port }) => apiJson("/api/arduino-flash/upload", {
    method: "POST",
    body: JSON.stringify({ filePath, fqbn, port }),
  }),
  serialConnect: ({ port, baudRate }) => apiJson("/api/arduino-flash/serial/connect", {
    method: "POST",
    body: JSON.stringify({ port, baudRate }),
  }),
  serialDisconnect: ({ port }) => apiJson("/api/arduino-flash/serial/disconnect", {
    method: "POST",
    body: JSON.stringify({ port }),
  }),
  serialWrite: ({ port, text, newline = true }) => apiJson("/api/arduino-flash/serial/write", {
    method: "POST",
    body: JSON.stringify({ port, text, newline }),
  }),
};
