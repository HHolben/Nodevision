// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationObjectsPanel.mjs
// This module composes the equation-object form, material selection, mesh updates, and layer synchronization into a dockable virtual-world editing panel.

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";
import { DEFAULT_PLANE, parseAxisInequality, isLiquidMaterialEntry } from "./equationObjectDefaults.mjs";
import { syncEquationLayer } from "./equationObjectLayers.mjs";
import { createEquationMaterialSelection } from "./equationObjectMaterials.mjs";
import { createEquationObjectFormView } from "./equationObjectFormView.mjs";
import { createEquationQuickInput } from "./equationObjectQuickInput.mjs";
import { createEquationFormConfig } from "./equationObjectFormConfig.mjs";
import { createEquationObjectMutations } from "./equationObjectMutations.mjs";

// The panel owns visibility, placement, and listener cleanup.
export function createEquationObjectsPanel({ THREE, controller, colliders, waterVolumes, hostPanel = null, canvas = null }) {
  let visible = false;
  let activeTarget = null;

  const floatingPanel = createFloatingInventoryPanel({
    title: "Equation / Inequality Objects",
    closeBehavior: "hide",
    onRequestClose: () => {
      visible = false;
      activeTarget = null;
      floatingPanel.setVisible(false);
    }
  });
  floatingPanel.setVisible(false);

  function getAnchorRect() {
    const rect = canvas?.getBoundingClientRect?.() || hostPanel?.getBoundingClientRect?.() || null;
    if (rect && rect.width > 0 && rect.height > 0) return rect;
    return { left: 0, top: 96, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: Math.max(320, window.innerHeight - 96) };
  }

  function attachAsRightPane() {
    const rect = getAnchorRect();
    const width = Math.min(420, Math.max(340, rect.width * 0.34));
    Object.assign(floatingPanel.panel.style, {
      position: "fixed",
      left: Math.max(0, rect.right - width) + "px",
      top: Math.max(0, rect.top) + "px",
      width: "var(--nv-equation-panel-width, " + width + "px)",
      minWidth: "var(--nv-equation-panel-min-width, 320px)",
      maxWidth: Math.max(340, rect.width) + "px",
      height: "var(--nv-equation-panel-height, " + Math.max(320, rect.height) + "px)",
      maxHeight: Math.max(320, rect.height) + "px",
      borderLeft: "var(--nv-equation-panel-border, 1px solid rgba(97, 214, 214, 0.55))",
      boxShadow: "var(--nv-equation-panel-shadow, -12px 0 26px rgba(0, 0, 0, 0.32))",
      zIndex: "22030"
    });
  }

  function showAttachedPane() {
    visible = true;
    floatingPanel.setVisible(true);
    floatingPanel.undock();
    attachAsRightPane();
  }

  const handleWindowResize = () => {
    if (visible) attachAsRightPane();
  };
  window.addEventListener("resize", handleWindowResize);

  // Compose independent view, catalog, form, and world-mutation modules.
  const fields = createEquationObjectFormView(floatingPanel.content);
  const {
    quickInequalityInput, aInput, bInput, cInput, dInput,
    boundXInput, boundYInput, boundZInput, colliderInput, materialSelect,
    waterSideSelect, statusLine, insertBtn, applyBtn, closeBtn,
  } = fields;
  const materials = createEquationMaterialSelection(materialSelect, () => quick.refreshWaterControls());
  const quick = createEquationQuickInput(fields, materials, () => activeTarget);
  const form = createEquationFormConfig(fields, materials, quick);
  const { applyToTarget } = createEquationObjectMutations({ THREE, colliders, waterVolumes, fields, form, quick });
  const { readConfig, setConfig } = form;
  const { prepareQuickInequality, updateEquationLine, refreshWaterControls, refreshBoundControls } = quick;
  const { getSelectedMaterialEntry } = materials;

  // User actions use the same configuration and update paths.
  [aInput, bInput, cInput, dInput].forEach((input) => input.addEventListener("input", () => {
    quickInequalityInput.value = "";
    updateEquationLine();
    refreshWaterControls();
  }));
  quickInequalityInput.addEventListener("change", () => {
    if (prepareQuickInequality()) {
      const parsed = parseAxisInequality(quickInequalityInput.value);
      statusLine.textContent = isLiquidMaterialEntry(getSelectedMaterialEntry())
        ? "Liquid inequality volume prepared."
        : (parsed?.inequality === true ? "Inequality volume prepared." : "Equation plane prepared.");
    }
  });
  materialSelect.addEventListener("change", () => {
    materials.hint = materialSelect.value;
    if (isLiquidMaterialEntry(getSelectedMaterialEntry())) {
      colliderInput.checked = false;
      materials.liquidInfinite = true;
      statusLine.textContent = "Liquid material uses this equation as a volume bound.";
    }
    refreshWaterControls();
  });
  waterSideSelect.addEventListener("change", refreshWaterControls);
  [boundXInput, boundYInput, boundZInput].forEach((input) => input.addEventListener("change", refreshBoundControls));

  insertBtn.addEventListener("click", () => {
    if (!prepareQuickInequality()) return;
    const config = readConfig();
    const mesh = controller?.addPlane?.(config);
    if (mesh) {
      activeTarget = mesh;
      statusLine.textContent = config.isLiquid ? "Liquid inequality volume inserted." : (config.inequality ? "Equation inequality volume inserted." : "Equation object plane inserted.");
      void syncEquationLayer(mesh, config.isLiquid ? "liquidEquationLayerAdded" : "equationObjectLayerAdded");
      setConfig(mesh.userData.equationCollider, mesh);
    } else {
      statusLine.textContent = "Open a Meta World editor before inserting.";
    }
  });

  applyBtn.addEventListener("click", () => {
    if (!activeTarget) {
      statusLine.textContent = "No equation object selected.";
      return;
    }
    applyToTarget(activeTarget);
  });

  closeBtn.addEventListener("click", () => {
    visible = false;
    activeTarget = null;
    floatingPanel.setVisible(false);
  });

  setConfig(DEFAULT_PLANE);

  return {
    open(config = DEFAULT_PLANE) {
      activeTarget = null;
      setConfig(config);
      statusLine.textContent = "Configure an equation or inequality object, then insert it into the world.";
      showAttachedPane();
    },
    openForTarget(target) {
      if (!target) return false;
      void syncEquationLayer(target, "equationObjectLayerRecovered");
      activeTarget = target;
      setConfig(target.userData?.equationCollider || DEFAULT_PLANE, target);
      statusLine.textContent = "Edit the selected equation object.";
      showAttachedPane();
      return true;
    },
    isVisible() {
      return visible;
    },
    syncTargetLayer(target, reason = "equationObjectUpdated") {
      void syncEquationLayer(target, reason);
      return true;
    },
    dispose() {
      window.removeEventListener("resize", handleWindowResize);
      materials.dispose();
      floatingPanel.dispose();
    }
  };
}
