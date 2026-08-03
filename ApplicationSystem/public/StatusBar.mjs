// Nodevision/ApplicationSystem/public/StatusBar.mjs
// This file defines browser-side Status Bar logic for the Nodevision UI. It renders interface components and handles user interactions.
let leftEl = null;
let rightEl = null;
let wordsEl = null;
let wordsAddedEl = null;
let wordCountVisible = false;

function ensureWordCounterElements() {
  if (!wordsEl) {
    wordsEl = document.getElementById("status-words");
  }
  if (!wordsAddedEl) {
    wordsAddedEl = document.getElementById("status-words-added");
  }
  if (!wordsAddedEl && wordsEl?.parentElement) {
    wordsAddedEl = document.createElement("span");
    wordsAddedEl.id = "status-words-added";
    wordsAddedEl.setAttribute("aria-live", "polite");
    wordsEl.after(wordsAddedEl);
  }
}

function normalizeCounterValue(count = 0) {
  return Math.max(0, Number.isFinite(count) ? Math.trunc(count) : 0);
}

export function setWordCountVisibility(show = false) {
  // Toggle the word counters based on whether the active file is a publication-type document.
  ensureWordCounterElements();
  if (!wordsEl) return;

  wordCountVisible = Boolean(show);
  [wordsEl, wordsAddedEl].forEach((el) => {
    if (!el) return;
    el.style.display = wordCountVisible ? "" : "none";
    el.setAttribute("aria-hidden", wordCountVisible ? "false" : "true");
  });

  if (!wordCountVisible) {
    wordsEl.textContent = "";
    if (wordsAddedEl) wordsAddedEl.textContent = "";
  } else {
    if (!wordsEl.textContent) wordsEl.textContent = "Words: 0";
    if (wordsAddedEl) wordsAddedEl.textContent = "Words Added: 0";
  }
}

export function initStatusBar() {
  leftEl = document.getElementById("status-left");
  rightEl = document.getElementById("status-right");
  ensureWordCounterElements();
  if (wordsEl && !wordsEl.textContent) {
    wordsEl.textContent = "Words: 0";
  }
  if (wordsAddedEl && !wordsAddedEl.textContent) {
    wordsAddedEl.textContent = "Words Added: 0";
  }

  // Hidden by default; shown only for publication-style editors.
  setWordCountVisibility(false);
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
  if (!target || !wordCountVisible) return;
  const n = normalizeCounterValue(count);
  target.textContent = `Words: ${n.toLocaleString()}`;
}

export function setWordsAddedCount(count = 0) {
  ensureWordCounterElements();
  if (!wordsAddedEl || !wordCountVisible) return;
  const n = normalizeCounterValue(count);
  wordsAddedEl.textContent = `Words Added: ${n.toLocaleString()}`;
}

export function clearStatus() {
  setStatus("Ready", "");
  setWordCount(0);
  setWordsAddedCount(0);
}

export function logStatus(message, detail = "") {
  if (window.NodevisionDebug) {
    console.log(message, detail);
  }

  window.dispatchEvent(
    new CustomEvent("status", { detail: { message, detail } })
  );
}
