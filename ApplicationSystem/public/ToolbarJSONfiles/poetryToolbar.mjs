// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/poetryToolbar.mjs
// Poetry sub-toolbar for semantic line-numbered poem editing.

const ACTIONS = [
  ["line", "Add poem line"],
  ["break", "Add stanza break"],
  ["heading", "Add heading"],
  ["rhyme", "Add rhyme note"],
  ["interval", "Change line interval"],
];

function tools() {
  return window.HTMLWysiwygTools || {};
}

async function poetryApi() {
  if (window.NodevisionPoetry?.performPoemToolbarAction) return window.NodevisionPoetry;
  try {
    const mod = await import("/ToolbarCallbacks/insert/insertLineNumberedPoetry.mjs");
    return Object.assign(window.NodevisionPoetry || {}, mod || {});
  } catch (err) {
    console.warn("[poetryToolbar] Failed to load poetry tools:", err);
    return window.NodevisionPoetry || {};
  }
}

function setStatus(mount, message, isError = false) {
  const status = mount.querySelector("[data-field='status']");
  if (!status) return;
  status.textContent = String(message || "");
  status.style.color = isError ? "#b00020" : "#4b5563";
}

function renderToolbar(mount) {
  mount.innerHTML = "";
  mount.id = "nv-poetry-toolbar";
  mount.style.cssText = "display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:12px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;";

  for (const [action, label] of ACTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = action;
    button.textContent = label;
    button.title = label;
    mount.appendChild(button);
  }

  const status = document.createElement("span");
  status.dataset.field = "status";
  status.style.cssText = "min-width:120px;color:#4b5563;";
  mount.appendChild(status);
}

export function initToolbarWidget(hostElement) {
  if (!hostElement || hostElement.dataset.nvPoetryToolbarBound === "true") return;
  hostElement.dataset.nvPoetryToolbarBound = "true";
  const mount = hostElement.querySelector("#nv-poetry-toolbar") || hostElement;
  renderToolbar(mount);

  const rememberSelection = () => {
    if (typeof tools().saveCurrentSelection === "function") tools().saveCurrentSelection();
  };

  mount.addEventListener("pointerdown", rememberSelection, true);
  mount.addEventListener("mousedown", rememberSelection, true);

  mount.addEventListener("click", async (evt) => {
    const button = evt.target?.closest?.("[data-action]");
    if (!button) return;
    evt.preventDefault();
    rememberSelection();
    if (typeof tools().restoreSavedSelection === "function") tools().restoreSavedSelection();
    try {
      const api = await poetryApi();
      if (typeof api.performPoemToolbarAction !== "function") throw new Error("No active poetry editor.");
      api.performPoemToolbarAction(button.dataset.action);
      setStatus(mount, "");
    } catch (err) {
      console.warn("[poetryToolbar]", err);
      setStatus(mount, err?.message || String(err), true);
    }
  });
}
