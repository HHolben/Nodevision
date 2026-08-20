// Nodevision/ApplicationSystem/public/Controls/ControlsMetadata.mjs
// This module resolves user-facing Controls rows from the shared command registry and existing toolbar JSON metadata so Nodevision can display command, shortcut, and toolbar-location information without maintaining a duplicate shortcut list.

import { NODEVISION_SHARED_COMMANDS } from "../Commands/CommandDefinitions.mjs";

export const TOOLBAR_METADATA_FILES = Object.freeze([
  "/ToolbarJSONfiles/defaultToolbar.json",
  "/ToolbarJSONfiles/fileToolbar.json",
  "/ToolbarJSONfiles/editToolbar.json",
  "/ToolbarJSONfiles/stylesToolbar.json",
  "/ToolbarJSONfiles/insertToolbar.json",
  "/ToolbarJSONfiles/settingsToolbar.json",
  "/ToolbarJSONfiles/viewToolbar.json",
  "/ToolbarJSONfiles/terminalToolbar.json",
  "/ToolbarJSONfiles/searchToolbar.json",
  "/ToolbarJSONfiles/userToolbar.json",
  "/ToolbarJSONfiles/drawToolbar.json",
]);

export function clean(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

export function commandKeyForToolbarItem(item = {}) {
  return clean(item.command || item.commandId || item.callbackKey || item.panelTemplateId || item.panelTemplate || item.script || item.heading);
}

function displayPart(value = "") {
  const text = clean(value);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toolbarNameFromFile(file = "") {
  return displayPart((file.split("/").pop() || "").replace("Toolbar.json", "")) || "Toolbar";
}

export function toolbarLocationForItem(file, item = {}) {
  const category = displayPart(clean(item.ToolbarCategory, toolbarNameFromFile(file)));
  return [category, clean(item.parentHeading), clean(item.heading)].filter(Boolean).join(" > ");
}

export function toolbarRowsFromItems(file, items = []) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    id: commandKeyForToolbarItem(item),
    label: clean(item.heading || item.label || item.shortLabel, "Toolbar Item"),
    shortcut: clean(item.hotkeyText),
    location: toolbarLocationForItem(file, item),
  })).filter((row) => row.id || row.label);
}

async function loadToolbarRows(fetchImpl, toolbarFiles) {
  const rows = [];
  await Promise.all(toolbarFiles.map(async (file) => {
    try {
      const response = await fetchImpl(file, { cache: "no-store" });
      if (!response.ok) return;
      rows.push(...toolbarRowsFromItems(file, await response.json()));
    } catch (err) {
      console.warn("[ControlsMetadata] Toolbar metadata unavailable:", file, err);
    }
  }));
  return rows;
}

function addSetValue(set, value) {
  const text = clean(value);
  if (text) set.add(text);
}

export function mergeControlsRows({ commands = NODEVISION_SHARED_COMMANDS, toolbarRows = [] } = {}) {
  const byId = new Map();

  toolbarRows.forEach((row) => {
    const id = clean(row.id, row.label);
    if (!id) return;
    const current = byId.get(id) || {
      id,
      label: clean(row.label, id),
      description: "",
      category: "",
      shortcuts: new Set(),
      locations: new Set(),
    };
    addSetValue(current.shortcuts, row.shortcut);
    addSetValue(current.locations, row.location);
    byId.set(id, current);
  });

  commands.filter((command) => command?.userVisible !== false).forEach((command) => {
    const id = clean(command.id);
    if (!id) return;
    const current = byId.get(id) || {
      id,
      label: clean(command.label, id),
      description: "",
      category: "",
      shortcuts: new Set(),
      locations: new Set(),
    };
    current.label = clean(command.label, current.label);
    current.description = clean(command.description, current.description);
    current.category = clean(command.category, current.category);
    byId.set(id, current);
  });

  return Array.from(byId.values()).map((row) => ({
    ...row,
    shortcuts: Array.from(row.shortcuts),
    locations: Array.from(row.locations),
  })).sort((a, b) =>
    clean(a.category || a.locations[0]).localeCompare(clean(b.category || b.locations[0])) ||
    clean(a.label).localeCompare(clean(b.label))
  );
}

export async function loadControlsRows({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  toolbarFiles = TOOLBAR_METADATA_FILES,
  commands = NODEVISION_SHARED_COMMANDS,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Controls metadata requires fetch().");
  return mergeControlsRows({ commands, toolbarRows: await loadToolbarRows(fetchImpl, toolbarFiles) });
}
