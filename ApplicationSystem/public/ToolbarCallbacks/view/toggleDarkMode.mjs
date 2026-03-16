// DEVELOPMENT UI FEATURE: toggles Nodevision theme.
// This is purely visual and does not change execution/security boundaries.

const STORAGE_KEY = "nodevision_theme";

function getCurrentTheme() {
  const theme = document.documentElement?.dataset?.nvTheme;
  if (theme === "dark" || theme === "light") return theme;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.nvTheme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent("nv-theme-changed", { detail: { theme } }));
}

export default function toggleDarkMode() {
  const current = getCurrentTheme();
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
}

