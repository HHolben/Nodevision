// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/textWorldConsole.mjs
// This file renders the text-based MetaWorld view mode and dispatches typed instructions into the existing movement system.

import { runTextWorldCommand } from "./textWorldCommandParser.mjs";

function isTextViewMode(movementState) {
  const viewMode = String(movementState?.viewMode || "").toLowerCase();
  const cameraMode = String(movementState?.cameraMode || "").toLowerCase();
  return viewMode === "text" || viewMode === "console" || cameraMode === "text";
}

function styleElement(element, styles) {
  Object.assign(element.style, styles);
  return element;
}

function appendLine(log, text, className) {
  if (!text) return;
  const line = document.createElement("div");
  line.className = className;
  line.textContent = text;
  line.style.whiteSpace = "pre-wrap";
  line.style.margin = "0 0 10px";
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

export function createTextWorldConsole({ panel, canvas, movementState, getCommandContext, onInputAction }) {
  const previousCanvasDisplay = canvas?.style?.display || "";
  let active = false;

  const root = styleElement(document.createElement("div"), {
    position: "absolute",
    inset: "0",
    display: "none",
    zIndex: "3200",
    background: "#101412",
    color: "#f3f0dc",
    font: "14px/1.45 monospace",
    boxSizing: "border-box",
    padding: "14px",
    gridTemplateRows: "minmax(0, 1fr) auto",
    gap: "10px"
  });

  const log = styleElement(document.createElement("div"), {
    overflow: "auto",
    border: "1px solid rgba(163, 188, 139, 0.48)",
    background: "#171c19",
    padding: "12px",
    boxSizing: "border-box"
  });

  const form = styleElement(document.createElement("form"), {
    display: "grid",
    gridTemplateColumns: "auto minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "8px"
  });

  const prompt = document.createElement("span");
  prompt.textContent = ">";
  prompt.style.color = "#9bd67b";

  const input = styleElement(document.createElement("input"), {
    height: "34px",
    minWidth: "0",
    border: "1px solid rgba(163, 188, 139, 0.68)",
    background: "#0c0f0d",
    color: "#f3f0dc",
    padding: "0 10px",
    font: "14px/1 monospace",
    outline: "none",
    boxSizing: "border-box"
  });
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.placeholder = "Type an instruction";

  const button = styleElement(document.createElement("button"), {
    height: "34px",
    border: "1px solid rgba(163, 188, 139, 0.68)",
    background: "#25352b",
    color: "#f3f0dc",
    padding: "0 12px",
    font: "13px/1 monospace",
    cursor: "pointer"
  });
  button.type = "submit";
  button.textContent = "Run";

  form.append(prompt, input, button);
  root.append(log, form);
  panel.appendChild(root);

  function submit(command) {
    const text = String(command || "").trim();
    if (!text) return;
    appendLine(log, `> ${text}`, "text-world-command");
    const context = getCommandContext();
    const result = runTextWorldCommand(text, context);
    if (result?.input && typeof onInputAction === "function") {
      onInputAction(result.input, result.frames);
    }
    appendLine(log, result?.output || "", "text-world-response");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submit(input.value);
    input.value = "";
  });

  ["keydown", "keyup", "keypress"].forEach((eventName) => {
    input.addEventListener(eventName, (event) => event.stopPropagation());
  });

  function setActive(nextActive) {
    if (active === nextActive) return;
    active = nextActive;
    root.style.display = active ? "grid" : "none";
    if (canvas?.style) canvas.style.display = active ? "none" : previousCanvasDisplay;
    if (movementState) movementState.textWorldConsoleActive = active;
    if (active) {
      const heldKeys = movementState?.heldKeys;
      if (heldKeys && typeof heldKeys === "object") {
        Object.keys(heldKeys).forEach((key) => { heldKeys[key] = false; });
      }
      getCommandContext()?.controls?.unlock?.();
      window.requestAnimationFrame(() => input.focus());
    }
  }

  return {
    update() {
      setActive(isTextViewMode(movementState));
    },
    submit,
    dispose() {
      setActive(false);
      root.remove();
    }
  };
}
