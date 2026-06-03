// Nodevision/ApplicationSystem/public/ArduinoFlash/FlashPanel.mjs
// Reusable Flash Panel implementation. Loaded by the ControlPanel wrapper and fed by Nodevision active-file state.

import { ArduinoFlashApi } from "./ArduinoFlashApi.mjs";
import { SerialPlotter } from "./SerialPlotter.mjs";

function ensureStyles() {
  if (document.querySelector('link[data-nv-flash-panel-css="1"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "/ArduinoFlash/FlashPanel.css";
  link.dataset.nvFlashPanelCss = "1";
  document.head.appendChild(link);
}

function normalizeNotebookPath(value) {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned, window.location.origin);
    cleaned = parsed.pathname || cleaned;
  } catch {}
  cleaned = cleaned.replace(/\\/g, "/").replace(/[?#].*$/, "").replace(/^\/+/, "");
  if (cleaned.toLowerCase().startsWith("notebook/")) cleaned = cleaned.slice("Notebook/".length);
  return cleaned;
}

function resolveActiveIno(preferred = null) {
  const candidates = [
    preferred,
    window.currentActiveFilePath,
    window.NodevisionState?.activeEditorFilePath,
    window.selectedFilePath,
    window.NodevisionState?.selectedFile,
    window.ActiveNode,
    window.filePath,
  ];
  for (const candidate of candidates) {
    const path = normalizeNotebookPath(candidate);
    if (path && path.toLowerCase().endsWith(".ino")) return path;
  }
  return "";
}

function option(value, label, title = "") {
  const el = document.createElement("option");
  el.value = value || "";
  el.textContent = label || value || "";
  if (title) el.title = title;
  return el;
}

function appendLog(el, text = "") {
  if (!el) return;
  el.textContent += String(text || "");
  el.scrollTop = el.scrollHeight;
}

async function saveActiveFile(filePath, statusEl) {
  if (typeof window.saveCurrentFile !== "function") return true;
  statusEl.textContent = "Saving active sketch...";
  const result = await window.saveCurrentFile({ path: filePath });
  if (!result) throw new Error("Could not save the active editor contents before flashing.");
  return true;
}

function streamJob(jobId, logEl, statusEl) {
  return new Promise((resolve) => {
    const source = new EventSource(`/api/arduino-flash/jobs/${encodeURIComponent(jobId)}/events`);
    source.addEventListener("log", (event) => {
      const entry = JSON.parse(event.data || "{}");
      appendLog(logEl, entry.text || "");
    });
    source.addEventListener("done", (event) => {
      const done = JSON.parse(event.data || "{}");
      source.close();
      statusEl.textContent = done.status === "completed" ? "Done." : `Finished with ${done.status || "error"}.`;
      resolve(done);
    });
    source.onerror = () => {
      source.close();
      statusEl.textContent = "Log stream closed.";
      resolve({ status: "stream-closed" });
    };
  });
}

export async function setupFlashPanel(panel, panelVars = {}) {
  ensureStyles();
  if (typeof panel.cleanup === "function") {
    try { panel.cleanup(); } catch {}
  }

  const activeFilePath = resolveActiveIno(panelVars.filePath);
  panel.innerHTML = `
    <div class="nv-flash-panel">
      <div class="nv-flash-row" style="justify-content:space-between;">
        <div>
          <h3>Flash Panel</h3>
          <div class="nv-flash-status" data-active-file></div>
        </div>
        <button type="button" data-refresh>Refresh</button>
      </div>
      <div class="nv-flash-error" data-error></div>
      <div class="nv-flash-status" data-status></div>
      <section class="nv-flash-section">
        <div class="nv-flash-row">
          <label>Board
            <select data-board></select>
          </label>
          <label>Port
            <select data-port></select>
          </label>
          <button type="button" data-verify>Compile / Verify</button>
          <button type="button" data-upload data-primary>Flash / Upload</button>
        </div>
      </section>
      <section class="nv-flash-section">
        <div class="nv-flash-row">
          <label>Libraries
            <select data-library></select>
          </label>
          <label>Add Library
            <input data-library-name placeholder="Library name">
          </label>
          <button type="button" data-install-library>Install Library</button>
        </div>
      </section>
      <div class="nv-flash-split">
        <section class="nv-flash-section">
          <div class="nv-flash-row">
            <label>Baud Rate
              <select data-baud>
                <option>9600</option><option>19200</option><option>38400</option>
                <option>57600</option><option selected>115200</option><option>230400</option>
              </select>
            </label>
            <button type="button" data-serial-connect>Connect</button>
            <button type="button" data-serial-disconnect>Disconnect</button>
            <label style="min-width:auto;flex-direction:row;align-items:center;margin-bottom:7px;">
              <input type="checkbox" data-autoscroll checked> Autoscroll
            </label>
            <button type="button" data-clear-serial>Clear</button>
          </div>
          <div class="nv-flash-serial" data-serial-output></div>
          <div class="nv-flash-row" style="margin-top:8px;">
            <input data-serial-input placeholder="Send text to board" style="flex:1;min-width:180px;">
            <button type="button" data-serial-send>Send</button>
          </div>
        </section>
        <section class="nv-flash-section">
          <div style="font-weight:600;margin-bottom:6px;">Serial Plotter</div>
          <canvas class="nv-flash-plot" data-plot></canvas>
        </section>
      </div>
      <section class="nv-flash-section" style="min-height:0;">
        <div class="nv-flash-row" style="justify-content:space-between;">
          <div style="font-weight:600;">Output Log</div>
          <button type="button" data-clear-log>Clear Log</button>
        </div>
        <div class="nv-flash-log" data-log></div>
      </section>
    </div>
  `;

  const activeFileEl = panel.querySelector("[data-active-file]");
  const errorEl = panel.querySelector("[data-error]");
  const statusEl = panel.querySelector("[data-status]");
  const boardSelect = panel.querySelector("[data-board]");
  const portSelect = panel.querySelector("[data-port]");
  const librarySelect = panel.querySelector("[data-library]");
  const logEl = panel.querySelector("[data-log]");
  const serialEl = panel.querySelector("[data-serial-output]");
  const serialInput = panel.querySelector("[data-serial-input]");
  const baudSelect = panel.querySelector("[data-baud]");
  const autoscroll = panel.querySelector("[data-autoscroll]");
  const plotter = new SerialPlotter(panel.querySelector("[data-plot]"));
  let serialSource = null;

  const state = { filePath: activeFilePath };
  const setError = (message = "") => {
    errorEl.textContent = message;
    errorEl.style.display = message ? "block" : "none";
  };
  const selectedPort = () => portSelect.value;
  const selectedFqbn = () => boardSelect.value || "";

  function renderActiveFile() {
    state.filePath = resolveActiveIno(state.filePath);
    activeFileEl.textContent = state.filePath ? `Sketch: ${state.filePath}` : "Open a .ino file to use this panel.";
  }

  async function refreshAll() {
    setError("");
    renderActiveFile();
    statusEl.textContent = "Checking Arduino tooling...";
    try {
      const status = await ArduinoFlashApi.status();
      if (!status.arduinoCliAvailable) {
        setError(`${status.error || "arduino-cli is required."} ${status.installHint || "Install Arduino CLI and run arduino-cli core update-index."}`);
      }
    } catch (err) {
      setError(err.message);
    }

    statusEl.textContent = "Loading boards, ports, and libraries...";
    const [ports, detected, boards, libraries] = await Promise.allSettled([
      ArduinoFlashApi.ports(),
      ArduinoFlashApi.detectedBoards(),
      ArduinoFlashApi.boards(),
      ArduinoFlashApi.libraries(),
    ]);

    portSelect.innerHTML = "";
    const portItems = ports.value?.ports || [];
    portSelect.appendChild(option("", portItems.length ? "Select port" : "No ports found"));
    portItems.forEach((p) => portSelect.appendChild(option(p.port, p.label || p.port)));

    boardSelect.innerHTML = "";
    boardSelect.appendChild(option("", "Select board FQBN"));
    (detected.value?.boards || []).filter((b) => b.fqbn).forEach((b) => {
      boardSelect.appendChild(option(b.fqbn, `Detected: ${b.label || b.fqbn}`));
    });
    (boards.value?.boards || []).forEach((b) => boardSelect.appendChild(option(b.fqbn, b.label || b.fqbn)));

    librarySelect.innerHTML = "";
    const libs = libraries.value?.libraries || [];
    librarySelect.appendChild(option("", libs.length ? "Installed libraries" : "No libraries listed"));
    libs.forEach((lib) => librarySelect.appendChild(option(lib.name, `${lib.name}${lib.version ? ` ${lib.version}` : ""}`, lib.location)));
    statusEl.textContent = "Ready.";
  }

  async function runCli(kind) {
    try {
      setError("");
      renderActiveFile();
      if (!state.filePath) throw new Error("Open a .ino file before compiling or flashing.");
      if (!selectedFqbn()) throw new Error("Select a board FQBN.");
      if (kind === "upload" && !selectedPort()) throw new Error("Select a serial port.");
      await saveActiveFile(state.filePath, statusEl);
      appendLog(logEl, `\n$ arduino-cli ${kind === "verify" ? "compile" : "upload"} ${state.filePath}\n`);
      statusEl.textContent = kind === "verify" ? "Compiling..." : "Uploading...";
      const start = kind === "verify"
        ? await ArduinoFlashApi.verify({ filePath: state.filePath, fqbn: selectedFqbn() })
        : await ArduinoFlashApi.upload({ filePath: state.filePath, fqbn: selectedFqbn(), port: selectedPort() });
      const done = await streamJob(start.jobId, logEl, statusEl);
      if (done.status && done.status !== "completed") setError(`${kind === "verify" ? "Compile" : "Upload"} failed.`);
    } catch (err) {
      setError(err.message);
      statusEl.textContent = "Error.";
    }
  }

  async function connectSerial() {
    try {
      setError("");
      if (!selectedPort()) throw new Error("Select a serial port.");
      await ArduinoFlashApi.serialConnect({ port: selectedPort(), baudRate: Number(baudSelect.value) });
      if (serialSource) serialSource.close();
      serialSource = new EventSource(`/api/arduino-flash/serial/events?port=${encodeURIComponent(selectedPort())}`);
      serialSource.addEventListener("serial", (event) => {
        const entry = JSON.parse(event.data || "{}");
        const text = entry.type === "data" ? entry.text : `[${entry.type}] ${entry.text}`;
        serialEl.textContent += `${text}\n`;
        plotter.pushLine(entry.text || "");
        if (autoscroll.checked) serialEl.scrollTop = serialEl.scrollHeight;
      });
      serialSource.onerror = () => {
        statusEl.textContent = "Serial stream closed.";
      };
      statusEl.textContent = "Serial connected.";
    } catch (err) {
      setError(err.message);
    }
  }

  async function disconnectSerial() {
    if (serialSource) serialSource.close();
    serialSource = null;
    await ArduinoFlashApi.serialDisconnect({ port: selectedPort() }).catch(() => {});
    statusEl.textContent = "Serial disconnected.";
  }

  panel.querySelector("[data-refresh]").addEventListener("click", refreshAll);
  panel.querySelector("[data-verify]").addEventListener("click", () => runCli("verify"));
  panel.querySelector("[data-upload]").addEventListener("click", () => runCli("upload"));
  panel.querySelector("[data-clear-log]").addEventListener("click", () => { logEl.textContent = ""; });
  panel.querySelector("[data-clear-serial]").addEventListener("click", () => { serialEl.textContent = ""; plotter.clear(); });
  panel.querySelector("[data-serial-connect]").addEventListener("click", connectSerial);
  panel.querySelector("[data-serial-disconnect]").addEventListener("click", disconnectSerial);
  panel.querySelector("[data-serial-send]").addEventListener("click", async () => {
    if (!serialInput.value) return;
    await ArduinoFlashApi.serialWrite({ port: selectedPort(), text: serialInput.value });
    serialInput.value = "";
  });
  panel.querySelector("[data-install-library]").addEventListener("click", async () => {
    const name = panel.querySelector("[data-library-name]").value.trim();
    if (!name) return;
    const start = await ArduinoFlashApi.installLibrary(name);
    appendLog(logEl, `\n$ arduino-cli lib install ${name}\n`);
    await streamJob(start.jobId, logEl, statusEl);
    await refreshAll();
  });

  panel.cleanup = () => {
    if (serialSource) serialSource.close();
  };

  await refreshAll().catch((err) => setError(err.message));
}
