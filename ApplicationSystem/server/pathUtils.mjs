// Nodevision/ApplicationSystem/server/pathUtils.mjs
// This file validates and normalizes user-supplied paths so that API routes can safely resolve files within an allowed base directory.

import path from "node:path";

export function validateAndNormalizePath(userPath, allowedBaseDir) {
  if (!userPath) return allowedBaseDir;

  const sanitized = String(userPath).replace(/\0/g, "").replace(/\\/g, "/");
  const resolved = path.resolve(allowedBaseDir, sanitized);

  const relative = path.relative(allowedBaseDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Access denied: Path outside allowed directory");
  }

  return resolved;
}

