// Nodevision/ApplicationSystem/public/panels/workspaceCollapse.test.mjs
// This file provides focused regression coverage for collapsible Nodevision workspace layout children. It uses a compact synthetic DOM to verify divider buttons, preserved panel tab state, accessibility state, nested rows, drag behavior, and serialized collapsed layout restoration without using Notebook fixtures.

import assert from "node:assert/strict";
import * as collapseHelpers from "./workspaceLayoutCollapse.mjs";
import * as collapseIntegration from "./workspaceLayoutCollapseIntegration.mjs";
import { ensureWorkspaceLayoutCollapseStyles } from "./workspaceLayoutCollapseStyle.mjs";
import { rebuildLayoutDividersForContainer } from "./workspaceParts/workspaceDividers.mjs";
import { renderLayout } from "./workspaceParts/workspaceLayoutRender.mjs";
import { serializeWorkspace } from "./workspaceParts/workspaceSerialization.mjs";

class FakeClassList {
  constructor(owner) { this.owner = owner; this.values = new Set(); }
  add(...items) { items.filter(Boolean).forEach((item) => this.values.add(item)); this.owner._className = [...this.values].join(" "); }
  remove(...items) { items.forEach((item) => this.values.delete(item)); this.owner._className = [...this.values].join(" "); }
  contains(item) { return this.values.has(item); }
  toggle(item, force) { const next = force === undefined ? !this.values.has(item) : Boolean(force); next ? this.add(item) : this.remove(item); return next; }
  setFromString(value = "") { this.values = new Set(String(value).split(/\s+/).filter(Boolean)); this.owner._className = [...this.values].join(" "); }
}

class FakeEvent {
  constructor(type, options = {}) { Object.assign(this, options); this.type = type; this.bubbles = options.bubbles !== false; this.button = options.button ?? 0; }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.propagationStopped = true; }
  stopImmediatePropagation() { this.immediatePropagationStopped = true; this.propagationStopped = true; }
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName).toUpperCase(); this.children = []; this.parentElement = null; this.dataset = {}; this.style = {}; this.attributes = {}; this.listeners = {}; this.classList = new FakeClassList(this); this._className = ""; this.hidden = false; this.disabled = false; this.inert = false; this.textContent = ""; this.title = ""; this.type = ""; this.rect = { left: 0, top: 0, width: 300, height: 180, right: 300, bottom: 180 };
  }
  get className() { return this._className; } set className(value) { this.classList.setFromString(value); } get parentNode() { return this.parentElement; }
  get previousElementSibling() { if (!this.parentElement) return null; const index = this.parentElement.children.indexOf(this); for (let i = index - 1; i >= 0; i -= 1) if (this.parentElement.children[i] instanceof FakeElement) return this.parentElement.children[i]; return null; }
  get nextSibling() { if (!this.parentElement) return null; const index = this.parentElement.children.indexOf(this); return index >= 0 ? this.parentElement.children[index + 1] || null : null; }
  get isConnected() { let node = this; while (node) { if (node === document.body || node === document) return true; node = node.parentElement; } return false; }
  appendChild(child) { child.remove?.(); child.parentElement = this; this.children.push(child); return child; } append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  insertBefore(child, before = null) { child.remove?.(); child.parentElement = this; const index = before ? this.children.indexOf(before) : -1; index >= 0 ? this.children.splice(index, 0, child) : this.children.push(child); return child; }
  remove() { if (!this.parentElement) return; const siblings = this.parentElement.children; const index = siblings.indexOf(this); if (index >= 0) siblings.splice(index, 1); this.parentElement = null; }
  removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) { this.children.splice(index, 1); child.parentElement = null; } return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === "aria-label") this.ariaLabel = String(value); } getAttribute(name) { return this.attributes[name] ?? null; } removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(type, listener, options = {}) { (this.listeners[type] ||= []).push({ listener, capture: options === true || Boolean(options?.capture) }); } removeEventListener(type, listener) { this.listeners[type] = (this.listeners[type] || []).filter((entry) => entry.listener !== listener); }
  dispatchEvent(event) { event.target ||= this; event.currentTarget = this; const entries = [...(this.listeners[event.type] || [])]; for (const entry of entries.filter((item) => item.capture)) { entry.listener(event); if (event.immediatePropagationStopped) break; } for (const entry of entries.filter((item) => !item.capture)) { if (event.immediatePropagationStopped) break; entry.listener(event); } if (event.bubbles && !event.propagationStopped && this.parentElement) this.parentElement.dispatchEvent(event); return !event.defaultPrevented; }
  setPointerCapture() {} releasePointerCapture() {}
  getBoundingClientRect() { if (this.style.flex === "0 0 0px") return { ...this.rect, width: 0, height: 0, right: this.rect.left, bottom: this.rect.top }; return this.rect; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) { const selectors = selector.split(",").map((part) => part.trim()).filter(Boolean); const out = []; const matches = (node, part) => part.startsWith(".") ? node.classList?.contains(part.slice(1)) : part.startsWith("#") ? node.id === part.slice(1) : part === "button" ? node.tagName === "BUTTON" : false; const visit = (node) => { selectors.forEach((part) => { if (matches(node, part)) out.push(node); }); node.children.forEach(visit); }; this.children.forEach(visit); return [...new Set(out)]; }
  closest(selector) { let node = this; while (node) { if (selector === ".panel-cell" && node.classList?.contains("panel-cell")) return node; if (selector === ".panel-row" && node.classList?.contains("panel-row")) return node; node = node.parentElement; } return null; }
  contains(node) { return node === this || this.children.some((child) => child.contains?.(node)); }
  matches(selector) { const parts = String(selector || "").split(",").map((part) => part.trim()).filter(Boolean); return parts.some((part) => part.startsWith(".") ? this.classList?.contains(part.slice(1)) : part.startsWith("#") ? this.id === part.slice(1) : part === "button" ? this.tagName === "BUTTON" : false); }
}

