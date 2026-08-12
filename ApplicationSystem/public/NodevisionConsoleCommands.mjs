// Nodevision/ApplicationSystem/public/NodevisionConsoleCommands.mjs
// Shared browser-console command glossary for the floating Nodevision Console.

import { getConsoleCommandDefinitions } from "./Commands/NodevisionCommandRegistry.mjs";
import { NODEVISION_CONSOLE_COMMANDS } from "./NodevisionConsoleCommandList.mjs";

export { NODEVISION_CONSOLE_COMMANDS } from "./NodevisionConsoleCommandList.mjs";

function sharedCommandToConsoleEntry(entry) {
  return {
    id: `shared-${entry.id}`,
    category: entry.category || "Nodevision",
    label: entry.label || entry.id,
    command: entry.consoleCommand,
    description: entry.description || entry.id,
    aliases: [entry.id, entry.category, entry.label].filter(Boolean),
  };
}

export function getNodevisionConsoleCommands() {
  const consoleOnly = NODEVISION_CONSOLE_COMMANDS.map((entry) => ({ ...entry }));
  const shared = getConsoleCommandDefinitions().map(sharedCommandToConsoleEntry);
  return [...consoleOnly, ...shared];
}

export function searchNodevisionConsoleCommands(query = "") {
  const terms = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  const commands = getNodevisionConsoleCommands();
  if (!terms.length) return commands;

  return commands
    .map((entry) => {
      const haystack = [
        entry.category,
        entry.label,
        entry.command,
        entry.description,
        ...(entry.aliases || []),
      ].join(" ").toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.label.localeCompare(b.entry.label))
    .map(({ entry }) => entry);
}
