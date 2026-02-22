function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function fileActionModuleCandidates(actionKey = "") {
  const key = String(actionKey || "").trim();
  if (!key) return [];

  const capitalized = `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  const legacyAliases = {
    renameFile: ["RenameFile"],
    copyFile: ["CopyFIle", "CopyFile"],
    cutFile: ["CutFile"],
    pasteFile: ["PasteFile"]
  };
  const aliases = legacyAliases[key] || [];
  const names = uniqueValues([key, capitalized, ...aliases]);
  return names.map((name) => `/ToolbarCallbacks/file/${name}.mjs`);
}

export async function handleAction(actionKey) {
  const modulePaths = fileActionModuleCandidates(actionKey);
  let lastError = null;

  for (const modulePath of modulePaths) {
    try {
      const mod = await import(modulePath);
      if (typeof mod.default === "function") {
        await mod.default();
        return;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error(`No callback module found for action "${actionKey}"`);
}
