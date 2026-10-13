// Nodevision/ApplicationSystem/public/CursorFamilies/ContextualCursorStyle.mjs
// This module installs the existing contextual Cursor widget appearance once per document, independently of semantic tool state.

const STYLE_ID = "nv-contextual-cursor-family-style";

export function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .nv-cursor-family-widget {
      position: relative;
      display: inline-flex;
      align-items: stretch;
      height: 30px;
      margin: 0 2px;
      border: 1px solid rgba(70, 92, 75, 0.55);
      border-radius: 6px;
      background: #f8faf8;
      overflow: visible;
    }
    .nv-cursor-family-main,
    .nv-cursor-family-menu-button {
      border: 0;
      background: transparent;
      color: #1f2a24;
      cursor: pointer;
      min-width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      font: inherit;
      padding: 0 7px;
    }
    .nv-cursor-family-main:hover,
    .nv-cursor-family-menu-button:hover { background: rgba(98, 138, 109, 0.16); }
    .nv-cursor-family-menu-button { width: 20px; min-width: 20px; padding: 0; border-left: 1px solid rgba(70, 92, 75, 0.28); }
    .nv-cursor-family-glyph { font-weight: 700; min-width: 16px; text-align: center; }
    .nv-cursor-family-label { max-width: 86px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
    .nv-cursor-family-dropdown {
      position: absolute;
      top: calc(100% + 3px);
      left: 0;
      min-width: 184px;
      z-index: 10000;
      display: none;
      padding: 4px;
      border: 1px solid rgba(70, 92, 75, 0.45);
      border-radius: 6px;
      background: #ffffff;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    }
    .nv-cursor-family-widget[data-open="true"] .nv-cursor-family-dropdown { display: block; }
    .nv-cursor-family-option {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      border: 0;
      background: transparent;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      text-align: left;
      color: #1f2a24;
      font-size: 12px;
    }
    .nv-cursor-family-option:hover { background: rgba(98, 138, 109, 0.14); }
    .nv-cursor-family-option[aria-checked="true"] { background: rgba(47, 128, 255, 0.15); font-weight: 600; }
    .nv-cursor-family-option-kind { margin-left: auto; color: #607064; font-size: 11px; }
  `;
  document.head.appendChild(style);
}

