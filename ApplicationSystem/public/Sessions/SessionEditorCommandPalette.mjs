// Nodevision/ApplicationSystem/public/Sessions/SessionEditorCommandPalette.mjs
// This module renders the Session editor command palette from the shared command registry.

import { getSessionSafeCommandDefinitions } from "../Commands/NodevisionCommandRegistry.mjs";

function argumentPlaceholder(arg = {}) {
  if (arg.type === "number") return "1";
  if (arg.type === "boolean") return "true";
  if (arg.type === "notebookPath") return '"path/to/file"';
  if (arg.type === "any") return "null";
  return `"${arg.name || "value"}"`;
}

function commandSnippet(command) {
  const args = (command.arguments || []).filter((arg) => arg.required).map(argumentPlaceholder);
  return `\nrun("${command.id}"${args.length ? ", " + args.join(", ") : ""});\n`;
}

function describeCommand(command) {
  const names = (command.arguments || []).map((arg) => arg.name).filter(Boolean).join(", ");
  return names ? `${command.description} Args: ${names}.` : command.description;
}

export function renderSessionEditorCommands(target, textarea) {
  target.replaceChildren();
  const heading = document.createElement("h3");
  heading.textContent = "Commands";
  target.appendChild(heading);
  for (const command of getSessionSafeCommandDefinitions()) {
    const row = document.createElement("div");
    row.className = "nv-session-command-row";
    const info = document.createElement("div");
    const commandLabel = document.createElement("strong");
    commandLabel.textContent = `${command.label || command.id} (${command.id})`;
    const commandDescription = document.createElement("small");
    commandDescription.textContent = describeCommand(command);
    info.append(commandLabel, commandDescription);
    const insert = document.createElement("button");
    insert.type = "button";
    insert.textContent = "Insert";
    insert.addEventListener("click", () => {
      textarea.value += commandSnippet(command);
      textarea.dispatchEvent(new Event("input"));
      textarea.focus();
    });
    row.append(info, insert);
    target.appendChild(row);
  }
}
