// Nodevision/ApplicationSystem/public/ToolbarCallbacks/terminal/executeFile.mjs
// This file defines browser-side execute File logic for the Nodevision UI. It renders interface components and handles user interactions.
import { setStatus } from "/StatusBar.mjs";

function resolveActiveFilePath() {
  return (
    window.NodevisionState?.activeEditorFilePath ||
    window.currentActiveFilePath ||
    window.filePath ||
    window.selectedFilePath ||
    window.NodevisionState?.selectedFile ||
    null
  );
}

function inferLanguage(filePath) {
  const lower = String(filePath || "").toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".cpp")) return "cpp";
  return null;
}

function renderOutputModal({ title, body }) {
  const existing = document.getElementById("nv-exec-output-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "nv-exec-output-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.tabIndex = -1;
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:34000;display:flex;align-items:center;justify-content:center;padding:16px;";

  const card = document.createElement("div");
  card.style.cssText =
    "width:min(920px,96vw);height:min(640px,92vh);background:#0b1020;color:#d6e2ff;border:1px solid rgba(140,200,255,0.25);border-radius:12px;box-shadow:0 12px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;overflow:hidden;";

  const header = document.createElement("div");
  header.style.cssText =
    "display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(140,200,255,0.25);";

  const h = document.createElement("div");
  h.textContent = title || "Program Output";
  h.style.cssText = "font:700 13px/1.2 system-ui, -apple-system, Segoe UI, Arial;";
  header.appendChild(h);

  const spacer = document.createElement("div");
  spacer.style.flex = "1";
  header.appendChild(spacer);

  const close = document.createElement("button");
  close.textContent = "Close";
  close.style.cssText =
    "padding:6px 10px;border-radius:8px;border:1px solid rgba(140,200,255,0.35);background:#111827;color:#e5e7eb;cursor:pointer;";
  close.onclick = () => overlay.remove();
  header.appendChild(close);

  const pre = document.createElement("pre");
  pre.style.cssText =
    "margin:0;flex:1;min-height:0;overflow:auto;padding:12px;font:12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;white-space:pre-wrap;";
  pre.textContent = body || "";

  card.appendChild(header);
  card.appendChild(pre);
  overlay.appendChild(card);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "Escape") overlay.remove();
  });

  document.body.appendChild(overlay);
  overlay.focus();
}

export default async function executeFile() {
  const filePath = resolveActiveFilePath();
  if (!filePath) {
    alert("No active file selected to execute.");
    return;
  }

  const language = inferLanguage(filePath);
  if (!language) {
    alert("Execute File supports .py, .java, and .cpp files only.");
    return;
  }

  setStatus("Executing", filePath);

  let res;
  let data = null;
  try {
    res = await fetch("/api/preview/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filePath, language, timeoutMs: 5000 }),
    });
    data = await res.json().catch(() => null);
  } catch (err) {
    setStatus("Execution failed", "Preview Runtime unavailable");
    renderOutputModal({
      title: "Program Output",
      body: `Failed to contact Nodevision Preview Runtime.\n\n${String(err?.message || err)}`,
    });
    return;
  }

  if (!res.ok || !data) {
    setStatus("Execution failed", `${res.status}`);
    renderOutputModal({
      title: "Program Output",
      body: `Execution failed.\n\n${JSON.stringify(data || { error: "unknown error" }, null, 2)}`,
    });
    return;
  }

  const lines = [];
  lines.push(`File: ${filePath}`);
  lines.push(`Runner: ${data.runner || "local-dev"}  Timed out: ${Boolean(data.timedOut)}  Exit: ${data.exitCode}`);
  lines.push("");
  lines.push("---- stdout ----");
  lines.push(String(data.stdout || ""));
  lines.push("");
  lines.push("---- stderr ----");
  lines.push(String(data.stderr || ""));
  lines.push("");
  lines.push(`Execution finished (${data.exitCode ?? "null"})`);

  setStatus("Execution complete", `${data.exitCode ?? ""}`);
  renderOutputModal({ title: "Program Output", body: lines.join("\n") });
}
