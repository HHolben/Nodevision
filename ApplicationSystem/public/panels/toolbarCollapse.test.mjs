// Nodevision/ApplicationSystem/public/panels/toolbarCollapse.test.mjs
// This file verifies that the shared toolbar-region collapse control hides and restores the main and contextual toolbar as visual state only while preserving current DOM content, labels, keyboard access, and toolbar height recalculation hooks.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ensureToolbarRegionCollapseControl } from "./toolbarRegionCollapse.mjs";

class FakeClassList {
  constructor(owner) { this.owner = owner; this.values = new Set(); }
  add(...items) { items.filter(Boolean).forEach((item) => this.values.add(item)); this.owner._className = [...this.values].join(" "); }
  remove(...items) { items.forEach((item) => this.values.delete(item)); this.owner._className = [...this.values].join(" "); }
  contains(item) { return this.values.has(item); }
  toggle(item, force) { const next = force === undefined ? !this.values.has(item) : Boolean(force); next ? this.add(item) : this.remove(item); return next; }
  setFromString(value = "") { this.values = new Set(String(value).split(/\s+/).filter(Boolean)); this.owner._className = [...this.values].join(" "); }
}

class FakeStyle {
  constructor() { this.props = {}; }
  setProperty(name, value) { this.props[name] = String(value); }
  getPropertyValue(name) { return this.props[name] || ""; }
}

class FakeEvent {
  constructor(type, options = {}) { Object.assign(this, options); this.type = type; this.bubbles = options.bubbles !== false; }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.propagationStopped = true; }
}

class FakeElement {
  constructor(tagName = "div") { this.tagName = tagName.toUpperCase(); this.children = []; this.parentElement = null; this.dataset = {}; this.style = new FakeStyle(); this.attributes = {}; this.listeners = {}; this.classList = new FakeClassList(this); this._className = ""; this.textContent = ""; this.title = ""; this.rect = { height: 37 }; this.offsetHeight = 37; }
  get className() { return this._className; } set className(value) { this.classList.setFromString(value); } get parentNode() { return this.parentElement; }
  appendChild(child) { child.remove?.(); child.parentElement = this; this.children.push(child); return child; } append(...nodes) { nodes.forEach((node) => this.appendChild(node)); }
  insertBefore(child, before = null) { child.remove?.(); child.parentElement = this; const index = before ? this.children.indexOf(before) : -1; index >= 0 ? this.children.splice(index, 0, child) : this.children.push(child); return child; }
  remove() { if (!this.parentElement) return; const siblings = this.parentElement.children; const index = siblings.indexOf(this); if (index >= 0) siblings.splice(index, 1); this.parentElement = null; }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === "id") this.id = String(value); } getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  dispatchEvent(event) { event.target ||= this; event.currentTarget = this; for (const listener of this.listeners[event.type] || []) listener(event); if (event.bubbles && !event.propagationStopped && this.parentElement) this.parentElement.dispatchEvent(event); return !event.defaultPrevented; }
  getBoundingClientRect() { return this.rect; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) { const out = []; const matches = (node) => selector.startsWith("#") ? node.id === selector.slice(1) : selector.startsWith(".") ? node.classList?.contains(selector.slice(1)) : node.tagName === selector.toUpperCase(); const visit = (node) => { if (matches(node)) out.push(node); node.children.forEach(visit); }; this.children.forEach(visit); return out; }
}

class FakeDocument extends FakeElement {
  constructor() { super("document"); this.documentElement = new FakeElement("html"); this.body = new FakeElement("body"); this.append(this.documentElement, this.body); }
  createElement(tagName) { return new FakeElement(tagName); }
  getElementById(id) { return this.querySelector("#" + id); }
}

