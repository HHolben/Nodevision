// Security helpers for declarative sound definitions.

const DEFAULT_ALLOWED_PREFIXES = ["/soundEffects/", "/Notebook/"];
const DEFAULT_ALLOWED_EXTENSIONS = [".mp3", ".wav", ".ogg", ".m4a"];

export function validateSoundUrl(url, options = {}) {
  const allowedPrefixes = options.allowedPrefixes || DEFAULT_ALLOWED_PREFIXES;
  const allowedExtensions = options.allowedExtensions || DEFAULT_ALLOWED_EXTENSIONS;

  if (typeof url !== "string" || !url.trim()) {
    throw new Error("Sound URL must be a non-empty string.");
  }

  const trimmed = url.trim();
  if (/^(https?:|data:|javascript:)/i.test(trimmed)) {
    throw new Error("Remote/data/javascript URLs are not allowed for sound assets.");
  }

  const prefixOk = allowedPrefixes.some((prefix) => trimmed.startsWith(prefix));
  if (!prefixOk) {
    throw new Error(`Sound URL must start with one of: ${allowedPrefixes.join(", ")}`);
  }

  const lower = trimmed.toLowerCase();
  const extOk = allowedExtensions.some((ext) => lower.endsWith(ext));
  if (!extOk) {
    throw new Error(`Sound URL extension must be one of: ${allowedExtensions.join(", ")}`);
  }

  return true;
}
