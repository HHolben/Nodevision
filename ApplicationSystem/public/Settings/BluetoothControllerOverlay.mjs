// Nodevision/ApplicationSystem/public/Settings/BluetoothControllerOverlay.mjs
// Connects browser-accessible Bluetooth/HID controllers, with a Wii Remote path through WebHID.

const OVERLAY_ID = "nv-bluetooth-controller-overlay";
const STYLE_ID = "nv-bluetooth-controller-style";
const NINTENDO_VENDOR_ID = 0x057e;

const state = window.NodevisionBluetoothControllers || {
  controllers: new Map(),
  lastReport: null,
};
window.NodevisionBluetoothControllers = state;

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .nv-bt-controller-overlay {
      position: fixed;
      inset: 0;
      z-index: 100000;
      display: grid;
      place-items: center;
      padding: 18px;
      box-sizing: border-box;
      background: rgba(9, 16, 24, 0.55);
      color: #16212d;
      font: 13px/1.45 system-ui, sans-serif;
    }
    .nv-bt-controller-panel {
      width: min(680px, 100%);
      max-height: min(760px, calc(100vh - 36px));
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      overflow: hidden;
      border: 1px solid #9fb2c2;
      border-radius: 8px;
      background: #f7fafc;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
    }
    .nv-bt-controller-header,
    .nv-bt-controller-actions {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 12px 14px;
      background: #eef4f8;
      border-bottom: 1px solid #cfdae3;
    }
    .nv-bt-controller-actions {
      border-top: 1px solid #cfdae3;
      border-bottom: 0;
      justify-content: flex-end;
    }
    .nv-bt-controller-title {
      margin: 0;
      font: 700 15px/1.25 system-ui, sans-serif;
    }
    .nv-bt-controller-body {
      min-height: 0;
      overflow: auto;
      padding: 14px;
    }
    .nv-bt-controller-note {
      margin: 0 0 12px;
      color: #405466;
    }
    .nv-bt-controller-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .nv-bt-controller-section {
      min-width: 0;
      border: 1px solid #d4dee7;
      border-radius: 8px;
      background: #fff;
      padding: 10px;
    }
    .nv-bt-controller-section h3 {
      margin: 0 0 8px;
      font: 700 13px/1.2 system-ui, sans-serif;
    }
    .nv-bt-controller-section p {
      margin: 0 0 10px;
      color: #43576a;
    }
    .nv-bt-controller-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .nv-bt-controller-status {
      min-height: 40px;
      margin-top: 12px;
      padding: 9px;
      border: 1px solid #ccd8e2;
      border-radius: 8px;
      background: #fbfdff;
      white-space: pre-wrap;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .nv-bt-controller-report {
      margin-top: 10px;
      padding: 9px;
      border: 1px solid #d8e2ea;
      border-radius: 8px;
      background: #fff;
      min-height: 86px;
      white-space: pre-wrap;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .nv-bt-controller-overlay button {
      border: 1px solid #8ca1b3;
      border-radius: 6px;
      padding: 6px 10px;
      background: #e9f2fa;
      color: #12202c;
      cursor: pointer;
      font: 12px/1.2 system-ui, sans-serif;
    }
    .nv-bt-controller-overlay button:hover:not(:disabled) { background: #d9ecfb; }
    .nv-bt-controller-overlay button:disabled { opacity: 0.55; cursor: not-allowed; }
    .nv-bt-controller-close {
      min-width: 32px;
      font-weight: 700;
    }
    @media (max-width: 720px) {
      .nv-bt-controller-grid { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function setNodevisionState(extra = {}) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.bluetoothController = {
    connectedCount: state.controllers.size,
    lastReport: state.lastReport,
    ...extra,
  };
}

function controllerKey(device) {
  return `${device.vendorId || "unknown"}:${device.productId || "unknown"}:${device.productName || "controller"}`;
}

function bytesFromDataView(dataView) {
  const bytes = [];
  for (let index = 0; index < dataView.byteLength; index += 1) {
    bytes.push(dataView.getUint8(index));
  }
  return bytes;
}

function parseWiimoteButtons(reportId, bytes) {
  if (!bytes.length) return null;
  const first = bytes[0] || 0;
  const second = bytes[1] || 0;
  const buttons = {
    left: Boolean(first & 0x01),
    right: Boolean(first & 0x02),
    down: Boolean(first & 0x04),
    up: Boolean(first & 0x08),
    plus: Boolean(first & 0x10),
    two: Boolean(second & 0x01),
    one: Boolean(second & 0x02),
    b: Boolean(second & 0x04),
    a: Boolean(second & 0x08),
    minus: Boolean(second & 0x10),
    home: Boolean(second & 0x80),
  };
  const pressed = Object.entries(buttons)
    .filter(([, value]) => value)
    .map(([name]) => name);

  const parsed = { buttons, pressed };
  if (reportId === 0x31 && bytes.length >= 5) {
    parsed.accelerometer = {
      x: bytes[2],
      y: bytes[3],
      z: bytes[4],
    };
  }
  return parsed;
}

function publishReport(detail) {
  state.lastReport = detail;
  setNodevisionState({ lastReport: detail });
  window.dispatchEvent(new CustomEvent("nv-bluetooth-controller-report", { detail }));
  if (detail.kind === "wiimote") {
    window.dispatchEvent(new CustomEvent("nv-wiimote-report", { detail }));
  }
}

function describeController(device) {
  return `${device.productName || "HID Controller"} (${device.vendorId?.toString(16) || "?"}:${device.productId?.toString(16) || "?"})`;
}

async function openHidDevice(device, status, reportBox) {
  if (!device.opened) await device.open();
  const key = controllerKey(device);
  state.controllers.set(key, { type: "hid", device, connectedAt: Date.now() });
  setNodevisionState({ connectedType: "hid", connectedName: device.productName || "HID Controller" });
  window.dispatchEvent(new CustomEvent("nv-bluetooth-controller-connected", {
    detail: { type: "hid", device, key },
  }));

  device.addEventListener("inputreport", (event) => {
    const bytes = bytesFromDataView(event.data);
    const isNintendo = device.vendorId === NINTENDO_VENDOR_ID;
    const report = {
      kind: isNintendo ? "wiimote" : "hid",
      type: "hid",
      productName: device.productName || "HID Controller",
      vendorId: device.vendorId,
      productId: device.productId,
      reportId: event.reportId,
      bytes,
      wiimote: isNintendo ? parseWiimoteButtons(event.reportId, bytes) : null,
      receivedAt: Date.now(),
    };
    publishReport(report);
    renderReport(reportBox, report);
  });

  status.textContent = `Connected: ${describeController(device)}\nInput reports will appear below when you press buttons.`;
}

function renderReport(reportBox, report) {
  if (!reportBox) return;
  const lines = [
    `Device: ${report.productName}`,
    `Report: 0x${report.reportId.toString(16)}`,
    `Bytes: ${report.bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ")}`,
  ];
  if (report.wiimote) {
    lines.push(`Pressed: ${report.wiimote.pressed.length ? report.wiimote.pressed.join(", ") : "none"}`);
    if (report.wiimote.accelerometer) {
      const { x, y, z } = report.wiimote.accelerometer;
      lines.push(`Accel: x=${x} y=${y} z=${z}`);
    }
  }
  reportBox.textContent = lines.join("\n");
}

async function connectWiimote(status, reportBox) {
  if (!navigator.hid?.requestDevice) {
    status.textContent = "WebHID is not available in this browser. Use a Chromium-based secure context, or pair the controller with the OS and use the Gamepad API if it appears there.";
    return;
  }

  status.textContent = "Choose a Nintendo HID device. Put the Wii Remote in pairing mode first, or pair it in your OS Bluetooth settings.";
  const devices = await navigator.hid.requestDevice({
    filters: [{ vendorId: NINTENDO_VENDOR_ID }],
  });
  if (!devices.length) {
    status.textContent = "No Nintendo HID device selected.";
    return;
  }
  await openHidDevice(devices[0], status, reportBox);
}

async function connectAnyHid(status, reportBox) {
  if (!navigator.hid?.requestDevice) {
    status.textContent = "WebHID is not available in this browser.";
    return;
  }

  const devices = await navigator.hid.requestDevice({ filters: [] });
  if (!devices.length) {
    status.textContent = "No HID device selected.";
    return;
  }
  await openHidDevice(devices[0], status, reportBox);
}

async function connectBle(status) {
  if (!navigator.bluetooth?.requestDevice) {
    status.textContent = "Web Bluetooth is not available in this browser.";
    return;
  }

  status.textContent = "Searching for Bluetooth Low Energy devices. Wii Remotes usually do not appear here because they use Bluetooth HID rather than BLE GATT.";
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: ["battery_service", "device_information"],
  });
  state.controllers.set(`ble:${device.id}`, { type: "ble", device, connectedAt: Date.now() });
  setNodevisionState({ connectedType: "ble", connectedName: device.name || "BLE device" });
  window.dispatchEvent(new CustomEvent("nv-bluetooth-controller-connected", {
    detail: { type: "ble", device },
  }));
  status.textContent = `Bluetooth LE device granted: ${device.name || device.id}. If it exposes GATT services, feature-specific code can connect to them next.`;
}

async function reconnectKnownHid(status, reportBox) {
  if (!navigator.hid?.getDevices) {
    status.textContent = "WebHID is not available in this browser.";
    return;
  }
  const devices = await navigator.hid.getDevices();
  const nintendo = devices.find((device) => device.vendorId === NINTENDO_VENDOR_ID);
  const device = nintendo || devices[0];
  if (!device) {
    status.textContent = "No previously granted HID controllers found.";
    return;
  }
  await openHidDevice(device, status, reportBox);
}

function connectedSummary() {
  if (!state.controllers.size) return "No controllers connected in this session.";
  return Array.from(state.controllers.values())
    .map((entry) => entry.device?.productName || entry.device?.name || entry.type)
    .join("\n");
}

export function openBluetoothControllerOverlay() {
  ensureStyles();
  document.getElementById(OVERLAY_ID)?.remove();

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.className = "nv-bt-controller-overlay";
  overlay.innerHTML = `
    <section class="nv-bt-controller-panel" role="dialog" aria-modal="true" aria-labelledby="nv-bt-controller-title">
      <header class="nv-bt-controller-header">
        <h2 id="nv-bt-controller-title" class="nv-bt-controller-title">Connect Bluetooth Controller</h2>
        <button type="button" class="nv-bt-controller-close" data-close aria-label="Close">X</button>
      </header>
      <div class="nv-bt-controller-body">
        <p class="nv-bt-controller-note">Wii Remote support uses WebHID because Wii Remotes are Bluetooth HID controllers. Pair the Wii Remote in your operating system first if it does not appear in the device picker.</p>
        <div class="nv-bt-controller-grid">
          <section class="nv-bt-controller-section">
            <h3>Wii Remote</h3>
            <p>Press 1 + 2 on the Wii Remote, then choose the Nintendo HID device.</p>
            <div class="nv-bt-controller-row">
              <button type="button" data-connect-wiimote>Connect Wii Remote</button>
              <button type="button" data-reconnect-hid>Reconnect Known</button>
            </div>
          </section>
          <section class="nv-bt-controller-section">
            <h3>Other Controllers</h3>
            <p>Use HID for most game controllers. BLE is for Low Energy GATT devices.</p>
            <div class="nv-bt-controller-row">
              <button type="button" data-connect-hid>Connect HID</button>
              <button type="button" data-connect-ble>Connect BLE</button>
            </div>
          </section>
        </div>
        <div class="nv-bt-controller-status" data-status>${connectedSummary()}</div>
        <div class="nv-bt-controller-report" data-report>Waiting for controller input.</div>
      </div>
      <footer class="nv-bt-controller-actions">
        <button type="button" data-close>Done</button>
      </footer>
    </section>
  `;

  const status = overlay.querySelector("[data-status]");
  const reportBox = overlay.querySelector("[data-report]");
  const close = () => overlay.remove();
  overlay.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", close));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector("[data-connect-wiimote]").addEventListener("click", async () => {
    try { await connectWiimote(status, reportBox); }
    catch (err) { status.textContent = err?.message || "Unable to connect Wii Remote."; }
  });
  overlay.querySelector("[data-reconnect-hid]").addEventListener("click", async () => {
    try { await reconnectKnownHid(status, reportBox); }
    catch (err) { status.textContent = err?.message || "Unable to reconnect controller."; }
  });
  overlay.querySelector("[data-connect-hid]").addEventListener("click", async () => {
    try { await connectAnyHid(status, reportBox); }
    catch (err) { status.textContent = err?.message || "Unable to connect HID controller."; }
  });
  overlay.querySelector("[data-connect-ble]").addEventListener("click", async () => {
    try { await connectBle(status); }
    catch (err) { status.textContent = err?.message || "Unable to connect Bluetooth LE device."; }
  });

  document.body.appendChild(overlay);
  setNodevisionState();
}

export default openBluetoothControllerOverlay;
