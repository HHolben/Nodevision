// Nodevision/ApplicationSystem/public/panels/workspaceLayoutCollapse.mjs
// This module owns temporary collapse and restore behavior for direct Nodevision workspace layout children. It preserves mounted panel and tab content by changing only the visible flex allocation, accessibility state, and divider controls for existing workspace branches.

import "./workspaceLayoutCollapseStyle.mjs";

const COLLAPSED_CLASS = "nv-layout-child--collapsed";
const CONTROLS_CLASS = "nv-layout-divider-controls";
const BUTTON_CLASS = "nv-layout-collapse-button";

function numericFlexPart(value) {
  const n = Number.parseFloat(String(value || ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toFlexValue(value) {
  if (value === undefined || value === null || value === "") return "";
  const raw = String(value).trim();
  return raw && !/\s/.test(raw) ? raw + " 1 0" : raw;
}

function flexAllocationWeight(element, axis = "row") {
  const raw = String(element?.style?.flex || "").trim();
  if (raw) {
    const parts = raw.split(/\s+/);
    const grow = numericFlexPart(parts[0]);
    if (grow) return grow;
    const percent = raw.match(/(?:^|\s|calc\()([0-9]+(?:\.[0-9]+)?)%/);
    if (percent) return numericFlexPart(percent[1]);
    const px = raw.match(/(?:^|\s)([0-9]+(?:\.[0-9]+)?)px(?:\s|$|\))/);
    if (px) return numericFlexPart(px[1]);
  }
  const rect = typeof element?.getBoundingClientRect === "function" ? element.getBoundingClientRect() : null;
  return numericFlexPart(axis === "column" ? rect?.height : rect?.width) || 1;
}

function setProportionalFlex(element, weight) {
  if (!element?.style) return;
  element.style.flex = Math.max(0.001, Number(weight) || 1) + " 1 0px";
  element.style.minWidth = "0";
  element.style.minHeight = "0";
}

function directLayoutChildren(container) {
  return Array.from(container?.children || []).filter((child) =>
    child.classList?.contains?.("panel-cell") || child.classList?.contains?.("panel-row")
  );
}

function normalizeSiblingFlexAllocations(container, axis = "row") {
  const children = directLayoutChildren(container).filter((child) => !isLayoutChildCollapsed(child));
  children.forEach((child) => setProportionalFlex(child, flexAllocationWeight(child, axis)));
  return children;
}

export function isLayoutChildCollapsed(element) {
  return element?.dataset?.nvCollapsed === "1" || element?.classList?.contains?.(COLLAPSED_CLASS) || false;
}

function visibleDirectLayoutChildren(container) {
  return directLayoutChildren(container).filter((child) => !isLayoutChildCollapsed(child));
}

function layoutAxisForContainer(container, fallbackAxis = "row") {
  return container?.dataset?.direction === "column" || container?.dataset?.isVertical === "1" ? "column" : fallbackAxis;
}

export function expandedFlexForSerialization(element) {
  if (isLayoutChildCollapsed(element) && element?.dataset?.nvExpandedFlex) return element.dataset.nvExpandedFlex;
  return element?.style?.flex || "";
}

function rememberCollapsedAccessibility(element) {
  if (!Object.prototype.hasOwnProperty.call(element.dataset, "nvPrevAriaHidden")) {
    element.dataset.nvPrevAriaHidden = element.getAttribute?.("aria-hidden") ?? "";
  }
  if (!Object.prototype.hasOwnProperty.call(element.dataset, "nvPrevInert")) {
    element.dataset.nvPrevInert = element.inert ? "1" : "0";
  }
  element.setAttribute?.("aria-hidden", "true");
  element.inert = true;
}

function restoreCollapsedAccessibility(element) {
  const previousAria = element.dataset?.nvPrevAriaHidden || "";
  if (previousAria) element.setAttribute?.("aria-hidden", previousAria);
  else element.removeAttribute?.("aria-hidden");
  element.inert = element.dataset?.nvPrevInert === "1";
  delete element.dataset.nvPrevAriaHidden;
  delete element.dataset.nvPrevInert;
}

function applyCollapsedLayoutState(element, expandedFlex = "") {
  const savedFlex = toFlexValue(expandedFlex) || expandedFlex || element.dataset?.nvExpandedFlex || element.style.flex || "1 1 0px";
  element.dataset.nvCollapsed = "1";
  element.dataset.nvExpandedFlex = savedFlex;
  element.classList?.add?.(COLLAPSED_CLASS);
  element.style.flex = "0 0 0px";
  element.style.minWidth = "0";
  element.style.minHeight = "0";
  rememberCollapsedAccessibility(element);
}

export function applySerializedCollapsedLayoutState(element, node = {}) {
  if (node?.collapsed) applyCollapsedLayoutState(element, toFlexValue(node.flex) || node.flex || element.style.flex);
}

export function collapseLayoutChild(element, parentAxis = "row") {
  const parent = element?.parentElement;
  if (!element || !parent || isLayoutChildCollapsed(element)) return false;
  if (visibleDirectLayoutChildren(parent).length <= 1) return false;
  const axis = layoutAxisForContainer(parent, parentAxis);
  normalizeSiblingFlexAllocations(parent, axis);
  applyCollapsedLayoutState(element, element.style.flex || String(flexAllocationWeight(element, axis)) + " 1 0px");
  refreshDividerCollapseControls(parent);
  return true;
}

export function expandLayoutChild(element) {
  if (!element || !isLayoutChildCollapsed(element)) return false;
  element.style.flex = element.dataset?.nvExpandedFlex || "1 1 0px";
  element.classList?.remove?.(COLLAPSED_CLASS);
  delete element.dataset.nvCollapsed;
  delete element.dataset.nvExpandedFlex;
  restoreCollapsedAccessibility(element);
  refreshDividerCollapseControls(element.parentElement);
  return true;
}

export function restoreCollapsedChildrenBeforeResize(...elements) {
  elements.forEach((element) => { if (isLayoutChildCollapsed(element)) expandLayoutChild(element); });
}

function collapseControlConfig(side, isVertical, collapsed) {
  const before = side === "before";
  if (isVertical) {
    if (collapsed) return { glyph: before ? "▲" : "▼", label: before ? "Restore panel above" : "Restore panel below" };
    return { glyph: before ? "▲" : "▼", label: before ? "Collapse panel above" : "Collapse panel below" };
  }
  if (collapsed) return { glyph: before ? "▶" : "◀", label: before ? "Restore panel left" : "Restore panel right" };
  return { glyph: before ? "◀" : "▶", label: before ? "Collapse panel left" : "Collapse panel right" };
}

function isolateDividerButtonEvent(event) {
  event.preventDefault?.();
  event.stopPropagation?.();
  event.stopImmediatePropagation?.();
}

function makeDividerCollapseButton(target, side, isVertical) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.dataset.side = side;
  button.addEventListener("pointerdown", isolateDividerButtonEvent);
  button.addEventListener("mousedown", isolateDividerButtonEvent);
  button.addEventListener("click", (event) => {
    isolateDividerButtonEvent(event);
    isLayoutChildCollapsed(target) ? expandLayoutChild(target) : collapseLayoutChild(target, isVertical ? "column" : "row");
  });
  return button;
}

export function createDividerCollapseControls(divider, beforeChild, afterChild, isVertical = false) {
  if (!divider || !beforeChild || !afterChild) return null;
  const controls = document.createElement("div");
  controls.className = CONTROLS_CLASS;
  controls.dataset.orientation = isVertical ? "vertical" : "horizontal";
  controls.setAttribute("aria-label", "Workspace divider collapse controls");
  const beforeButton = makeDividerCollapseButton(beforeChild, "before", isVertical);
  const afterButton = makeDividerCollapseButton(afterChild, "after", isVertical);
  controls.append(beforeButton, afterButton);
  divider.appendChild(controls);
  divider.__nvRefreshCollapseControls = () => refreshDividerButtons(beforeButton, afterButton, beforeChild, afterChild, isVertical);
  divider.__nvRefreshCollapseControls();
  return controls;
}

function refreshDividerButtons(beforeButton, afterButton, beforeChild, afterChild, isVertical) {
  const beforeCollapsed = isLayoutChildCollapsed(beforeChild);
  const afterCollapsed = isLayoutChildCollapsed(afterChild);
  const beforeConfig = collapseControlConfig("before", isVertical, beforeCollapsed);
  const afterConfig = collapseControlConfig("after", isVertical, afterCollapsed);
  beforeButton.textContent = beforeConfig.glyph;
  beforeButton.title = beforeConfig.label;
  beforeButton.setAttribute("aria-label", beforeConfig.label);
  afterButton.textContent = afterConfig.glyph;
  afterButton.title = afterConfig.label;
  afterButton.setAttribute("aria-label", afterConfig.label);
  beforeButton.hidden = afterCollapsed;
  afterButton.hidden = beforeCollapsed;
  beforeButton.disabled = !beforeCollapsed && visibleDirectLayoutChildren(beforeChild.parentElement).length <= 1;
  afterButton.disabled = !afterCollapsed && visibleDirectLayoutChildren(afterChild.parentElement).length <= 1;
}

function refreshDividerCollapseControls(container) {
  Array.from(container?.children || [])
    .filter((child) => child.classList?.contains?.("layout-divider") || child.classList?.contains?.("divider") || child.classList?.contains?.("row-divider"))
    .forEach((divider) => divider.__nvRefreshCollapseControls?.());
}
