// Nodevision/ApplicationSystem/public/Commands/handlers/OverlayCommands.mjs
// This module adapts overlay commands to Nodevision's existing panel factory and overlay layout.

import { createPanelDOM } from "/panels/panelFactory.mjs";
import { emitNodevisionEvent } from "../NodevisionEventRegistry.mjs";

let activeOverlay = null;

function overlayRoot() {
  return document.getElementById("nv-session-root") || document.body;
}

function overlayId() {
  return `CommandOverlay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function removeActive(reason = "closed") {
  if (!activeOverlay?.panel?.isConnected) {
    activeOverlay = null;
    return false;
  }
  const detail = { overlayId: activeOverlay.id, reason };
  activeOverlay.panel.remove();
  activeOverlay = null;
  emitNodevisionEvent("overlay.closed", detail);
  return true;
}

async function openOverlay(message, options = {}) {
  removeActive("replaced");
  const id = overlayId();
  const created = await createPanelDOM("SessionOverlayPanel", id, "InfoPanel", {
    title: options.title || options.heading || "Nodevision",
    heading: options.heading || "Nodevision",
    message,
    input: options.input === true,
    placeholder: options.placeholder || "",
    overlayId: id,
    emitOverlayEvents: true,
    returnPayload: true,
    choices: options.choices || [{ label: "Continue", value: "continue", primary: true }],
    onDone: (payload) => {
      if (activeOverlay?.id === id) removeActive("submitted");
      options.onDone?.(payload);
    },
  });
  activeOverlay = { id, panel: created.panel };
  overlayRoot().appendChild(created.panel);
  created.panel.__nvSetLayout?.("overlay", { onDismiss: () => removeActive("dismissed") });
  emitNodevisionEvent("overlay.opened", { overlayId: id, message: String(message || "") });
  return { ok: true, overlayId: id };
}

export function openOverlayCommand([message, heading]) {
  return openOverlay(message, { heading: heading || "Nodevision" });
}

export function showOverlayCommand([message]) {
  return openOverlay(message, { heading: "Nodevision" });
}

export function closeOverlayCommand() {
  return { ok: true, closed: removeActive("command") };
}

export async function setOverlayContentCommand([message]) {
  if (!activeOverlay?.panel?.isConnected) return openOverlay(message, { heading: "Nodevision" });
  activeOverlay.panel.__nvSessionOverlaySetContent?.(String(message || ""));
  return { ok: true, overlayId: activeOverlay.id };
}

export function getOverlayInputCommand([message, placeholder], context = {}) {
  return new Promise((resolve) => {
    let removeCleanup = () => {};
    const done = (payload = {}) => {
      removeCleanup();
      resolve(payload?.input ?? "");
    };
    openOverlay(message, {
      heading: "Nodevision",
      input: true,
      placeholder,
      choices: [{ label: "Submit", value: "submit", primary: true }],
      onDone: done,
    }).catch(() => done({ input: "" }));
    removeCleanup = context.executionContext?.addCleanup?.(() => done({ input: "" })) || (() => {});
  });
}
