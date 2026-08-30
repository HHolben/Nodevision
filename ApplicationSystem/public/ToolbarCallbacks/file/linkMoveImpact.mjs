// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/linkMoveImpact.mjs
// Shared helper: automatically update links and graph edges after a move or rename.
import { setStatus } from "/StatusBar.mjs";

function normalizePath(value = "") {
  let text = String(value || "").split(String.fromCharCode(92)).join("/").trim();
  while (text.startsWith("/")) text = text.slice(1);
  while (text.includes("//")) text = text.replace("//", "/");
  return text;
}

function isSamePath(a, b) {
  return normalizePath(a) === normalizePath(b);
}

function compactResponseText(text = "") {
  return String(text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function maybePromptLinkMoveImpact({ oldPath, newPath } = {}) {
  const oldClean = normalizePath(oldPath);
  const newClean = normalizePath(newPath);
  if (!oldClean || !newClean) return;
  if (isSamePath(oldClean, newClean)) return;

  const appWindow = globalThis.window || globalThis;
  const appDocument = globalThis.document || null;

  try {
    const res = await fetch("/api/linkMove/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldPath: oldClean,
        newPath: newClean,
        updateOutgoing: true,
        updateIncoming: true,
        updateGraph: true,
      }),
    });
    const responseText = await res.text();
    let payload = null;
    if (responseText.trim()) {
      try {
        payload = JSON.parse(responseText);
      } catch {
        payload = null;
      }
    }

    if (!res.ok || payload?.success === false) {
      const detail = payload?.error || payload?.details || compactResponseText(responseText);
      const message = detail || `Update failed (${res.status})`;
      throw new Error(message.length > 240 ? `${message.slice(0, 237)}...` : message);
    }

    if (Array.isArray(payload?.warnings) && payload.warnings.length) {
      console.warn("[linkMoveImpact] update completed with warnings:", payload.warnings);
      try {
        setStatus("Graph links repaired", `${payload.warnings.length} warning(s) while updating moved links`);
      } catch (_) {
        /* Status bar may not be initialized in every surface. */
      }
    }

    if (typeof appWindow.refreshGraphManager === "function") {
      try {
        await appWindow.refreshGraphManager({ fit: true, reason: "link-update" });
      } catch (err) {
        console.warn("[linkMoveImpact] refreshGraphManager failed:", err);
      }
    }

    if (typeof appWindow.refreshFileManager === "function") {
      await appWindow.refreshFileManager(appWindow.currentDirectoryPath || "");
    } else if (appDocument && typeof appDocument.dispatchEvent === "function" && typeof globalThis.CustomEvent === "function") {
      appDocument.dispatchEvent(new CustomEvent("refreshFileManager"));
    }
  } catch (err) {
    const message = err?.message || String(err || "Unknown error");
    console.error("[linkMoveImpact] update failed:", err);
    try {
      setStatus("Link update failed", message);
    } catch (_) {
      /* Status bar may not be initialized in every surface. */
    }
    if (typeof globalThis.alert === "function") {
      globalThis.alert("File moved, but Nodevision could not update links/graph: " + message);
    }
  }
}
