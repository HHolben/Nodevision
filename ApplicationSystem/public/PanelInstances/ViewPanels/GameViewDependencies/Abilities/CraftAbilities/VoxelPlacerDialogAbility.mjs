// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CraftAbilities/VoxelPlacerDialogAbility.mjs
// This file defines the Voxel Placer settings ability for Game View. It presents editable voxel size, material, color, and collider options while preserving offline browser-side configuration.

import { setStatus } from "/StatusBar.mjs";
import { materialFileForWorldObjectMaterial } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installVoxelPlacerDialogAbility(ctx) {
  const { controls, movementState } = ctx;

  function createSizeInput(config) {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0.05";
    input.max = "20";
    input.step = "0.05";
    input.value = String(config.size);
    ctx.api.styleVoxelDialogControl(input);
    return input;
  }

  function createColorInput(config) {
    const input = document.createElement("input");
    input.type = "color";
    input.value = ctx.api.normalizeVoxelColor(config.color);
    Object.assign(input.style, {
      width: "100%",
      height: "34px",
      boxSizing: "border-box",
      borderRadius: "6px",
      border: "1px solid rgba(132, 211, 190, 0.72)",
      background: "rgba(6, 22, 28, 0.95)",
      padding: "3px"
    });
    return input;
  }

  function createAlphaInput(config) {
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.step = "1";
    input.value = String(Math.round(ctx.api.normalizeVoxelOpacity(config.opacity) * 100));
    ctx.api.styleVoxelDialogControl(input);
    const value = document.createElement("span");
    value.style.minWidth = "36px";
    value.style.color = "#f0fffb";
    value.style.fontSize = "12px";
    const wrap = document.createElement("div");
    Object.assign(wrap.style, { display: "flex", alignItems: "center", gap: "8px" });
    const sync = () => {
      const alpha = Math.round(ctx.api.normalizeVoxelOpacity(Number(input.value) / 100) * 100);
      input.value = String(alpha);
      value.textContent = alpha + "%";
    };
    input.addEventListener("input", sync);
    sync();
    wrap.append(input, value);
    return { input, wrap };
  }

  function createColliderInput(config) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = config.collider !== false;
    input.style.width = "18px";
    input.style.height = "18px";
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";
    wrap.appendChild(input);
    const text = document.createElement("span");
    text.textContent = "Collider";
    text.style.color = "#f0fffb";
    wrap.appendChild(text);
    return { input, wrap };
  }

  function createFaceCenterSnapInput(config) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = config.faceCenterSnap === true;
    input.style.width = "18px";
    input.style.height = "18px";
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";
    wrap.appendChild(input);
    const text = document.createElement("span");
    text.textContent = "Snap to target face";
    text.style.color = "#f0fffb";
    wrap.appendChild(text);
    return { input, wrap };
  }

  function populateMaterialOptions(materialSelect, entries, config) {
    const catalog = Array.isArray(entries) ? entries : [];
    materialSelect.textContent = "";
    const source = catalog.length ? catalog : [{
      materialId: config.materialId,
      materialFile: config.materialFile,
      displayName: config.materialName || "Physics Solid",
      color: config.color,
      matterState: config.matterState
    }];
    source.forEach((entry) => {
      const option = document.createElement("option");
      option.value = String(entry.materialId || entry.materialName || "");
      option.textContent = String(entry.displayName || entry.materialName || entry.materialId || "Material");
      materialSelect.appendChild(option);
    });
    materialSelect.value = ctx.api.findVoxelMaterialEntry(config.materialId, source)?.materialId || source[0]?.materialId || config.materialId;
    ctx.api.applyVoxelMaterialEntry(config, ctx.api.findVoxelMaterialEntry(materialSelect.value, source), { updateColor: false });
    return catalog;
  }

  function openVoxelPlacerDialog() {
    if (movementState.worldMode === "2d") return false;
    if (!ctx.api.canUseAbility("allowToolUse")) return false;
    if (movementState.voxelPlacerDialog?.isConnected) {
      movementState.voxelPlacerDialog.querySelector("input, select, button")?.focus?.();
      return true;
    }
    const config = ctx.api.ensureVoxelPlacerConfig();
    const { overlay, panel } = ctx.api.createVoxelDialogShell();
    const sizeInput = createSizeInput(config);
    ctx.api.addVoxelDialogRow(panel, "Size", sizeInput);
    const materialSelect = document.createElement("select");
    ctx.api.styleVoxelDialogControl(materialSelect);
    ctx.api.addVoxelDialogRow(panel, "Material", materialSelect);
    const colorInput = createColorInput(config);
    ctx.api.addVoxelDialogRow(panel, "Color", colorInput);
    const alphaControl = createAlphaInput(config);
    ctx.api.addVoxelDialogRow(panel, "Alpha", alphaControl.wrap);
    const { input: colliderInput, wrap: colliderWrap } = createColliderInput(config);
    ctx.api.addVoxelDialogRow(panel, "Physics", colliderWrap);
    const { input: faceCenterSnapInput, wrap: faceCenterSnapWrap } = createFaceCenterSnapInput(config);
    ctx.api.addVoxelDialogRow(panel, "Placement", faceCenterSnapWrap);
    const actions = document.createElement("div");
    Object.assign(actions.style, { display: "flex", justifyContent: "end", gap: "8px", marginTop: "14px" });
    panel.appendChild(actions);
    const closeButton = ctx.api.createVoxelDialogButton("Close", false);
    const applyButton = ctx.api.createVoxelDialogButton("Apply", true);
    actions.append(closeButton, applyButton);
    let catalog = populateMaterialOptions(materialSelect, [], config);
    const selectedEntryFromControl = () => ctx.api.findVoxelMaterialEntry(materialSelect.value, catalog) || {
      materialId: materialSelect.value || config.materialId,
      materialFile: materialFileForWorldObjectMaterial(materialSelect.value || config.materialId),
      displayName: materialSelect.selectedOptions?.[0]?.textContent || materialSelect.value || config.materialName,
      color: colorInput.value,
      matterState: config.matterState
    };
    materialSelect.addEventListener("change", () => {
      ctx.api.applyVoxelMaterialEntry(config, selectedEntryFromControl(), { updateColor: true });
      colorInput.value = ctx.api.normalizeVoxelColor(config.color);
    });
    panel.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = ctx.api.ensureVoxelPlacerConfig();
      next.size = ctx.api.normalizeVoxelSize(sizeInput.value);
      next.color = ctx.api.normalizeVoxelColor(colorInput.value, next.color);
      next.opacity = ctx.api.normalizeVoxelOpacity(Number(alphaControl.input.value) / 100, next.opacity);
      next.collider = colliderInput.checked;
      next.faceCenterSnap = faceCenterSnapInput.checked;
      ctx.api.applyVoxelMaterialEntry(next, selectedEntryFromControl(), { updateColor: false });
      movementState.voxelPlacerConfig = { ...next };
      setStatus("Voxel Placer updated: size " + next.size + ", " + (next.collider ? "collider" : "visual only") + (next.faceCenterSnap ? ", target-face snap" : "") + ".");
      ctx.api.closeVoxelPlacerDialog();
    });
    closeButton.addEventListener("click", ctx.api.closeVoxelPlacerDialog);
    overlay.addEventListener("pointerdown", (event) => {
      if (event.target === overlay) ctx.api.closeVoxelPlacerDialog();
    });
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    panel.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        ctx.api.closeVoxelPlacerDialog();
      }
      event.stopPropagation();
    });
    void ctx.api.ensureVoxelMaterialCatalog().then((entries) => {
      catalog = populateMaterialOptions(materialSelect, entries, config);
    });
    document.body.appendChild(overlay);
    controls?.unlock?.();
    window.setTimeout(() => sizeInput.focus(), 0);
    return true;
  }

  return installMovementApi(ctx, {
    createSizeInput,
    createColorInput,
    createAlphaInput,
    createColliderInput,
    createFaceCenterSnapInput,
    populateMaterialOptions,
    openVoxelPlacerDialog
  });
}
