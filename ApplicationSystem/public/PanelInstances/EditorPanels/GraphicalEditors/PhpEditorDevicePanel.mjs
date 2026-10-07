// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorDevicePanel.mjs
// This module builds the PHP device connection and sample-device management panel.
import { createDeviceNode, DEVICE_DRIVERS } from './PhpEditorDevices.mjs';

export function buildDeviceManagerPanel(state, panel) {
  panel.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "nv-php-grid";
  panel.appendChild(grid);

  const createCard = document.createElement("div");
  createCard.className = "nv-php-card";
  createCard.innerHTML = `<h3>Connect Device</h3>`;
  grid.appendChild(createCard);

  const typeLabel = document.createElement("label");
  typeLabel.className = "nv-php-label";
  typeLabel.textContent = "Device Type";
  const typeSelect = document.createElement("select");
  ["sensor", "actuator", "gamepad", "custom"].forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    typeSelect.appendChild(o);
  });
  typeLabel.appendChild(typeSelect);
  createCard.appendChild(typeLabel);

  const protoLabel = document.createElement("label");
  protoLabel.className = "nv-php-label";
  protoLabel.textContent = "Protocol";
  const protoSelect = document.createElement("select");
  ["serial", "usb", "gpio", "http", "websocket", "mqtt", "gamepad-api"].forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    protoSelect.appendChild(o);
  });
  protoLabel.appendChild(protoSelect);
  createCard.appendChild(protoLabel);

  const nameLabel = document.createElement("label");
  nameLabel.className = "nv-php-label";
  nameLabel.textContent = "Name";
  const nameInput = document.createElement("input");
  nameInput.placeholder = "e.g. WarehousePad";
  nameLabel.appendChild(nameInput);
  createCard.appendChild(nameLabel);

  const actions = document.createElement("div");
  actions.className = "nv-php-actions";
  createCard.appendChild(actions);

  const listCard = document.createElement("div");
  listCard.className = "nv-php-card";
  listCard.innerHTML = `<h3>Connected Device Nodes</h3>`;
  const list = document.createElement("ul");
  list.className = "nv-php-list";
  listCard.appendChild(list);
  grid.appendChild(listCard);

  function refreshList() {
    list.innerHTML = "";
    state.deviceManager.connected.forEach((device) => {
      const li = document.createElement("li");
      li.textContent = `${device.id} ${device.name} (${device.protocol})`;
      list.appendChild(li);
    });
  }

  const connectBtn = document.createElement("button");
  connectBtn.type = "button";
  connectBtn.textContent = "Connect Device";
  connectBtn.addEventListener("click", async () => {
    const type = typeSelect.value;
    const protocol = protoSelect.value;
    const node = createDeviceNode(state, type, protocol, nameInput.value.trim());
    if (DEVICE_DRIVERS[protocol]?.connect) {
      await DEVICE_DRIVERS[protocol].connect(node);
    } else if (type === "sensor") {
      node.values = { value: 0 };
    } else {
      node.values = { state: 0 };
    }
    refreshList();
  });
  actions.appendChild(connectBtn);

  const seedBtn = document.createElement("button");
  seedBtn.type = "button";
  seedBtn.textContent = "Seed Sample Devices";
  seedBtn.addEventListener("click", () => {
    if (state.deviceManager.connected.length > 0) return;
    createDeviceNode(state, "sensor", "serial", "temperature").values = { value: 22.3 };
    createDeviceNode(state, "sensor", "http", "humidity").values = { value: 50.2 };
    createDeviceNode(state, "gamepad", "gamepad-api", "controller-1").values = {
      axes: [0, 0], buttons: [false, false, false, false], triggerL: 0, triggerR: 0
    };
    refreshList();
  });
  actions.appendChild(seedBtn);

  refreshList();
}
