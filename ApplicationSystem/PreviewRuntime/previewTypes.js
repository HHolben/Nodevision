export const SUPPORTED_LANGUAGES = Object.freeze(['python', 'java', 'cpp']);

export const LANGUAGE_EXTENSIONS = Object.freeze({
  python: ['.py'],
  java: ['.java'],
  cpp: ['.cpp'],
});

export function normalizeLanguage(language) {
  if (typeof language !== 'string') return null;
  const normalized = language.trim().toLowerCase();
  if (!SUPPORTED_LANGUAGES.includes(normalized)) return null;
  return normalized;
}

export function isSupportedExtensionForLanguage(ext, language) {
  const normalizedLanguage = normalizeLanguage(language);
  if (!normalizedLanguage) return false;
  const list = LANGUAGE_EXTENSIONS[normalizedLanguage] ?? [];
  return list.includes(String(ext || '').toLowerCase());
}

// Development-only runner label. This is not a hardened sandbox.
export const DEFAULT_RUNNER = 'local-dev';