function setupToolbarDom() {
  globalThis.document = new FakeDocument();
  globalThis.CustomEvent = class CustomEvent extends FakeEvent { constructor(type, options = {}) { super(type, options); this.detail = options.detail; } };
  const events = [];
  globalThis.window = { dispatchEvent: (event) => events.push(event), updateGlobalToolbarHeightVar: null };
  const shell = document.createElement("div"); shell.id = "app-shell";
  const globalToolbar = document.createElement("div"); globalToolbar.id = "global-toolbar"; globalToolbar.rect = { height: 37 }; globalToolbar.offsetHeight = 37;
  const subToolbar = document.createElement("div"); subToolbar.id = "sub-toolbar"; subToolbar.appendChild(document.createElement("button")).textContent = "Context";
  const workspace = document.createElement("div"); workspace.id = "workspace";
  shell.append(globalToolbar, subToolbar, workspace); document.body.appendChild(shell);
  let heightCalls = 0;
  window.updateGlobalToolbarHeightVar = () => { heightCalls += 1; const height = shell.classList.contains("nv-toolbar-region--collapsed") ? 0 : Math.ceil(globalToolbar.getBoundingClientRect().height || globalToolbar.offsetHeight || 0); document.documentElement.style.setProperty("--nv-global-toolbar-height", `${height}px`); };
  return { shell, globalToolbar, subToolbar, workspace, events, heightCalls: () => heightCalls };
}

{
  const ctx = setupToolbarDom(); const subChild = ctx.subToolbar.children[0]; const strip = ensureToolbarRegionCollapseControl(); const button = strip.querySelector(".nv-toolbar-collapse-button");
  assert.equal(strip.parentElement, ctx.shell); assert.equal(ctx.shell.children.indexOf(strip), 2); assert.equal(ctx.shell.children[3], ctx.workspace);
  assert.equal(button.textContent, "▲"); assert.equal(button.getAttribute("aria-label"), "Collapse toolbar"); assert.equal(button.getAttribute("aria-expanded"), "true");
  button.dispatchEvent(new FakeEvent("click")); assert.equal(ctx.shell.classList.contains("nv-toolbar-region--collapsed"), true); assert.equal(button.textContent, "▼"); assert.equal(button.getAttribute("aria-label"), "Restore toolbar"); assert.equal(ctx.subToolbar.children[0], subChild); assert.equal(document.documentElement.style.getPropertyValue("--nv-global-toolbar-height"), "0px");
  button.dispatchEvent(new FakeEvent("keydown", { key: "Enter" })); assert.equal(ctx.shell.classList.contains("nv-toolbar-region--collapsed"), false); assert.equal(button.textContent, "▲"); assert.equal(ctx.subToolbar.children[0], subChild); assert.equal(document.documentElement.style.getPropertyValue("--nv-global-toolbar-height"), "37px");
  button.dispatchEvent(new FakeEvent("keydown", { key: " " })); assert.equal(ctx.shell.classList.contains("nv-toolbar-region--collapsed"), true); assert.equal(ctx.heightCalls() >= 4, true); assert.equal(ctx.events[ctx.events.length - 1].detail.collapsed, true);
}

{
  const cssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../Stylesheets/ToolbarStyles/toolbarRegionCollapse.css"); const css = readFileSync(cssPath, "utf8");
  assert.match(css, /#app-shell\.nv-toolbar-region--collapsed #global-toolbar,[\s\S]*#sub-toolbar[\s\S]*display: none !important/);
  assert.match(css, /\.nv-toolbar-collapse-button \{[\s\S]*opacity: 0;[\s\S]*pointer-events: none;/);
  assert.match(css, /#toolbar-collapse-strip:hover \.nv-toolbar-collapse-button/);
  assert.match(css, /#toolbar-collapse-strip:focus-within \.nv-toolbar-collapse-button/);
  assert.match(css, /#toolbar-collapse-strip::before[\s\S]*width: 76px;[\s\S]*height: 38px;/);
}

console.log("ok - toolbar collapse preserves toolbar DOM state, shared visibility, keyboard restore, and height updates");
