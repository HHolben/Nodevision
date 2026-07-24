// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/NodevisionConsole.mjs
// Floating browser-context console for Nodevision UI commands.

import { getNodevisionConsoleCommands } from "/NodevisionConsoleCommands.mjs";
import { setStatus } from "/StatusBar.mjs";

const STYLE_ID = "nv-nodevision-console-style";
const MAX_HISTORY = 100;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .nv-nodevision-console {
      height: 100%;
      min-height: 0;
      display: flex;
      flex-direction: column;
      background: #101010;
      color: #e6f1ec;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .nv-nodevision-console__output {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 42px),
        #101010;
    }
    .nv-nodevision-console__entry {
      border-left: 3px solid #59636b;
      padding-left: 8px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .nv-nodevision-console__entry[data-kind="command"] { border-color: #8ac7ff; color: #eaf6ff; }
    .nv-nodevision-console__entry[data-kind="result"] { border-color: #79d58d; color: #e8ffe9; }
    .nv-nodevision-console__entry[data-kind="error"] { border-color: #ff7a7a; color: #ffd9d9; }
    .nv-nodevision-console__entry[data-kind="warn"] { border-color: #f0c36a; color: #fff2c7; }
    .nv-nodevision-console__entry[data-kind="info"],
    .nv-nodevision-console__entry[data-kind="log"],
    .nv-nodevision-console__entry[data-kind="debug"] { border-color: #b4bbc3; color: #f3f4f5; }
    .nv-nodevision-console__meta {
      margin-bottom: 2px;
      color: #9ca7ad;
      font-size: 11px;
    }
    .nv-nodevision-console__body {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      color: inherit;
      font: inherit;
    }
    .nv-nodevision-console__form {
      flex: 0 0 auto;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      gap: 6px;
      align-items: end;
      padding: 8px;
      border-top: 1px solid #343a3f;
      background: #171a1d;
    }
    .nv-nodevision-console__prompt {
      align-self: center;
      color: #8ac7ff;
      font-weight: 700;
      user-select: none;
    }
    .nv-nodevision-console__input {
      width: 100%;
      min-height: 34px;
      max-height: 130px;
      resize: vertical;
      padding: 7px 8px;
      box-sizing: border-box;
      border: 1px solid #4b5660;
      border-radius: 4px;
      background: #050708;
      color: #f7fbff;
      font: inherit;
    }
    .nv-nodevision-console__button {
      height: 34px;
      padding: 0 10px;
      border: 1px solid #67717a;
      border-radius: 4px;
      background: #252b31;
      color: #f5f7fa;
      cursor: pointer;
      font: 12px system-ui, -apple-system, Segoe UI, sans-serif;
    }
    .nv-nodevision-console__button:hover {
      background: #313943;
    }
    html[data-nv-theme="dark"] .nv-nodevision-console {
      background: #050505;
    }
    html[data-nv-theme="dark"] .nv-nodevision-console__form {
      background: #111315;
      border-top-color: #444;
    }
  `;
  document.head.appendChild(style);
}

function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function isElement(value) {
  return value && typeof value === "object" && value.nodeType === 1 && typeof value.tagName === "string";
}

function formatElement(value) {
  const tag = value.tagName.toLowerCase();
  const id = value.id ? `#${value.id}` : "";
  const classes = String(value.className || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((className) => `.${className}`)
    .join("");
  return `<${tag}${id}${classes}>`;
}

function stringifyWithCycles(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, entry) => {
    if (typeof entry === "object" && entry !== null) {
      if (seen.has(entry)) return "[Circular]";
      seen.add(entry);
    }
    if (typeof entry === "function") return entry.toString();
    if (isElement(entry)) return formatElement(entry);
    return entry;
  }, 2);
}

function formatValue(value) {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  if (typeof value === "function") return value.toString();
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  if (isElement(value)) return formatElement(value);

  try {
    return stringifyWithCycles(value) || String(value);
  } catch {
    return String(value);
  }
}

async function evaluateBrowserCommand(source) {
  const code = String(source || "");

  try {
    return await (0, eval)(code);
  } catch (err) {
    const canRetryAsAsync = err instanceof SyntaxError && /\bawait\b/.test(code);
    if (!canRetryAsAsync) throw err;

    const AsyncFunction = Object.getPrototypeOf(async function noop() {}).constructor;
    try {
      return await AsyncFunction(`return (${code});`).call(window);
    } catch (expressionErr) {
      if (!(expressionErr instanceof SyntaxError)) throw expressionErr;
      return await AsyncFunction(code).call(window);
    }
  }
}

function makeEntry(kind, meta, body) {
  const entry = document.createElement("div");
  entry.className = "nv-nodevision-console__entry";
  entry.dataset.kind = kind;

  const metaEl = document.createElement("div");
  metaEl.className = "nv-nodevision-console__meta";
  metaEl.textContent = meta;

  const bodyEl = document.createElement("pre");
  bodyEl.className = "nv-nodevision-console__body";
  bodyEl.textContent = body;

  entry.append(metaEl, bodyEl);
  return entry;
}

function showConsoleSubToolbar() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: {
      heading: "Nodevision Console",
      force: true,
      toggle: false,
    },
  }));
}

