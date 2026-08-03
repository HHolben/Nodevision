// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/LinkViewerStyles.mjs
// This module provides the scoped stylesheet string used by the Link Viewer information panel.

export function linkViewerPanelCss() {
  return `
    .nv-link-panel {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 100%;
      color: #172033;
      font: 13px system-ui, sans-serif;
    }
    .nv-link-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      border-bottom: 1px solid #d8dee9;
      padding-bottom: 8px;
    }
    .nv-link-title {
      font-size: 15px;
      font-weight: 700;
    }
    .nv-link-subtitle,
    .nv-link-muted,
    .nv-link-foot {
      color: #64748b;
    }
    .nv-link-section {
      display: grid;
      gap: 8px;
    }
    .nv-link-row {
      display: grid;
      grid-template-columns: minmax(88px, 0.34fr) minmax(0, 1fr);
      gap: 10px;
      align-items: start;
    }
    .nv-link-label {
      color: #475569;
      font-weight: 650;
    }
    .nv-link-label-spaced {
      margin-top: 4px;
    }
    .nv-link-value {
      min-width: 0;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .nv-link-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .nv-link-chip {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      border-radius: 6px;
      padding: 2px 6px;
    }
    .nv-link-select,
    .nv-link-btn {
      font: inherit;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #172033;
      border-radius: 6px;
    }
    .nv-link-select {
      width: 100%;
      padding: 6px 8px;
    }
    .nv-link-btn {
      padding: 5px 9px;
      cursor: pointer;
    }
    .nv-link-empty {
      color: #64748b;
      padding: 8px 0;
    }
    .nv-link-foot {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      font-size: 12px;
    }
  `;
}