class FakeDocument extends FakeElement { constructor() { super("document"); this.body = new FakeElement("body"); this.head = new FakeElement("head"); this.appendChild(this.body); this.appendChild(this.head); } createElement(tagName) { return new FakeElement(tagName); } getElementById(id) { return this.querySelector("#" + id); } }

function createWorkspaceApi() {
  globalThis.document = new FakeDocument(); globalThis.window = { NodevisionState: {}, activeCell: null, addEventListener: () => {}, dispatchEvent: () => {}, highlightActiveCell: () => {} }; globalThis.CustomEvent = class CustomEvent extends FakeEvent { constructor(type, options = {}) { super(type, options); this.detail = options.detail; } }; globalThis.requestAnimationFrame = (fn) => fn(); globalThis.setTimeout = (fn) => fn();
  return { rebuildLayoutDividersForContainer, renderLayout, serializeWorkspace, ...collapseHelpers };
}

function cell(id, flex = "1 1 0px") { const node = document.createElement("div"); node.className = "panel-cell"; node.dataset.id = id; node.dataset.panelId = id; node.dataset.panelClass = "InfoPanel"; node.style.flex = flex; return node; }
function row(direction = "row", flex = "1 1 auto") { const node = document.createElement("div"); node.className = "panel-row"; node.dataset.direction = direction; node.dataset.isVertical = direction === "column" ? "1" : "0"; node.style.flex = flex; return node; }
function flexWeight(element) { return Number.parseFloat(String(element.style.flex || "")); } function rounded(value) { return Math.round(Number(value) * 100) / 100; } function buttons(divider) { return divider.querySelectorAll("button"); }
function attach(container, ...children) { container.append(...children); document.body.appendChild(container); return container; }

