// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/linkMoveImpact.mjs
// Shared helper: automatically update links/edges after a move/rename.

function normalizePath(value = "") {
  return String(value || "").replace(/^\/+/, "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

function isSamePath(a, b) {
  return normalizePath(a) === normalizePath(b);
}

export async function maybePromptLinkMoveImpact({ oldPath, newPath } = {}) {
  const oldClean = normalizePath(oldPath);
  const newClean = normalizePath(newPath);
  if (!oldClean || !newClean) return;
  if (isSamePath(oldClean, newClean)) return;

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
    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.success === false) {
      const message = payload?.error || `Update failed (${res.status})`;
      if (res.status === 400 && /only file moves are supported/i.test(message)) return;
      throw new Error(message);
    }

    if (typeof window.refreshGraphManager === "function") {
      try {
        await window.refreshGraphManager({ fit: true, reason: "link-update" });
      } catch (err) {
        console.warn("[linkMoveImpact] refreshGraphManager failed:", err);
      }
    }

    if (typeof window.refreshFileManager === "function") {
      await window.refreshFileManager(window.currentDirectoryPath || "");
    } else {
      document.dispatchEvent(new CustomEvent("refreshFileManager"));
    }
  } catch (err) {
    console.error("[linkMoveImpact] update failed:", err);
    alert(`Failed to update links/graph: ${err.message || err}`);
  }
}
