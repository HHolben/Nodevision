// Nodevision/ApplicationSystem/public/Sessions/HTMLDraftFocusMetrics.mjs
// This module calculates word totals, goal progress, and result summaries for the HTML Draft Focus Session.

export function countDraftWords(text = "") {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function normalizeFocusGoal(goal = {}) {
  const mode = ["words", "wordsTimed", "timed"].includes(goal.mode) ? goal.mode : "words";
  return {
    mode,
    targetWords: Math.max(1, Math.min(5000, Number(goal.targetWords) || 250)),
    timeMinutes: Math.max(1, Math.min(240, Number(goal.timeMinutes) || 15)),
  };
}

export function goalLabel(goal) {
  if (goal.mode === "timed") return `${goal.timeMinutes} minute draft`;
  if (goal.mode === "wordsTimed") return `${goal.targetWords} words in ${goal.timeMinutes} minutes`;
  return `${goal.targetWords} words`;
}

export function progressForGoal(goal, words, elapsedMs) {
  const timeLimitMs = goal.timeMinutes * 60 * 1000;
  const remainingMs = Math.max(0, timeLimitMs - elapsedMs);
  const wordsMet = goal.mode === "timed" ? false : words >= goal.targetWords;
  const timeMet = goal.mode === "timed" || goal.mode === "wordsTimed" ? elapsedMs >= timeLimitMs : false;
  const complete = goal.mode === "wordsTimed" ? (wordsMet || timeMet) : (goal.mode === "timed" ? timeMet : wordsMet);
  return {
    words,
    wordsMet,
    timeMet,
    complete,
    remainingMs,
    percent: goal.mode === "timed"
      ? Math.min(1, elapsedMs / timeLimitMs)
      : Math.min(1, words / goal.targetWords),
  };
}

export function formatTime(ms = 0) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function makeFocusResult(goal, editor, elapsedMs) {
  const text = editor?.innerText || "";
  const html = editor?.innerHTML || "";
  const words = countDraftWords(text);
  return {
    goal,
    html,
    text,
    wordsAdded: words,
    elapsedMs,
    completedAt: new Date().toISOString(),
  };
}