function setFloatingPanelActive(panelRoot) {
  if (!panelRoot) return;
  window.__nvActivePanelElement = panelRoot;
  window.__nvActiveLegacyUndockedPanel = null;
  window.activePanel = "NodevisionConsole";
  window.activePanelClass = "InfoPanel";
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "InfoPanel";
  window.dispatchEvent(new CustomEvent("activePanelChanged", {
    detail: {
      panel: "NodevisionConsole",
      cell: null,
      panelClass: "InfoPanel",
    },
  }));
}

export async function createPanel(content, panelVars = {}, panelRoot = null) {
  ensureStyle();
  content.innerHTML = "";

  const root = document.createElement("section");
  root.className = "nv-nodevision-console";
  root.setAttribute("aria-label", "Nodevision Console");

  const output = document.createElement("div");
  output.className = "nv-nodevision-console__output";
  output.dataset.output = "true";

  const form = document.createElement("form");
  form.className = "nv-nodevision-console__form";

  const prompt = document.createElement("span");
  prompt.className = "nv-nodevision-console__prompt";
  prompt.textContent = "NV>";

  const input = document.createElement("textarea");
  input.className = "nv-nodevision-console__input";
  input.rows = 1;
  input.spellcheck = false;
  input.placeholder = "JavaScript command";
  input.setAttribute("aria-label", "Nodevision Console command");

  const runButton = document.createElement("button");
  runButton.className = "nv-nodevision-console__button";
  runButton.type = "submit";
  runButton.textContent = "Run";

  const clearButton = document.createElement("button");
  clearButton.className = "nv-nodevision-console__button";
  clearButton.type = "button";
  clearButton.textContent = "Clear";

  form.append(prompt, input, runButton, clearButton);
  root.append(output, form);
  content.appendChild(root);

  const state = {
    history: [],
    historyIndex: -1,
    running: false,
  };

  const scrollToBottom = () => {
    output.scrollTop = output.scrollHeight;
  };

  const appendEntry = (kind, meta, body) => {
    output.appendChild(makeEntry(kind, meta, body));
    scrollToBottom();
  };

  const clearOutput = () => {
    output.innerHTML = "";
  };

  const pasteCommand = (command, options = {}) => {
    const text = String(command || "");
    input.value = text;
    input.focus();
    input.selectionStart = input.value.length;
    input.selectionEnd = input.value.length;
    if (options.run === true) {
      form.requestSubmit();
    }
  };

  const runCommand = async () => {
    const command = input.value.trim();
    if (!command || state.running) return;

    state.running = true;
    runButton.disabled = true;
    input.disabled = true;
    setFloatingPanelActive(panelRoot);
    showConsoleSubToolbar();

    state.history.push(command);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    state.historyIndex = state.history.length;

    appendEntry("command", `${timestamp()} command`, command);
    input.value = "";

    const originalConsole = {};
    const levels = ["log", "info", "warn", "error", "debug"];
    for (const level of levels) {
      originalConsole[level] = console[level];
      console[level] = (...args) => {
        try {
          originalConsole[level]?.apply(console, args);
        } finally {
          appendEntry(level, `${timestamp()} console.${level}`, args.map(formatValue).join(" "));
        }
      };
    }

    try {
      const result = await evaluateBrowserCommand(command);
      appendEntry("result", `${timestamp()} result`, formatValue(result));
      setStatus("Nodevision Console", "Command complete");
    } catch (err) {
      appendEntry("error", `${timestamp()} error`, formatValue(err));
      setStatus("Nodevision Console", "Command failed");
    } finally {
      for (const level of levels) {
        console[level] = originalConsole[level];
      }
      state.running = false;
      runButton.disabled = false;
      input.disabled = false;
      input.focus();
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runCommand();
  });

  clearButton.addEventListener("click", () => {
    clearOutput();
    input.focus();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
      event.preventDefault();
      clearOutput();
      return;
    }

    if (event.key === "ArrowUp" && state.history.length && input.selectionStart === 0) {
      event.preventDefault();
      state.historyIndex = Math.max(0, state.historyIndex - 1);
      input.value = state.history[state.historyIndex] || "";
      input.selectionStart = input.value.length;
      input.selectionEnd = input.value.length;
      return;
    }

    if (event.key === "ArrowDown" && state.history.length) {
      event.preventDefault();
      state.historyIndex = Math.min(state.history.length, state.historyIndex + 1);
      input.value = state.historyIndex >= state.history.length ? "" : (state.history[state.historyIndex] || "");
      input.selectionStart = input.value.length;
      input.selectionEnd = input.value.length;
    }
  });

  const api = {
    clear: clearOutput,
    focus: () => {
      setFloatingPanelActive(panelRoot);
      showConsoleSubToolbar();
      input.focus();
    },
    getCommands: getNodevisionConsoleCommands,
    pasteCommand,
    runCommand: (command) => {
      pasteCommand(command, { run: true });
    },
  };

  const onPaste = (event) => {
    if (!event?.detail?.command) return;
    api.pasteCommand(event.detail.command, { run: event.detail.run === true });
  };

  let cleanupObserver = null;
  const cleanup = () => {
    window.removeEventListener("nodevision-console-paste", onPaste);
    cleanupObserver?.disconnect();
    cleanupObserver = null;
    if (window.NVNodevisionConsole === api) {
      delete window.NVNodevisionConsole;
    }
  };

  window.addEventListener("nodevision-console-paste", onPaste);
  window.NVNodevisionConsole = api;

  if (panelRoot) {
    panelRoot.__nvOnClose = cleanup;
    cleanupObserver = new MutationObserver(() => {
      if (!panelRoot.isConnected) cleanup();
    });
    cleanupObserver.observe(document.body, { childList: true, subtree: true });
    panelRoot.addEventListener("pointerdown", () => {
      setFloatingPanelActive(panelRoot);
      showConsoleSubToolbar();
    });
    panelRoot.addEventListener("focusin", () => {
      setFloatingPanelActive(panelRoot);
      showConsoleSubToolbar();
    });
  }

  appendEntry(
    "info",
    `${timestamp()} ready`,
    formatValue({
      console: "Nodevision browser context",
      commands: getNodevisionConsoleCommands().length,
      mode: window.NodevisionState?.currentMode || "Default",
    }),
  );

  requestAnimationFrame(() => {
    api.focus();
  });

  return api;
}

export default createPanel;
