// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/fullscreenApp.mjs
// Toggles native browser fullscreen for the whole Nodevision app shell.

import { setStatus } from "/StatusBar.mjs";

function getFullscreenElement() {
  return document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null;
}

function getRequestFullscreen(element) {
  return element?.requestFullscreen ||
    element?.webkitRequestFullscreen ||
    element?.msRequestFullscreen ||
    null;
}

function getExitFullscreen() {
  return document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen ||
    null;
}

function getAppShellTarget() {
  return document.getElementById("app-shell") || document.documentElement;
}

async function requestFullscreen(target, requestFullscreen) {
  try {
    await requestFullscreen.call(target, { navigationUI: "hide" });
  } catch (err) {
    if (err instanceof TypeError) {
      await requestFullscreen.call(target);
      return;
    }
    throw err;
  }
}

export async function toggleFullscreenApp() {
  const target = getAppShellTarget();
  if (!target) {
    setStatus("Full screen", "App shell not found");
    return;
  }

  const fullscreenElement = getFullscreenElement();
  if (fullscreenElement === target || target.contains?.(fullscreenElement)) {
    const exitFullscreen = getExitFullscreen();
    if (!exitFullscreen) {
      setStatus("Full screen", "Exit fullscreen is not supported");
      return;
    }

    try {
      await exitFullscreen.call(document);
      setStatus("Full screen", "Exited");
    } catch (err) {
      console.warn("Failed to exit app fullscreen:", err);
      setStatus("Full screen", "Exit failed");
    }
    return;
  }

  if (fullscreenElement) {
    setStatus("Full screen", "Another element is already fullscreen");
    return;
  }

  const request = getRequestFullscreen(target);
  if (!request) {
    setStatus("Full screen", "Fullscreen is not supported");
    return;
  }

  try {
    await requestFullscreen(target, request);
    setStatus("Full screen", "Press Esc to exit");
  } catch (err) {
    console.warn("Failed to enter app fullscreen:", err);
    setStatus("Full screen", "Request failed");
  }
}

export default function run() {
  toggleFullscreenApp();
}
