// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CraftAbilities/VoxelDialogUiAbility.mjs
// This file defines small DOM helpers for the Voxel Placer dialog. It keeps UI construction reusable so the craft ability can focus on applying voxel settings.

import { installMovementApi } from "../movementContext.mjs";

export function installVoxelDialogUiAbility(ctx) {
  const { movementState } = ctx;

  function closeVoxelPlacerDialog() {
    const panel = movementState.voxelPlacerDialog;
    if (panel?.parentNode) panel.parentNode.removeChild(panel);
    movementState.voxelPlacerDialog = null;
  }

  function addVoxelDialogRow(form, labelText, control) {
    const label = document.createElement("label");
    Object.assign(label.style, {
      display: "grid",
      gridTemplateColumns: "90px minmax(0, 1fr)",
      alignItems: "center",
      gap: "10px",
      color: "#d9f7ef",
      font: "12px/1.3 system-ui, sans-serif"
    });
    const span = document.createElement("span");
    span.textContent = labelText;
    span.style.color = "rgba(230, 255, 247, 0.82)";
    label.appendChild(span);
    label.appendChild(control);
    form.appendChild(label);
    return label;
  }

  function styleVoxelDialogControl(control) {
    Object.assign(control.style, {
      width: "100%",
      boxSizing: "border-box",
      borderRadius: "6px",
      border: "1px solid rgba(132, 211, 190, 0.72)",
      background: "rgba(6, 22, 28, 0.95)",
      color: "#f0fffb",
      padding: "7px 8px",
      font: "12px/1.2 system-ui, sans-serif"
    });
  }

  function createVoxelDialogShell() {
    const overlay = document.createElement("div");
    movementState.voxelPlacerDialog = overlay;
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "26000",
      display: "grid",
      placeItems: "center",
      background: "rgba(1, 9, 12, 0.42)",
      pointerEvents: "auto"
    });
    const panel = document.createElement("form");
    Object.assign(panel.style, {
      width: "min(360px, calc(100vw - 32px))",
      borderRadius: "8px",
      border: "1px solid rgba(153, 236, 214, 0.82)",
      background: "linear-gradient(180deg, rgba(12, 36, 43, 0.98), rgba(4, 18, 24, 0.98))",
      boxShadow: "0 18px 52px rgba(0, 0, 0, 0.48)",
      padding: "14px",
      color: "#f0fffb",
      font: "12px/1.4 system-ui, sans-serif"
    });
    overlay.appendChild(panel);
    const title = document.createElement("div");
    title.textContent = "Voxel Placer";
    Object.assign(title.style, { marginBottom: "12px", color: "#f6fffc", font: "700 16px/1.2 system-ui, sans-serif" });
    panel.appendChild(title);
    return { overlay, panel };
  }

  function createVoxelDialogButton(label, primary = false) {
    const button = document.createElement("button");
    button.type = primary ? "submit" : "button";
    button.textContent = label;
    Object.assign(button.style, {
      borderRadius: "6px",
      border: "1px solid rgba(171, 240, 222, 0.8)",
      background: primary ? "#7edfc2" : "rgba(8, 31, 38, 0.9)",
      color: primary ? "#062018" : "#e8fff8",
      padding: "7px 12px",
      font: "700 12px/1 system-ui, sans-serif",
      cursor: "pointer"
    });
    return button;
  }

  return installMovementApi(ctx, {
    closeVoxelPlacerDialog,
    addVoxelDialogRow,
    styleVoxelDialogControl,
    createVoxelDialogShell,
    createVoxelDialogButton
  });
}
