// Nodevision/ApplicationSystem/public/Settings/SectionalMapsCommands.mjs
// This module exposes browser-callable commands for FAA Sectional settings and update jobs.

const API = "/api/aviation/sectionals";

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed with ${response.status}`);
  return data;
}

export async function updateSectionalMapsFromBrowser(options = {}) {
  const started = await readJson(await fetch(`${API}/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ createDirectory: options.createDirectory === true }),
  }));

  let job = started.job;
  while (job?.status === "running") {
    await new Promise((resolve) => setTimeout(resolve, options.pollMs || 1500));
    const next = await readJson(await fetch(`${API}/jobs/${encodeURIComponent(started.jobId)}`, { cache: "no-store" }));
    job = next.job;
  }

  if (job?.status === "failed") throw new Error(job.error || "Sectional update failed.");
  if (job?.status === "cancelled") throw new Error("Sectional update was cancelled.");
  return { ok: true, job };
}
