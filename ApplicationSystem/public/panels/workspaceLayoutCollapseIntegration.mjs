// Nodevision/ApplicationSystem/public/panels/workspaceLayoutCollapseIntegration.mjs
// This module integrates temporary workspace layout collapse state with Nodevision's existing renderer, serializer, and divider resize behavior. It keeps the legacy workspace module unchanged while adding small restoration and decoration hooks around the established panel-row and panel-cell layout tree.

import {
  applySerializedCollapsedLayoutState,
  createDividerCollapseControls,
  expandedFlexForSerialization,
  isLayoutChildCollapsed,
  restoreCollapsedChildrenBeforeResize,
} from "./workspaceLayoutCollapse.mjs";

const DIVIDER_SELECTOR = ".layout-divider, .divider, .row-divider";
const LAYOUT_SELECTOR = ".panel-row, .panel-cell";
const CONTROLS_SELECTOR = ".nv-layout-divider-controls";
const observerByRoot = new WeakMap();
let pointerRestoreInstalled = false;

function directLayoutChildren(container) {
  return Array.from(container?.children || []).filter((child) => child.matches?.(LAYOUT_SELECTOR));
}

function toFlexValue(value) {
  if (value === undefined || value === null || value === "") return "";
  const raw = String(value).trim();
  return raw && !/\s/.test(raw) ? raw + " 1 0" : raw;
}

function closestDivider(node) {
  for (let current = node; current; current = current.parentElement) {
    if (current.matches?.(DIVIDER_SELECTOR)) return current;
  }
  return null;
}

function dividerOrientation(divider, beforeChild) {
  if (divider?.classList?.contains?.("row-divider")) return true;
  const container = beforeChild?.parentElement || divider?.parentElement;
  return container?.dataset?.direction === "column" || container?.dataset?.isVertical === "1";
}

function dividerChildren(divider) {
  const beforeChild = divider?._leftCell || divider?.previousElementSibling;
  const afterChild = divider?._rightCell || divider?.nextElementSibling;
  return beforeChild?.matches?.(LAYOUT_SELECTOR) && afterChild?.matches?.(LAYOUT_SELECTOR)
    ? { beforeChild, afterChild }
    : null;
}

function restoreDividerNeighbors(event) {
  const divider = closestDivider(event?.target);
  const pair = dividerChildren(divider);
  if (pair) restoreCollapsedChildrenBeforeResize(pair.beforeChild, pair.afterChild);
}

function decorateDivider(divider) {
  if (!divider || divider.querySelector?.(CONTROLS_SELECTOR)) return;
  const pair = dividerChildren(divider);
  if (!pair) return;
  if (!divider.style.position) divider.style.position = "relative";
  createDividerCollapseControls(divider, pair.beforeChild, pair.afterChild, dividerOrientation(divider, pair.beforeChild));
  divider.addEventListener("pointerdown", restoreDividerNeighbors, true);
}

export function decorateWorkspaceLayoutDividers(root = document) {
  root?.querySelectorAll?.(DIVIDER_SELECTOR).forEach(decorateDivider);
}

export function installWorkspaceLayoutCollapse(root = document) {
  decorateWorkspaceLayoutDividers(root);
  if (!pointerRestoreInstalled && typeof document !== "undefined") {
    document.addEventListener("pointerdown", restoreDividerNeighbors, true);
    pointerRestoreInstalled = true;
  }
  if (typeof MutationObserver === "undefined" || observerByRoot.has(root)) return;
  const observer = new MutationObserver(() => decorateWorkspaceLayoutDividers(root));
  observer.observe(root, { childList: true, subtree: true });
  observerByRoot.set(root, observer);
}

function applyNodeToElement(node, element) {
  if (!node || !element) return;
  const expandedFlex = toFlexValue(node.flex);
  if (expandedFlex) element.style.flex = expandedFlex;
  applySerializedCollapsedLayoutState(element, node);
  const children = Array.isArray(node.children) ? node.children : [];
  if (!children.length) return;
  directLayoutChildren(element).forEach((child, index) => applyNodeToElement(children[index], child));
}

export function applySerializedWorkspaceCollapseState(workspace, layoutNode) {
  if (!workspace || !layoutNode) return;
  const children = directLayoutChildren(workspace);
  if (children.length === 1) applyNodeToElement(layoutNode, children[0]);
  else children.forEach((child, index) => applyNodeToElement(layoutNode.children?.[index], child));
  decorateWorkspaceLayoutDividers(workspace);
}

function copyCollapseStateToLayout(node, element) {
  if (!node || !element) return node;
  const next = { ...node };
  next.flex = expandedFlexForSerialization(element);
  if (isLayoutChildCollapsed(element)) next.collapsed = true;
  else delete next.collapsed;
  if (Array.isArray(next.children)) {
    const children = directLayoutChildren(element);
    next.children = next.children.map((child, index) => copyCollapseStateToLayout(child, children[index]));
  }
  return next;
}

export function serializeWorkspaceCollapseState(layoutNode, workspace) {
  if (!layoutNode || !workspace) return layoutNode;
  const children = directLayoutChildren(workspace);
  if (children.length === 1) return copyCollapseStateToLayout(layoutNode, children[0]);
  return {
    ...layoutNode,
    children: (layoutNode.children || []).map((child, index) => copyCollapseStateToLayout(child, children[index])),
  };
}
