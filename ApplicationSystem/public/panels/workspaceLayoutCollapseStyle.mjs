// Nodevision/ApplicationSystem/public/panels/workspaceLayoutCollapseStyle.mjs
// This module installs the small stylesheet used by collapsible workspace layout divider controls. It keeps the collapse feature styling self-contained so the oversized legacy layout stylesheet does not grow further.

const STYLE_ID = "nv-workspace-layout-collapse-style";
const CSS = `
.nv-layout-child--collapsed { overflow: hidden !important; pointer-events: none; visibility: hidden; border-color: transparent !important; }
.nv-layout-divider-controls { position: absolute; left: 50%; top: 50%; z-index: 130; display: inline-flex; align-items: center; justify-content: center; gap: 1px; width: 64px; height: 58px; transform: translate(-50%, -50%); opacity: 0; pointer-events: auto; transition: opacity 140ms ease; cursor: col-resize; }
.nv-layout-divider-controls[data-orientation="vertical"] { flex-direction: column; width: 58px; height: 64px; cursor: row-resize; }
.layout-divider:hover > .nv-layout-divider-controls, .divider:hover > .nv-layout-divider-controls, .row-divider:hover > .nv-layout-divider-controls, .nv-layout-divider-controls:hover, .layout-divider:focus-within > .nv-layout-divider-controls, .divider:focus-within > .nv-layout-divider-controls, .row-divider:focus-within > .nv-layout-divider-controls { opacity: 1; }
.nv-layout-collapse-button { width: 17px; height: 17px; padding: 0; border: 1px solid var(--nv-layout-divider-hover-background, #8a8a8a); border-radius: 3px; color: var(--nv-layout-collapse-button-color, #1f2933); background: var(--nv-layout-collapse-button-background, #f4f4f4); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22); font: 10px/15px var(--nv-ui-font-family, system-ui, sans-serif); text-align: center; cursor: pointer; opacity: 1; pointer-events: none; }
.layout-divider:hover .nv-layout-collapse-button, .divider:hover .nv-layout-collapse-button, .row-divider:hover .nv-layout-collapse-button, .nv-layout-divider-controls:hover .nv-layout-collapse-button, .nv-layout-divider-controls:focus-within .nv-layout-collapse-button { pointer-events: auto; }
.nv-layout-collapse-button:hover, .nv-layout-collapse-button:focus-visible { opacity: 1; outline: 1px solid var(--nv-layout-divider-hover-background, #0078d7); outline-offset: 1px; background: var(--nv-layout-collapse-button-hover-background, #e7f1ff); }
.nv-layout-collapse-button:disabled { cursor: default; opacity: 0.24; }
html[data-nv-theme="dark"] .nv-layout-collapse-button { border-color: #64748b; color: #f8fafc; background: #1f2937; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.55); }
html[data-nv-theme="dark"] .nv-layout-collapse-button:hover, html[data-nv-theme="dark"] .nv-layout-collapse-button:focus-visible { background: #334155; outline-color: #93c5fd; }
`;

export function ensureWorkspaceLayoutCollapseStyles() {
  if (typeof document === "undefined" || document.getElementById?.(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head?.appendChild(style);
}

ensureWorkspaceLayoutCollapseStyles();
