// Nodevision/ApplicationSystem/public/Sessions/HTMLDraftFocusSession.mjs
// This module runs the locked, gamified HTML drafting surface used by the built-in HTML Draft Focus Session.

import { openNodevisionOverlayPanel } from "../TemplateSystem/NodevisionOverlayPanel.mjs";
import { applyFocusInlineCommand, installHTMLDraftFocusLock, moveCaretToEnd } from "./HTMLDraftFocusEditorLock.mjs";
import { countDraftWords, formatTime, goalLabel, makeFocusResult, normalizeFocusGoal, progressForGoal } from "./HTMLDraftFocusMetrics.mjs";

const STYLE_ID = "nv-html-draft-focus-session-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-html-draft-focus {
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 12px;
  width: min(980px, calc(100vw - 32px));
  height: min(760px, calc(100vh - 32px));
  padding: 16px;
  color: #111827;
  background: #f8fafc;
  border: 1px solid #94a3b8;
  border-radius: 8px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
  font: 14px system-ui, sans-serif;
}
.nv-html-focus-top {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 10px;
}
.nv-html-focus-meter {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: #dbe3ed;
}
.nv-html-focus-meter span {
  display: block;
  height: 100%;
  width: 0%;
  background: #0078d7;
}
.nv-html-focus-tools {
  display: flex;
  gap: 8px;
}
.nv-html-focus-tools button {
  border: 1px solid #64748b;
  border-radius: 6px;
  padding: 7px 10px;
  background: #fff;
  color: #111827;
  cursor: pointer;
  font: inherit;
}
.nv-html-focus-editor {
  min-height: 0;
  overflow: auto;
  border: 1px solid #94a3b8;
  border-radius: 7px;
  padding: 18px;
  background: #fff;
  color: #111827;
  line-height: 1.6;
  outline: none;
}
`;
  document.head.appendChild(style);
}

function appendDraftToHtmlEditor(result) {
  window.NodevisionHTMLDraftFocusLastDraft = result;
  if (typeof window.getEditorHTML !== "function" || typeof window.setEditorHTML !== "function") return false;
  const existing = String(window.getEditorHTML() || "");
  const section = `<section data-nodevision-session="HTMLDraftFocus">${result.html}</section>`;
  window.setEditorHTML(existing ? `${existing}\n${section}` : section);
  return true;
}

function createSurface(goal) {
  const surface = document.createElement("div");
  surface.className = "nv-html-draft-focus";
  const top = document.createElement("div");
  top.className = "nv-html-focus-top";
  const title = document.createElement("strong");
  title.textContent = "HTML Draft Focus Session";
  const stats = document.createElement("span");
  const tools = document.createElement("div");
  tools.className = "nv-html-focus-tools";
  const bold = document.createElement("button");
  bold.textContent = "B";
  bold.title = "Bold selected text";
  const strike = document.createElement("button");
  strike.textContent = "S";
  strike.title = "Strikethrough selected text";
  const finish = document.createElement("button");
  finish.textContent = "Finish";
  tools.append(bold, strike, finish);
  top.append(title, stats, tools);
  const meter = document.createElement("div");
  meter.className = "nv-html-focus-meter";
  const meterFill = document.createElement("span");
  meter.appendChild(meterFill);
  const editor = document.createElement("div");
  editor.className = "nv-html-focus-editor";
  editor.contentEditable = "true";
  editor.spellcheck = true;
  editor.dataset.placeholder = goalLabel(goal);
  surface.append(top, meter, editor);
  return { surface, stats, meterFill, editor, bold, strike, finish };
}

export async function startHTMLDraftFocus(context = {}) {
  const goalInput = await openNodevisionOverlayPanel("HTMLDraftFocusGoalPanel", { title: "HTML Draft Focus" });
  if (!goalInput) {
    context.executionContext?.emit?.("htmlDraftFocus.finished", { cancelled: true });
    return { ok: false, cancelled: true };
  }
  ensureStyles();
  const goal = normalizeFocusGoal(goalInput);
  const root = document.getElementById("nv-session-root") || document.body;
  root.replaceChildren();
  const parts = createSurface(goal);
  root.appendChild(parts.surface);
  const started = Date.now();
  let done = false;
  let timer = 0;

  const finish = () => {
    if (done) return;
    done = true;
    window.clearInterval(timer);
    const result = makeFocusResult(goal, parts.editor, Date.now() - started);
    result.insertedIntoActiveHtmlEditor = appendDraftToHtmlEditor(result);
    context.executionContext?.emit?.("htmlDraftFocus.finished", result);
  };

  const update = () => {
    const elapsed = Date.now() - started;
    const words = countDraftWords(parts.editor.innerText || "");
    const progress = progressForGoal(goal, words, elapsed);
    parts.stats.textContent = `${words} words added · ${goalLabel(goal)}${goal.mode === "words" ? "" : " · " + formatTime(progress.remainingMs)}`;
    parts.meterFill.style.width = `${Math.round(progress.percent * 100)}%`;
    if (progress.complete) window.setTimeout(finish, 450);
  };

  const cleanupLock = installHTMLDraftFocusLock(parts.editor, { onSelectionChange: () => null });
  context.executionContext?.addCleanup?.(() => {
    cleanupLock();
    window.clearInterval(timer);
    parts.surface.remove();
  });
  parts.bold.addEventListener("mousedown", (event) => event.preventDefault());
  parts.strike.addEventListener("mousedown", (event) => event.preventDefault());
  parts.bold.addEventListener("click", () => applyFocusInlineCommand(parts.editor, "bold"));
  parts.strike.addEventListener("click", () => applyFocusInlineCommand(parts.editor, "strikeThrough"));
  parts.finish.addEventListener("click", finish);
  parts.editor.addEventListener("input", update);
  timer = window.setInterval(update, 1000);
  update();
  window.setTimeout(() => moveCaretToEnd(parts.editor), 0);
  return { ok: true };
}

