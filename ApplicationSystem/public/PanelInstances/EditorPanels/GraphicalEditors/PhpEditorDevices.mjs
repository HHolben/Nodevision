// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorDevices.mjs
// This module provides placeholder device drivers, device registration and gamepad sampling.


export function nowIso() {
  return new Date().toISOString();
}

export const DEVICE_DRIVERS = {
  serial: {
    async connect(device) {
      device.driverNote = "Serial driver placeholder (Web Serial / native bridge).";
      device.values = { value: 0 };
    },
    async poll(device) {
      if (typeof device.values.value !== "number") device.values.value = 0;
      device.values.value = Number((device.values.value + 0.05) % 100).toFixed(3);
      device.values.value = Number(device.values.value);
    }
  },
  usb: {
    async connect(device) {
      device.driverNote = "USB driver placeholder (WebUSB / native bridge).";
      device.values = { state: 0 };
    },
    async poll(device) {
      device.values.state = Number(device.values.state || 0) ^ 1;
    }
  },
  gpio: {
    async connect(device) {
      device.driverNote = "GPIO driver placeholder (Node bridge required).";
      device.values = { pin: 17, value: 0 };
    },
    async poll(device) {
      device.values.value = Number((Date.now() / 500) % 2 >= 1);
    }
  },
  http: {
    async connect(device) {
      device.driverNote = "HTTP driver placeholder (AJAX polling endpoint).";
      device.values = { value: 0, endpoint: "/api/device/http-placeholder" };
    },
    async poll(device) {
      // Placeholder for real AJAX poll:
      // const res = await fetch(device.values.endpoint); device.values.value = (await res.json()).value;
      device.values.value = Number((50 + Math.sin(Date.now() / 800) * 30).toFixed(3));
    }
  },
  websocket: {
    async connect(device) {
      device.driverNote = "WebSocket driver placeholder.";
      device.values = { connected: false, value: 0 };
    },
    async poll(device) {
      device.values.connected = true;
      device.values.value = Number((Math.cos(Date.now() / 700) * 0.9).toFixed(3));
    }
  },
  mqtt: {
    async connect(device) {
      device.driverNote = "MQTT driver placeholder (broker bridge required).";
      device.values = { topic: "nodevision/sensor", value: 0 };
    },
    async poll(device) {
      device.values.value = Number((Math.sin(Date.now() / 1200) * 100).toFixed(2));
    }
  },
  "gamepad-api": {
    async connect(device) {
      device.driverNote = "Gamepad API driver.";
      device.values = { axes: [0, 0], buttons: [false, false], triggerL: 0, triggerR: 0 };
    },
    async poll(device, runtime) {
      const gp = runtime?.gamepad || null;
      if (!gp) return;
      device.values.axes = gp.axes.slice(0, 4).map((v) => Number(v.toFixed(3)));
      device.values.buttons = gp.buttons.slice(0, 8);
      device.values.triggerL = Number(gp.triggers.left.toFixed(3));
      device.values.triggerR = Number(gp.triggers.right.toFixed(3));
    }
  }
};

export function createDeviceNode(state, type, protocol, name, extra = {}) {
  const id = `dev-${state.deviceManager.nextId++}`;
  const node = {
    id,
    type,
    protocol,
    name: name || `${type}-${id}`,
    connectedAt: nowIso(),
    values: {},
    ...extra
  };
  state.deviceManager.connected.push(node);
  return node;
}

export function readGamepadValues() {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
  const pads = navigator.getGamepads();
  if (!pads) return null;
  const pad = Array.from(pads).find(Boolean);
  if (!pad) return null;
  return {
    axes: (pad.axes || []).slice(0, 8),
    buttons: (pad.buttons || []).slice(0, 12).map((b) => Boolean(b?.pressed)),
    triggers: {
      left: Number(pad.buttons?.[6]?.value || 0),
      right: Number(pad.buttons?.[7]?.value || 0)
    }
  };
}
