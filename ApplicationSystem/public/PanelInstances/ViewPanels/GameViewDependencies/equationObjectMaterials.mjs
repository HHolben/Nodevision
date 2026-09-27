// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationObjectMaterials.mjs
// This module manages the equation form material catalog and preserves material and liquid choices while catalog data loads asynchronously.

import { DEFAULT_WORLD_OBJECT_MATERIAL_ID, loadWorldObjectMaterialCatalog,
  readWorldObjectMatterState } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";
import { DEFAULT_MATERIAL_OPTION, materialOptionValue, materialEntryMatchesHint,
  isLiquidMaterialEntry } from "./equationObjectDefaults.mjs";

// Catalog identity stays separate from the DOM form's numeric state.
export function createEquationMaterialSelection(select, onCatalogLoaded) {
  let materialCatalog = [DEFAULT_MATERIAL_OPTION];
  let materialSelectionHint = null;
  let disposed = false;
  function findMaterialEntry(hint = {}) {
    const entries = materialCatalog.length > 0 ? materialCatalog : [DEFAULT_MATERIAL_OPTION];
    if (typeof hint === "string") {
      const selected = entries.find((entry) => materialOptionValue(entry) === hint || entry.materialId === hint);
      if (selected) return selected;
    } else {
      const exact = entries.find((entry) => materialEntryMatchesHint(entry, hint));
      if (exact) return exact;
      if (readWorldObjectMatterState(hint) === "liquid") {
        const liquid = entries.find(isLiquidMaterialEntry);
        if (liquid) return liquid;
      }
    }
    return entries.find((entry) => entry.materialId === DEFAULT_WORLD_OBJECT_MATERIAL_ID) || entries[0] || DEFAULT_MATERIAL_OPTION;
  }

  function populateMaterialSelect(hint = materialSelectionHint || select.value) {
    const selectedEntry = findMaterialEntry(hint || {});
    select.innerHTML = "";
    (materialCatalog.length > 0 ? materialCatalog : [DEFAULT_MATERIAL_OPTION]).forEach((entry) => {
      const option = document.createElement("option");
      option.value = materialOptionValue(entry);
      option.textContent = entry.materialName || entry.displayName || entry.materialId || option.value;
      select.appendChild(option);
    });
    select.value = materialOptionValue(selectedEntry);
  }

  function getSelectedMaterialEntry() {
    return findMaterialEntry(select.value);
  }

  function setMaterialSelection(hint = {}) {
    materialSelectionHint = hint;
    populateMaterialSelect(hint);
  }

  populateMaterialSelect();
  void loadWorldObjectMaterialCatalog()
    .then((catalog) => {
      if (disposed) return;
      if (Array.isArray(catalog) && catalog.length > 0) materialCatalog = catalog;
      populateMaterialSelect(materialSelectionHint || select.value);
      onCatalogLoaded();
    })
    .catch((err) => console.warn("Equation object material catalog failed to load:", err));


  return {
    getSelectedMaterialEntry,
    setMaterialSelection,
    get catalog() { return materialCatalog; },
    set hint(value) { materialSelectionHint = value; },
    liquidInfinite: true,
    dispose() { disposed = true; },
  };
}
