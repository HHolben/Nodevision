// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/listenControlsWidget.mjs
// This module renders the View Listen sub-toolbar controls that start and pause rendered page speech playback.

import { getRenderedPageReader } from "/Listen/RenderedPageReader.mjs";

function renderButton(action, label, title) {
  return "<button type=\"button\" data-nv-listen-action=\"" + action + "\" title=\"" + title + "\" aria-label=\"" + title + "\" style=\"height:26px;min-width:54px;padding:0 10px;\">" + label + "</button>";
}

function syncButtons(host, reader) {
  const state = reader.getState();
  const playBtn = host.querySelector("[data-nv-listen-action=play]");
  const pauseBtn = host.querySelector("[data-nv-listen-action=pause]");
  const status = host.querySelector("[data-nv-listen-status]");
  if (playBtn) playBtn.textContent = state.paused ? "Resume" : "Play";
  if (pauseBtn) pauseBtn.disabled = !state.active || state.paused;
  if (status) status.textContent = state.active ? (state.paused ? "Paused" : "Reading") : "Idle";
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  const previousCleanup = window.__nvListenToolbarCleanup;
  if (typeof previousCleanup === "function") previousCleanup();

  hostElement.classList.add("nv-listen-toolbar");
  hostElement.innerHTML = [
    renderButton("play", "Play", "Play reading"),
    renderButton("pause", "Pause", "Pause reading"),
    "<span data-nv-listen-status style=\"font:12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;color:#314057;min-width:54px;\">Idle</span>",
  ].join("");

  const reader = getRenderedPageReader();
  const playBtn = hostElement.querySelector("[data-nv-listen-action=play]");
  const pauseBtn = hostElement.querySelector("[data-nv-listen-action=pause]");
  const status = hostElement.querySelector("[data-nv-listen-status]");

  const setBusy = (busy) => {
    if (playBtn) playBtn.disabled = Boolean(busy);
    if (status && busy) status.textContent = "Starting";
  };

  const handleError = (err) => {
    if (status) status.textContent = "Unavailable";
    alert(err?.message || "Unable to read the rendered page.");
  };

  playBtn?.addEventListener("click", async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await reader.play();
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
      syncButtons(hostElement, reader);
    }
  });

  pauseBtn?.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      await reader.pause();
    } catch (err) {
      handleError(err);
    } finally {
      syncButtons(hostElement, reader);
    }
  });

  const sync = () => syncButtons(hostElement, reader);
  window.addEventListener("nv-rendered-page-reader-state", sync);
  window.addEventListener("activePanelChanged", sync);
  window.__nvListenToolbarCleanup = () => {
    window.removeEventListener("nv-rendered-page-reader-state", sync);
    window.removeEventListener("activePanelChanged", sync);
  };
  sync();
}
