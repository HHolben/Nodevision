// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/TemplatePanelStyles.mjs
// This module installs the scoped stylesheet used by the Template Panel overlay.

const STYLE_ID = "nv-template-panel-styles";

export function ensureTemplatePanelStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-template-panel {
  box-sizing: border-box;
  display: grid;
  gap: 12px;
  min-height: 340px;
  padding: 16px;
  color: #1f2937;
  background: #f8fafc;
}

.nv-template-panel-search {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 10px;
  color: #111827;
  background: #fff;
  border: 1px solid #9ca3af;
  border-radius: 6px;
  font: inherit;
}

.nv-template-panel-search:focus {
  outline: 2px solid rgba(0, 120, 215, 0.45);
  border-color: #0078d7;
}

.nv-template-panel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
  align-content: start;
  min-height: 220px;
  max-height: 430px;
  overflow: auto;
  padding: 2px;
}

.nv-template-panel-card {
  min-height: 122px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 8px;
  text-align: left;
  color: #111827;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
}

.nv-template-panel-card:hover,
.nv-template-panel-card:focus {
  outline: 2px solid rgba(0, 120, 215, 0.45);
  border-color: #0078d7;
}

.nv-template-panel-name {
  font-size: 13px;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.nv-template-panel-path {
  color: #64748b;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.nv-template-panel-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.nv-template-panel-badge {
  padding: 3px 7px;
  color: #075985;
  background: #e0f2fe;
  border: 1px solid #7dd3fc;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
}

.nv-template-panel-empty,
.nv-template-panel-error {
  padding: 14px;
  color: #475569;
  border: 1px dashed #94a3b8;
  border-radius: 6px;
}

.nv-template-panel-error {
  color: #b91c1c;
}

.nv-template-panel-actions {
  display: flex;
  justify-content: flex-end;
}

.nv-template-panel-actions button {
  border: 1px solid #6b7280;
  border-radius: 6px;
  padding: 8px 13px;
  background: #fff;
  color: #111827;
  font: inherit;
  cursor: pointer;
}

html[data-nv-theme="dark"] .nv-template-panel {
  color: #e5e7eb;
  background: #0f172a;
}

html[data-nv-theme="dark"] .nv-template-panel-search,
html[data-nv-theme="dark"] .nv-template-panel-card,
html[data-nv-theme="dark"] .nv-template-panel-actions button {
  color: #e5e7eb;
  background: #111827;
  border-color: #475569;
}

html[data-nv-theme="dark"] .nv-template-panel-path,
html[data-nv-theme="dark"] .nv-template-panel-empty {
  color: #cbd5e1;
}
`;
  document.head.appendChild(style);
}
