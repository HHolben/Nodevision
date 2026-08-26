// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapStyles.mjs
// This module installs the scoped styles used by the reusable image-map editor overlay.

const STYLE_ID = "nv-image-map-editor-style";

// ------------------------------
// Style installation
// ------------------------------
export function ensureImageMapEditorStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .nv-image-map-editor{height:100%;min-height:0;display:flex;flex-direction:column;background:#f7f8fa;color:#18202f;font:13px system-ui,sans-serif;}
    .nv-image-map-header{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #cfd6e0;background:#ffffff;flex:0 0 auto;}
    .nv-image-map-tools{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
    .nv-image-map-button{border:1px solid #8b97a8;background:#ffffff;color:#18202f;padding:6px 10px;min-height:32px;border-radius:4px;cursor:pointer;font:12px system-ui,sans-serif;}
    .nv-image-map-button[data-active=true]{background:#1f6fbf;color:#ffffff;border-color:#155a9e;}
    .nv-image-map-button:disabled{opacity:.48;cursor:not-allowed;}
    .nv-image-map-body{display:grid;grid-template-columns:minmax(320px,1fr) 300px;gap:0;min-height:0;flex:1 1 auto;}
    .nv-image-map-stage-wrap{min-height:0;overflow:auto;padding:12px;background:#e9edf2;}
    .nv-image-map-stage{position:relative;display:inline-block;max-width:100%;background:#ffffff;border:1px solid #9ba7b7;}
    .nv-image-map-stage img{display:block;max-width:min(100%,900px);max-height:70vh;width:auto;height:auto;}
    .nv-image-map-svg{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair;}
    .nv-image-map-region{fill:rgba(31,111,191,.18);stroke:#1f6fbf;stroke-width:2;vector-effect:non-scaling-stroke;}
    .nv-image-map-region[data-selected=true]{fill:rgba(204,59,59,.2);stroke:#cc3b3b;}
    .nv-image-map-handle{fill:#050505;stroke:#ffffff;stroke-width:1.5;vector-effect:non-scaling-stroke;cursor:pointer;}
    .nv-image-map-side{border-left:1px solid #cfd6e0;background:#ffffff;min-height:0;overflow:auto;padding:12px;box-sizing:border-box;}
    .nv-image-map-fields{display:flex;flex-direction:column;gap:8px;}
    .nv-image-map-fields label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#2f3a4a;}
    .nv-image-map-fields input,.nv-image-map-fields select{border:1px solid #aeb8c6;border-radius:4px;min-height:30px;padding:4px 7px;font:12px system-ui,sans-serif;box-sizing:border-box;width:100%;}
    .nv-image-map-inline{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:end;}
    .nv-image-map-status{min-height:18px;color:#9b1c1c;font-size:12px;}
    .nv-image-map-picker{height:100%;display:flex;flex-direction:column;gap:10px;padding:12px;box-sizing:border-box;background:#ffffff;}
    .nv-image-map-picker-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
    .nv-image-map-manager{flex:1 1 auto;min-height:280px;border:1px solid #cfd6e0;overflow:auto;}
    @media (max-width:760px){.nv-image-map-body{grid-template-columns:1fr;}.nv-image-map-side{border-left:0;border-top:1px solid #cfd6e0;}.nv-image-map-stage img{max-height:52vh;}}
  `;
  document.head.appendChild(style);
}

export function imageMapButton(label, options = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nv-image-map-button";
  button.textContent = label;
  if (options.active) button.dataset.active = "true";
  if (options.disabled) button.disabled = true;
  return button;
}
