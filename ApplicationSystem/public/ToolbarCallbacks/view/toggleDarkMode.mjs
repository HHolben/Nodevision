// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/toggleDarkMode.mjs
// This file defines browser-side toggle Dark Mode logic for the Nodevision UI. It renders interface components and handles user interactions.
// DEVELOPMENT UI FEATURE: toggles Nodevision theme.
// This is purely visual and does not change execution/security boundaries.

const STORAGE_KEY = "nodevision_theme";

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "dark" || stored === "light" ? stored : "";
  } catch {
    return "";
  }
}

function getCurrentTheme() {
  const theme = document.documentElement?.dataset?.nvTheme;
  if (theme === "dark" || theme === "light") return theme;
  return readStoredTheme() || "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.nvTheme = theme;
  document.documentElement.style.colorScheme = theme;
  document.body?.classList.toggle("dark-mode", theme === "dark");
  if (window.NodevisionState) {
    window.NodevisionState.theme = theme;
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Dark mode still applies for the current page even if storage is blocked.
  }
  window.dispatchEvent(new CustomEvent("nv-theme-changed", { detail: { theme } }));
}

export default function toggleDarkMode() {
  const current = getCurrentTheme();
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
}
