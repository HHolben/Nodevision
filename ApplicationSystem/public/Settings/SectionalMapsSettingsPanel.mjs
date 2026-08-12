// Nodevision/ApplicationSystem/public/Settings/SectionalMapsSettingsPanel.mjs
// This module mounts the FAA sectional-map Server Settings controls into the existing Settings page.

const API = "/api/aviation/sectionals";
const STYLE_ID = "nv-sectional-settings-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .nv-sectionals { max-width: 760px; margin: 24px 0; padding: 16px; border: 1px solid #ccd3d8; border-radius: 6px; background: #f8fafb; }
    .nv-sectionals h2 { margin: 0 0 10px; font-size: 20px; }
    .nv-sectionals label { display: block; margin: 12px 0 6px; font-weight: 700; }
    .nv-sectionals input { box-sizing: border-box; width: 100%; padding: 8px; border: 1px solid #9aa6ae; border-radius: 4px; font: 14px ui-monospace, monospace; }
    .nv-sectionals p { margin: 6px 0; max-width: 70ch; }
    .nv-sectionals__status { margin: 12px 0; padding: 10px; border: 1px solid #d8dee4; border-radius: 4px; background: #fff; }
    .nv-sectionals__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .nv-sectionals button { padding: 8px 10px; border: 1px solid #6b7884; border-radius: 4px; background: #24313b; color: #fff; cursor: pointer; }
    .nv-sectionals button[disabled] { opacity: 0.55; cursor: not-allowed; }
    .nv-sectionals__message { min-height: 20px; margin-top: 10px; font-weight: 700; }
  `;
  document.head.appendChild(style);
}

function make(tag, text = "", className = "") {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.error || `Request failed with ${response.status}`);
  return data;
}

function statusLines(payload) {
  const status = payload?.status || {};
  const directoryState = status.exists ? (status.isDirectory ? "exists" : "exists but is not a directory") : "does not exist";
  const lines = [
    `Directory: ${directoryState}`,
    `Sectional chart packages: ${status.packageCount || 0}`,
  ];
  if (status.editionLabel) lines.push(`FAA edition installed: ${status.editionLabel}`);
  if (status.updatedAt) lines.push(`Last updated: ${new Date(status.updatedAt).toLocaleString()}`);
  return lines;
}

function setBusy(buttons, busy) {
  for (const button of buttons) button.disabled = busy;
}

async function pollJob(jobId, message, refresh) {
  while (true) {
    const data = await readJson(await fetch(`${API}/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store" }));
    const job = data.job || {};
    const parts = [job.message || job.phase || job.status];
    if (job.total) parts.push(`${job.complete || 0} / ${job.total} complete`);
    if (job.currentChart) parts.push(job.currentChart);
    message.textContent = parts.filter(Boolean).join(" - ");
    if (job.status === "complete") {
      await refresh();
      return job;
    }
    if (job.status === "failed" || job.status === "cancelled") throw new Error(job.error || `Update ${job.status}`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

export async function mountSectionalMapsSettingsPanel(target) {
  ensureStyle();
  const root = make("section", "", "nv-sectionals");
  const title = make("h2", "Maps / Aviation");
  const description = make("p", "Directory within the active Notebook where FAA sectional chart packages are stored.");
  const label = make("label", "Sectional Maps Directory");
  label.htmlFor = "sectional-maps-directory";
  const input = make("input");
  input.id = "sectional-maps-directory";
  input.placeholder = "Library/Collection3_Atlases/Section2_SectionalMaps";
  const status = make("div", "", "nv-sectionals__status");
  const actions = make("div", "", "nv-sectionals__actions");
  const saveButton = make("button", "Save");
  const createButton = make("button", "Create Directory");
  const updateButton = make("button", "Update Sectional Maps");
  const message = make("div", "", "nv-sectionals__message");

  actions.append(saveButton, createButton, updateButton);
  root.append(title, description, label, input, status, actions, message);
  target.replaceChildren(root);

  let lastPayload = null;
  const refresh = async () => {
    lastPayload = await readJson(await fetch(`${API}/settings`, { cache: "no-store" }));
    input.value = lastPayload.settings.sectionalMapsDirectory || "";
    status.replaceChildren(...statusLines(lastPayload).map((line) => make("p", line)));
    updateButton.disabled = !lastPayload.status.exists || !lastPayload.status.isDirectory;
  };

  saveButton.addEventListener("click", async () => {
    setBusy([saveButton, createButton, updateButton], true);
    try {
      lastPayload = await readJson(await fetch(`${API}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionalMapsDirectory: input.value }),
      }));
      message.textContent = "Sectional Maps Directory saved.";
      await refresh();
    } catch (err) {
      message.textContent = err.message;
    } finally {
      setBusy([saveButton, createButton], false);
      updateButton.disabled = !lastPayload?.status?.exists || !lastPayload?.status?.isDirectory;
    }
  });

  createButton.addEventListener("click", async () => {
    setBusy([saveButton, createButton, updateButton], true);
    try {
      await readJson(await fetch(`${API}/create-directory`, { method: "POST" }));
      message.textContent = "Directory created.";
      await refresh();
    } catch (err) {
      message.textContent = err.message;
    } finally {
      setBusy([saveButton, createButton], false);
    }
  });

  updateButton.addEventListener("click", async () => {
    setBusy([saveButton, createButton, updateButton], true);
    try {
      message.textContent = "Checking FAA sectional chart publication...";
      const started = await readJson(await fetch(`${API}/update`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ createDirectory: false }) }));
      const job = await pollJob(started.jobId, message, refresh);
      message.textContent = job?.result?.status === "current" ? "Sectional maps are already current." : "Sectional maps updated successfully.";
    } catch (err) {
      message.textContent = `${err.message}. Existing sectional maps remain available offline.`;
    } finally {
      setBusy([saveButton, createButton], false);
      updateButton.disabled = !lastPayload?.status?.exists || !lastPayload?.status?.isDirectory;
    }
  });

  await refresh().catch((err) => {
    message.textContent = err.message;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const target = document.getElementById("sectional-maps-settings");
  if (target) mountSectionalMapsSettingsPanel(target);
});
