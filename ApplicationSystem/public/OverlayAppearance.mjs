// Nodevision/ApplicationSystem/public/OverlayAppearance.mjs
// This module supplies shared, user-overridable appearance defaults for lightweight application overlays and their buttons. CSS custom properties allow local themes to change colors, typography, spacing, and dimensions without altering overlay behavior.

// Appearance values are inherited from the document's custom properties.
export function applyOverlayAppearance(element) {
  Object.assign(element.style, {
    background: "var(--nv-overlay-background, #fff)",
    color: "var(--nv-overlay-color, #172026)",
    border: "var(--nv-overlay-border, 1px solid #9aa7b0)",
    borderRadius: "var(--nv-overlay-radius, 8px)",
    boxShadow: "var(--nv-overlay-shadow, 0 18px 44px #0005)",
    padding: "var(--nv-overlay-padding, 18px)",
    font: "var(--nv-overlay-font, 13px/1.4 system-ui, sans-serif)",
  });
}

// Buttons share the overlay font while retaining independent theme controls.
export function applyOverlayButtonAppearance(button) {
  Object.assign(button.style, {
    minHeight: "var(--nv-overlay-button-min-height, 32px)",
    padding: "var(--nv-overlay-button-padding, 5px 10px)",
    font: "inherit",
    border: "var(--nv-overlay-button-border, 1px solid #aebbc4)",
    borderRadius: "var(--nv-overlay-button-radius, 6px)",
    background: "var(--nv-overlay-button-background, #f7fafb)",
    color: "var(--nv-overlay-button-color, #172026)",
    cursor: "pointer",
  });
}
