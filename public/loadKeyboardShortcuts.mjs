// Nodevision/public/loadKeyboardShortcuts.mjs

let globalShortcuts = {};      // All shortcuts loaded from the JSON
let activeModeShortcuts = {};  // Shortcuts currently active for the mode
let currentListener = null;

/**
 * Load the global FileKeyboardShortcuts.json file ONCE.
 */
export async function loadGlobalShortcuts() {
  if (Object.keys(globalShortcuts).length > 0) return; // already loaded

  try {
    const res = await fetch("/UserSettings/KeyboardAndControlSchemes/FileKeyboardShortcuts.json");
    if (!res.ok) throw new Error("Shortcut file missing");

    globalShortcuts = await res.json();
    console.log("Loaded global shortcuts:", globalShortcuts);

  } catch (err) {
    console.warn("Failed to load global keyboard shortcuts:", err);
  }
}

/**
 * Given a mode string ("HTMLediting", "CSVediting", etc.),
 * isolate shortcuts relevant for that mode.
 */
export async function loadShortcutsForMode(mode) {
  await loadGlobalShortcuts();

  if (!globalShortcuts[mode]) {
    console.warn("No shortcuts defined for mode:", mode);
    activeModeShortcuts = {};
    return;
  }

  activeModeShortcuts = globalShortcuts[mode];
  console.log("Active shortcuts for", mode, "→", activeModeShortcuts);

  installKeyboardListener();
}

/**
 * Normalize key event → "ctrl+shift+s"
 */
function normalizeEvent(event) {
  return (
    (event.ctrlKey || event.metaKey ? "ctrl+" : "") +
    (event.shiftKey ? "shift+" : "") +
    (event.altKey ? "alt+" : "") +
    event.key.toLowerCase()
  );
}

/**
 * Install keyboard listener for the current mode only.
 */
function installKeyboardListener() {
  if (currentListener) {
    document.removeEventListener("keydown", currentListener);
  }

  currentListener = (e) => {
    const combo = normalizeEvent(e);

    for (const [name, data] of Object.entries(activeModeShortcuts)) {
      if (!data.keyboard) continue;
      if (combo === data.keyboard.toLowerCase()) {

        // Suppress ONLY if defined.
        e.preventDefault();

        const action = window[data.action];
        if (typeof action === "function") {
          action();
        } else {
          console.warn(`Shortcut action not found: ${data.action}`);
        }
        return;
      }
    }
    // Otherwise allow browser default behavior
  };

  document.addEventListener("keydown", currentListener);
}
