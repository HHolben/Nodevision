// Nodevision/ApplicationSystem/public/StatusBar.mjs
// This file defines browser-side Status Bar logic for the Nodevision UI. It renders interface components and handles user interactions.
let leftEl = null;
let rightEl = null;

export function initStatusBar() {
  leftEl = document.getElementById("status-left");
  rightEl = document.getElementById("status-right");
}


function getCurrentMode() {
  return window.NodevisionState?.currentMode || "Default";
}

export function setStatus(message, detail = "") {
  const left = document.getElementById("status-left");
  const right = document.getElementById("status-right");

  if (left) {
    left.textContent = detail ? `${message} · ${detail}` : message;
  }

  if (right) {
    right.textContent = `Mode: ${getCurrentMode()}`;
  }
}

export function clearStatus() {
  setStatus("Ready", "");
}

export function logStatus(message, detail = "") {
  if (window.NodevisionDebug) {
    console.log(message, detail);
  }

  window.dispatchEvent(
    new CustomEvent("status", { detail: { message, detail } })
  );
}
