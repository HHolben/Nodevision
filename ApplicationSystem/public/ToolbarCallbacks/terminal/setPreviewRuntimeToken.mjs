import { setStatus } from "/StatusBar.mjs";

function renderTokenPrompt() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:34000;display:flex;align-items:center;justify-content:center;padding:16px;";

    const card = document.createElement("div");
    card.style.cssText =
      "width:min(520px,94vw);background:#fff;border:1px solid #888;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.35);padding:14px;font:13px system-ui, -apple-system, Segoe UI, Arial;display:flex;flex-direction:column;gap:10px;";

    const title = document.createElement("div");
    title.textContent = "Preview Runtime Token (dev-only)";
    title.style.cssText = "font-weight:700;";

    const note = document.createElement("div");
    note.textContent =
      "This token is used to authenticate requests between Nodevision and the Preview Runtime service. This is a development feature and not a sandbox.";
    note.style.cssText = "font-size:12px;color:#444;line-height:1.35;";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Enter token or leave blank to generate";
    input.style.cssText =
      "width:100%;padding:8px 10px;border:1px solid #bbb;border-radius:8px;font:12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;justify-content:flex-end;margin-top:4px;";

    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    cancel.style.cssText = "padding:7px 10px;border:1px solid #777;background:#f6f6f6;border-radius:8px;cursor:pointer;";

    const save = document.createElement("button");
    save.textContent = "Save + Restart";
    save.style.cssText = "padding:7px 10px;border:1px solid #111;background:#111827;color:#fff;border-radius:8px;cursor:pointer;";

    cancel.onclick = () => {
      overlay.remove();
      resolve(null);
    };
    save.onclick = () => {
      const token = input.value.trim();
      overlay.remove();
      resolve({ token: token || null, generate: !token });
    };

    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        overlay.remove();
        resolve(null);
      }
      if (e.key === "Enter") {
        const token = input.value.trim();
        overlay.remove();
        resolve({ token: token || null, generate: !token });
      }
    });

    actions.appendChild(cancel);
    actions.appendChild(save);

    card.appendChild(title);
    card.appendChild(note);
    card.appendChild(input);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    input.focus();
  });
}

export default async function setPreviewRuntimeToken() {
  const choice = await renderTokenPrompt();
  if (!choice) return;

  setStatus("Preview Runtime", "Saving token…");
  const tokenRes = await fetch("/api/preview/runtime/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(choice.generate ? { generate: true } : { token: choice.token }),
  });
  const tokenData = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !tokenData?.ok) {
    setStatus("Preview Runtime", "Token save failed");
    alert(tokenData?.error || "Failed to save token");
    return;
  }

  setStatus("Preview Runtime", "Restarting…");
  const restartRes = await fetch("/api/preview/runtime/restart", { method: "POST" });
  const restartData = await restartRes.json().catch(() => null);
  if (!restartRes.ok || !restartData?.ok) {
    setStatus("Preview Runtime", "Restart failed");
    alert(restartData?.error || "Failed to restart Preview Runtime");
    return;
  }

  setStatus("Preview Runtime", "Running");
  alert("Preview Runtime token set and service restarted.");
}

