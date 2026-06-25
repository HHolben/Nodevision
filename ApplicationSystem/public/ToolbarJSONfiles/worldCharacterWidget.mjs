// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/worldCharacterWidget.mjs
// Renders the Insert > Character sub-toolbar for adding character wiki pages to MetaWorld scenes.

import { setStatus } from "/StatusBar.mjs";
import { cleanNotebookPath, isHtmlWorldPath, selectedWorldPath } from "/PanelInstances/EditorPanels/MetaWorldImportComponents/assetTypes.mjs";
import { importNotebookCharacter, listNotebookCharacters } from "/PanelInstances/EditorPanels/MetaWorldImportComponents/importAssetApi.mjs";

function refreshWorldViewport(worldPath) {
  const loader = window.VRWorldContext?.loadWorldFromFile;
  if (typeof loader === "function") {
    return loader(worldPath, { reason: "character-import" });
  }
  document.dispatchEvent(new CustomEvent("fileSelected", { detail: { filePath: worldPath } }));
  return Promise.resolve(false);
}

function optionLabel(character) {
  const level = Number.isFinite(character?.level) ? `level ${character.level}` : "level 0";
  return `${character?.name || character?.id || "Character"} (${level}) - ${character?.notebookPath || ""}`;
}

function createSelect(characters) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Character wiki page");
  characters.forEach((character) => {
    const option = document.createElement("option");
    option.value = character.notebookPath;
    option.textContent = optionLabel(character);
    select.appendChild(option);
  });
  return select;
}

function createRoleSelect() {
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Character role");
  [
    ["npc", "NPC"],
    ["playable", "Playable"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  return select;
}

function createPlacementSelect() {
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Placement");
  [
    ["origin", "Origin"],
    ["camera-target", "Camera Target"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  });
  return select;
}

function renderReady(hostElement, characters) {
  hostElement.innerHTML = "";
  hostElement.classList.add("nv-world-character-toolbar");

  const worldPath = cleanNotebookPath(selectedWorldPath());
  if (!isHtmlWorldPath(worldPath)) {
    hostElement.appendChild(document.createTextNode("Select a MetaWorld HTML file before inserting characters."));
    setStatus("Select a MetaWorld HTML file before inserting characters.");
    return;
  }

  if (!characters.length) {
    hostElement.appendChild(document.createTextNode("No character wiki pages found in the Notebook."));
    setStatus("No character wiki pages found in the Notebook.");
    return;
  }

  const characterSelect = createSelect(characters);
  const roleSelect = createRoleSelect();
  const placementSelect = createPlacementSelect();
  const insertButton = document.createElement("button");
  insertButton.type = "button";
  insertButton.textContent = "Insert Character";

  insertButton.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const target = cleanNotebookPath(selectedWorldPath());
    if (!isHtmlWorldPath(target)) {
      setStatus("Select a MetaWorld HTML file before inserting characters.");
      return;
    }

    insertButton.disabled = true;
    try {
      const result = await importNotebookCharacter({
        worldPath: target,
        characterPath: characterSelect.value,
        placement: placementSelect.value,
        role: roleSelect.value,
      });
      await refreshWorldViewport(target);
      setStatus(`${result.character?.name || "Character"} inserted into MetaWorld.`);
    } catch (err) {
      setStatus(err?.message || "Failed to insert character.");
    } finally {
      insertButton.disabled = false;
    }
  });

  const label = document.createElement("span");
  label.textContent = "Character";
  hostElement.append(label, characterSelect, roleSelect, placementSelect, insertButton);
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  hostElement.innerHTML = "Loading characters...";
  hostElement.classList.add("nv-world-character-toolbar");
  void listNotebookCharacters()
    .then((characters) => renderReady(hostElement, characters))
    .catch((err) => {
      hostElement.textContent = err?.message || "Failed to load characters.";
      setStatus(err?.message || "Failed to load characters.");
    });
}
