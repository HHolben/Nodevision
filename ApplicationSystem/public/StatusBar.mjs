// Nodevision/ApplicationSystem/public/StatusBar.mjs
// This file defines browser-side Status Bar logic for the Nodevision UI. It renders interface components and handles user interactions.
let leftEl = null;
let rightEl = null;
let wordsEl = null;

export function initStatusBar() {
  leftEl = document.getElementById("status-left");
  rightEl = document.getElementById("status-right");
  wordsEl = document.getElementById("status-words");
  if (wordsEl && !wordsEl.textContent) {
    wordsEl.textContent = "Words: 0";
  }
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

export function setWordCount(count = 0) {
  const target = document.getElementById("status-words");
  if (!target) return;
  const n = Number.isFinite(count) ? count : 0;
  target.textContent = `Words: ${n.toLocaleString()}`;
}

export function clearStatus() {
  setStatus("Ready", "");
  setWordCount(0);
}

export function logStatus(message, detail = "") {
  if (window.NodevisionDebug) {
    console.log(message, detail);
  }

  window.dispatchEvent(
    new CustomEvent("status", { detail: { message, detail } })
  );
}
