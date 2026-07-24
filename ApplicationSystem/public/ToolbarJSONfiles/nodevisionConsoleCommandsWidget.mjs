// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/nodevisionConsoleCommandsWidget.mjs
// Compact command search/glossary widget for the Nodevision Console sub-toolbar.

import {
  getNodevisionConsoleCommands,
  searchNodevisionConsoleCommands,
} from "/NodevisionConsoleCommands.mjs";
import { setStatus } from "/StatusBar.mjs";

const STYLE_ID = "nv-nodevision-console-toolbar-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #sub-toolbar .nv-subtoolbar-widget.nv-nodevision-console-toolbar-host {
      flex: 1 1 520px;
      min-width: 280px;
      max-width: 100%;
      padding: 4px 6px;
    }
    .nv-nodevision-console-toolbar {
      display: grid;
      grid-template-columns: minmax(150px, 260px) minmax(220px, 1fr) auto;
      align-items: center;
      gap: 6px;
      width: 100%;
      min-width: 0;
    }
    .nv-nodevision-console-toolbar input,
    .nv-nodevision-console-toolbar select {
      height: 26px;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #8b949e;
      border-radius: 4px;
      padding: 2px 7px;
      background: #fff;
      color: #1d2329;
      font: 12px system-ui, -apple-system, Segoe UI, sans-serif;
    }
    .nv-nodevision-console-toolbar button {
      height: 26px;
      white-space: nowrap;
    }
    @media (max-width: 760px) {
      .nv-nodevision-console-toolbar {
        grid-template-columns: minmax(0, 1fr);
      }
      .nv-nodevision-console-toolbar button {
        width: max-content;
      }
    }
    html[data-nv-theme="dark"] .nv-nodevision-console-toolbar input,
    html[data-nv-theme="dark"] .nv-nodevision-console-toolbar select {
      background: #050505;
      border-color: #666;
      color: #f5f5f5;
    }
  `;
  document.head.appendChild(style);
}

function groupedCommands(commands) {
  const groups = new Map();
  for (const command of commands) {
    const key = command.category || "Nodevision";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(command);
  }
  return Array.from(groups.entries());
}

function optionLabel(command) {
  return `${command.label} - ${command.command}`;
}

async function ensureConsoleOpen() {
  if (window.NVNodevisionConsole?.pasteCommand) return;
  try {
    const mod = await import("/ToolbarCallbacks/terminal/openNodevisionConsole.mjs");
    await mod.default();
  } catch (err) {
    console.warn("Failed to open Nodevision Console:", err);
  }
}

async function pasteCommand(commandText) {
  if (!commandText) return;
  await ensureConsoleOpen();
  if (window.NVNodevisionConsole?.pasteCommand) {
    window.NVNodevisionConsole.pasteCommand(commandText);
    setStatus("Nodevision Console", "Command pasted");
    return;
  }

  window.dispatchEvent(new CustomEvent("nodevision-console-paste", {
    detail: { command: commandText },
  }));
}

export function initToolbarWidget(hostElement) {
  if (!hostElement || hostElement.querySelector(".nv-nodevision-console-toolbar")) return;
  ensureStyle();
  hostElement.classList.add("nv-nodevision-console-toolbar-host");

  const root = document.createElement("div");
  root.className = "nv-nodevision-console-toolbar";

  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search Nodevision commands";
  search.setAttribute("aria-label", "Search Nodevision commands");

  const select = document.createElement("select");
  select.setAttribute("aria-label", "Nodevision command glossary");

  const pasteButton = document.createElement("button");
  pasteButton.type = "button";
  pasteButton.textContent = "Paste";

  root.append(search, select, pasteButton);
  hostElement.appendChild(root);

  const allCommands = getNodevisionConsoleCommands();
  let visibleCommands = allCommands;

  const renderOptions = () => {
    select.innerHTML = "";
    if (!visibleCommands.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No matching commands";
      select.appendChild(option);
      return;
    }

    for (const [category, commands] of groupedCommands(visibleCommands)) {
      const group = document.createElement("optgroup");
      group.label = category;
      for (const command of commands) {
        const option = document.createElement("option");
        option.value = command.command;
        option.textContent = optionLabel(command);
        option.title = command.description || command.command;
        group.appendChild(option);
      }
      select.appendChild(group);
    }
  };

  const applySearch = () => {
    visibleCommands = searchNodevisionConsoleCommands(search.value);
    renderOptions();
  };

  search.addEventListener("input", applySearch);
  search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      pasteCommand(select.value);
    }
  });

  select.addEventListener("change", () => {
    pasteCommand(select.value);
  });
  select.addEventListener("dblclick", () => {
    pasteCommand(select.value);
  });

  pasteButton.addEventListener("click", () => {
    pasteCommand(select.value);
  });

  renderOptions();
}
