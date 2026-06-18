// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/fullscreenWorkspace.mjs
// Toggles native browser fullscreen for the workspace region.

import { setStatus } from "/StatusBar.mjs";

function getFullscreenElement() {
  return document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.msFullscreenElement ||
    null;
}

function getRequestFullscreen(element) {
  return element.requestFullscreen ||
    element.webkitRequestFullscreen ||
    element.msRequestFullscreen ||
    null;
}

function getExitFullscreen() {
  return document.exitFullscreen ||
    document.webkitExitFullscreen ||
    document.msExitFullscreen ||
    null;
}

export async function toggleFullscreenWorkspace() {
  const workspace = document.getElementById("workspace");
  if (!workspace) {
    console.warn("No workspace element to fullscreen.");
    setStatus("Workspace fullscreen", "Workspace not found");
    return;
  }

  const fullscreenElement = getFullscreenElement();
  if (fullscreenElement === workspace) {
    const exitFullscreen = getExitFullscreen();
    if (!exitFullscreen) {
      setStatus("Workspace fullscreen", "Exit fullscreen is not supported");
      return;
    }

    try {
      await exitFullscreen.call(document);
      setStatus("Workspace fullscreen", "Exited");
    } catch (err) {
      console.warn("Failed to exit workspace fullscreen:", err);
      setStatus("Workspace fullscreen", "Exit failed");
    }
    return;
  }

  if (fullscreenElement) {
    setStatus("Workspace fullscreen", "Another element is already fullscreen");
    return;
  }

  const requestFullscreen = getRequestFullscreen(workspace);
  if (!requestFullscreen) {
    setStatus("Workspace fullscreen", "Fullscreen is not supported");
    return;
  }

  try {
    await requestFullscreen.call(workspace, { navigationUI: "hide" });
    setStatus("Workspace fullscreen", "Press Esc to exit");
  } catch (err) {
    console.warn("Failed to enter workspace fullscreen:", err);
    setStatus("Workspace fullscreen", "Request failed");
  }
}

export default function run() {
  toggleFullscreenWorkspace();
}
