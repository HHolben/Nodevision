// Nodevision/ApplicationSystem/routes/api/fileSaveRoutes/saveSourceGuard.js
// This file rejects stale editor buffers when a client declares the path the buffer came from.

export function normalizeSaveSourcePath(pathValue = "") {
  return String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .split(/[?#]/)[0]
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "");
}

export function validateSaveSourcePath({ relativePath, sourcePath } = {}) {
  if (!sourcePath) return { ok: true };

  const target = normalizeSaveSourcePath(relativePath);
  const source = normalizeSaveSourcePath(sourcePath);
  if (!target || !source || target === source) return { ok: true };

  return {
    ok: false,
    error: "Refusing to save an editor buffer into a different file path.",
    code: "SAVE_SOURCE_PATH_MISMATCH",
    sourcePath: source,
    targetPath: target,
  };
}
