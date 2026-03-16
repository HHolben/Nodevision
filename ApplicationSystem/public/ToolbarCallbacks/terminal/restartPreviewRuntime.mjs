import { setStatus } from "/StatusBar.mjs";

export default async function restartPreviewRuntime() {
  setStatus("Preview Runtime", "Restarting…");
  const res = await fetch("/api/preview/runtime/restart", { method: "POST" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    setStatus("Preview Runtime", "Restart failed");
    alert(data?.error || "Failed to restart Preview Runtime");
    return;
  }
  setStatus("Preview Runtime", "Running");
  alert("Preview Runtime restarted.");
}