{
  const api = createWorkspaceApi(); const container = attach(row("row"), cell("Left", "33 1 0px"), cell("Right", "67 1 0px")); const [left, right] = container.children; api.rebuildLayoutDividersForContainer(container, false); collapseIntegration.decorateWorkspaceLayoutDividers(container); const divider = container.querySelector(".layout-divider");
  assert.equal(buttons(divider).length, 2, "row divider receives two collapse buttons"); assert.equal(api.collapseLayoutChild(left, "row"), true, "left child collapses"); assert.equal(api.isLayoutChildCollapsed(left), true); assert.equal(left.style.flex, "0 0 0px"); assert.equal(left.dataset.nvExpandedFlex, "33 1 0px"); assert.equal(left.inert, true); assert.equal(left.getAttribute("aria-hidden"), "true"); assert.equal(left.parentElement, container); assert.equal(api.expandLayoutChild(left), true); assert.equal(left.style.flex, "33 1 0px"); assert.equal(left.inert, false); assert.equal(left.getAttribute("aria-hidden"), null); assert.equal(right.parentElement, container);
}
{
  const api = createWorkspaceApi(); const container = attach(row("row"), cell("Left", "40 1 0px"), cell("Right", "60 1 0px")); const right = container.children[1]; assert.equal(api.collapseLayoutChild(right, "row"), true); assert.equal(api.expandLayoutChild(right), true); assert.equal(right.style.flex, "60 1 0px");
}
{
  const api = createWorkspaceApi(); const container = attach(row("column"), cell("Upper", "25 1 0px"), cell("Lower", "75 1 0px")); const [upper, lower] = container.children; api.rebuildLayoutDividersForContainer(container, true); collapseIntegration.decorateWorkspaceLayoutDividers(container); let dividerButtons = buttons(container.querySelector(".layout-divider")); assert.equal(dividerButtons[0].textContent, "▲"); assert.equal(dividerButtons[1].textContent, "▼"); assert.equal(api.collapseLayoutChild(upper, "column"), true); dividerButtons = buttons(container.querySelector(".layout-divider")); assert.equal(dividerButtons[0].textContent, "▲"); assert.equal(api.expandLayoutChild(upper), true); assert.equal(api.collapseLayoutChild(lower, "column"), true); dividerButtons = buttons(container.querySelector(".layout-divider")); assert.equal(dividerButtons[1].textContent, "▼"); assert.equal(api.expandLayoutChild(lower), true);
}
{
  const api = createWorkspaceApi(); const container = attach(row("row"), cell("A", "33 1 0px"), cell("B", "45 1 0px"), cell("C", "22 1 0px")); const [a, b, c] = container.children; api.collapseLayoutChild(c, "row"); assert.equal(rounded(flexWeight(a)), 33); assert.equal(rounded(flexWeight(b)), 45); assert.equal(api.collapseLayoutChild(a, "row"), true); assert.equal(c.style.flex, "0 0 0px"); assert.equal(api.collapseLayoutChild(b, "row"), false); api.expandLayoutChild(c); assert.equal(rounded(flexWeight(c)), 22);
}
{
  const api = createWorkspaceApi(); const outer = row("row"); const nested = row("column", "30 1 0px"); nested.append(cell("NestedTop"), cell("NestedBottom")); attach(outer, nested, cell("Right", "70 1 0px")); assert.equal(api.collapseLayoutChild(nested, "row"), true); assert.equal(nested.children.length, 2); assert.equal(api.expandLayoutChild(nested), true); assert.equal(nested.style.flex, "30 1 0px");
}
{
  const api = createWorkspaceApi(); const left = cell("Tabbed", "50 1 0px"); const tabs = { tabs: [{ tabId: "one" }, { tabId: "two" }], activeTabId: "two", orientation: "left" }; left.__nvPanelTabs = tabs; attach(row("row"), left, cell("Other", "50 1 0px")); api.collapseLayoutChild(left, "row"); api.expandLayoutChild(left); assert.equal(left.__nvPanelTabs, tabs); assert.deepEqual(left.__nvPanelTabs.tabs.map((tab) => tab.tabId), ["one", "two"]); assert.equal(left.__nvPanelTabs.activeTabId, "two");
}
{
  const api = createWorkspaceApi(); const workspace = attach(row("column"), cell("Top", "40 1 0px"), cell("Bottom", "60 1 0px")); api.collapseLayoutChild(workspace.children[0], "column"); const serialized = collapseIntegration.serializeWorkspaceCollapseState(api.serializeWorkspace(workspace), workspace); assert.equal(serialized.children[0].collapsed, true); assert.equal(serialized.children[0].flex, "40 1 0px");
}
{
  const api = createWorkspaceApi(); const workspace = document.createElement("div"); document.body.appendChild(workspace); const layout = { type: "row", direction: "row", children: [{ type: "cell", id: "Old", flex: "35 1 0px", deferLoad: true }, { type: "cell", id: "New", flex: "65 1 0px", collapsed: true, deferLoad: true }] }; api.renderLayout(layout, workspace, { loadPromises: [] }); collapseIntegration.applySerializedWorkspaceCollapseState(workspace, layout); const cells = workspace.querySelector(".panel-row").querySelectorAll(".panel-cell"); assert.equal(api.isLayoutChildCollapsed(cells[1]), true); assert.equal(cells[1].dataset.nvExpandedFlex, "65 1 0px"); assert.equal(api.isLayoutChildCollapsed(cells[0]), false);
}
{
  const api = createWorkspaceApi(); const left = cell("Left", "50 1 0px"); const right = cell("Right", "50 1 0px"); left.rect = { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }; right.rect = { left: 110, top: 0, width: 100, height: 100, right: 210, bottom: 100 }; const container = attach(row("row"), left, right); api.rebuildLayoutDividersForContainer(container, false); collapseIntegration.decorateWorkspaceLayoutDividers(container); const divider = container.querySelector(".layout-divider"); const [leftButton] = buttons(divider);
  const pointerEvent = new FakeEvent("pointerdown", { pointerId: 1, clientX: 105, clientY: 5 }); leftButton.dispatchEvent(pointerEvent); assert.equal(pointerEvent.defaultPrevented, true); assert.equal((document.listeners.pointermove || []).length, 0); leftButton.dispatchEvent(new FakeEvent("click")); assert.equal(api.isLayoutChildCollapsed(left), true); assert.equal((document.listeners.pointermove || []).length, 0); divider.dispatchEvent(new FakeEvent("pointerdown", { pointerId: 2, clientX: 105, clientY: 5 })); assert.equal(api.isLayoutChildCollapsed(left), false); assert.equal((document.listeners.pointermove || []).length, 1); document.dispatchEvent(new FakeEvent("pointermove", { pointerId: 2, clientX: 125, clientY: 5 })); assert.notEqual(left.style.flex, "50 1 0px"); document.dispatchEvent(new FakeEvent("pointerup", { pointerId: 2, clientX: 125, clientY: 5 }));
}

{
  createWorkspaceApi(); ensureWorkspaceLayoutCollapseStyles(); const css = document.head.children[0].textContent; assert.match(css, /\.nv-layout-divider-controls \{[^}]*opacity: 0/s); assert.match(css, /\.nv-layout-divider-controls \{[^}]*pointer-events: auto/s); assert.match(css, /:hover[^{}]*\.nv-layout-divider-controls[^{}]*\{ opacity: 1; /s); assert.match(css, /:focus-within[^{}]*\.nv-layout-divider-controls[^{}]*\{ opacity: 1; /s); assert.match(css, /\.nv-layout-collapse-button \{[^}]*pointer-events: none/s); assert.match(css, /\.nv-layout-divider-controls:hover \.nv-layout-collapse-button[^{}]*\{ pointer-events: auto; /s);
}

console.log("ok - workspace collapse preserves layout branches, tab state, accessibility, divider behavior, visibility, and serialization");
