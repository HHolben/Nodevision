// Nodevision/public/PanelInstances/ViewPanels/GameViewDependencies/worldPropertiesPanel.mjs
// Floating world-level properties editor for creative mode.

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";

const DEFAULT_ENVIRONMENT = {
  skyColor: "#0f1c2b",
  floorColor: "#333333",
  backgroundMode: "color",
  backgroundImage: "",
  floorImage: ""
};

function createField(labelText, inputEl, container) {
  const wrapper = document.createElement("label");
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.gap = "4px";
  wrapper.style.fontSize = "12px";
  wrapper.textContent = labelText;
  wrapper.appendChild(inputEl);
  container.appendChild(wrapper);
  return inputEl;
}

export function createWorldPropertiesPanel({ movementState }) {
  let visible = false;
  const floatingPanel = createFloatingInventoryPanel({
    title: "World Properties",
    onRequestClose: () => {
      visible = false;
      floatingPanel.setVisible(false);
    }
  });
  floatingPanel.setVisible(false);

  const root = document.createElement("div");
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.gap = "10px";
  root.style.font = "12px/1.3 monospace";
  floatingPanel.content.appendChild(root);

  function labeledInput(labelText, inputEl) {
    const wrapper = document.createElement("label");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.gap = "4px";
    wrapper.textContent = labelText;
    wrapper.appendChild(inputEl);
    root.appendChild(wrapper);
    return inputEl;
  }

  const modeSelect = labeledInput("World Mode", document.createElement("select"));
  ["3d", "2d"].forEach((mode) => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode.toUpperCase();
    modeSelect.appendChild(option);
  });

  const titleInput = labeledInput("World Title", document.createElement("input"));
  titleInput.type = "text";
  titleInput.placeholder = "Optional title";

  const descriptionInput = labeledInput("Description", document.createElement("textarea"));
  descriptionInput.rows = 3;
  descriptionInput.placeholder = "Optional description";

  const abilitiesBox = document.createElement("div");
  abilitiesBox.style.display = "grid";
  abilitiesBox.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  abilitiesBox.style.gap = "8px";
  root.appendChild(abilitiesBox);

  function createRuleToggle(labelText) {
    const box = document.createElement("label");
    box.style.display = "flex";
    box.style.alignItems = "center";
    box.style.gap = "6px";
    const input = document.createElement("input");
    input.type = "checkbox";
    box.appendChild(input);
    const label = document.createElement("span");
    label.textContent = labelText;
    box.appendChild(label);
    abilitiesBox.appendChild(box);
    return input;
  }

  const allowFlyInput = createRuleToggle("Allow Fly");
  const allowRollInput = createRuleToggle("Allow Roll");
  const allowPitchInput = createRuleToggle("Allow Pitch");
  const allowPlaceInput = createRuleToggle("Allow Place");
  const allowBreakInput = createRuleToggle("Allow Break");
  const allowInspectInput = createRuleToggle("Allow Inspect");
  const allowToolUseInput = createRuleToggle("Allow Tool Use");
  const allowSaveInput = createRuleToggle("Allow Save");

  const statusLine = document.createElement("div");
  statusLine.style.opacity = "0.85";
  root.appendChild(statusLine);

  const environmentSection = document.createElement("div");
  environmentSection.style.display = "flex";
  environmentSection.style.flexDirection = "column";
  environmentSection.style.gap = "8px";
  environmentSection.style.paddingTop = "6px";
  environmentSection.style.borderTop = "1px solid rgba(255,255,255,0.1)";
  root.appendChild(environmentSection);

  const envTitle = document.createElement("div");
  envTitle.textContent = "Environment";
  envTitle.style.fontWeight = "600";
  environmentSection.appendChild(envTitle);

  const envGrid = document.createElement("div");
  envGrid.style.display = "grid";
  envGrid.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  envGrid.style.gap = "8px";
  environmentSection.appendChild(envGrid);

  const skyColorInput = createField("Sky Color", (() => {
    const input = document.createElement("input");
    input.type = "color";
    return input;
  })(), envGrid);

  const floorColorInput = createField("Floor Color", (() => {
    const input = document.createElement("input");
    input.type = "color";
    return input;
  })(), envGrid);

  const skyImageInput = createField("Sky Image URL", (() => {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "https://example.com/sky.png";
    input.style.fontSize = "12px";
    return input;
  })(), environmentSection);

  const floorImageInput = createField("Floor Image URL", (() => {
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "https://example.com/floor.png";
    input.style.fontSize = "12px";
    return input;
  })(), environmentSection);

  const envButtonRow = document.createElement("div");
  envButtonRow.style.display = "flex";
  envButtonRow.style.gap = "8px";
  environmentSection.appendChild(envButtonRow);

  const applyColorsBtn = document.createElement("button");
  applyColorsBtn.type = "button";
  applyColorsBtn.textContent = "Apply Colors";
  envButtonRow.appendChild(applyColorsBtn);

  const skyImageBtn = document.createElement("button");
  skyImageBtn.type = "button";
  skyImageBtn.textContent = "Use Sky Image";
  envButtonRow.appendChild(skyImageBtn);

  const floorImageBtn = document.createElement("button");
  floorImageBtn.type = "button";
  floorImageBtn.textContent = "Apply Floor Image";
  envButtonRow.appendChild(floorImageBtn);

  const envStatusLine = document.createElement("div");
  envStatusLine.style.opacity = "0.85";
  environmentSection.appendChild(envStatusLine);

  applyColorsBtn.addEventListener("click", () => {
    const sky = skyColorInput.value || DEFAULT_ENVIRONMENT.skyColor;
    const floor = floorColorInput.value || DEFAULT_ENVIRONMENT.floorColor;
    applyEnvironment({
      backgroundMode: "color",
      backgroundImage: "",
      skyColor: sky,
      floorColor: floor,
      floorImage: ""
    }, "Environment colors applied.");
  });

  skyImageBtn.addEventListener("click", () => {
    const url = String(skyImageInput.value || "").trim();
    if (!url) {
      envStatusLine.textContent = "Provide a sky image URL.";
      return;
    }
    applyEnvironment({
      backgroundMode: "image",
      backgroundImage: url
    }, "Sky image loading.");
  });

  floorImageBtn.addEventListener("click", () => {
    const url = String(floorImageInput.value || "").trim();
    if (!url) {
      envStatusLine.textContent = "Provide a floor image URL.";
      return;
    }
    applyEnvironment({ floorImage: url }, "Floor image loading.");
  });

  const buttonRow = document.createElement("div");
  buttonRow.style.display = "flex";
  buttonRow.style.gap = "8px";
  root.appendChild(buttonRow);

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.textContent = "Apply";
  buttonRow.appendChild(applyBtn);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => floatingPanel.setVisible(false));
  buttonRow.appendChild(closeBtn);

  function refreshFromState() {
    const worldMode = movementState?.worldMode === "2d" ? "2d" : "3d";
    modeSelect.value = worldMode;
    const worldRules = movementState?.worldRules || {};
    allowFlyInput.checked = worldRules.allowFly === true;
    allowRollInput.checked = worldRules.allowRoll === true;
    allowPitchInput.checked = worldRules.allowPitch === true;
    allowPlaceInput.checked = worldRules.allowPlace === true;
    allowBreakInput.checked = worldRules.allowBreak === true;
    allowInspectInput.checked = worldRules.allowInspect === true;
    allowToolUseInput.checked = worldRules.allowToolUse === true;
    allowSaveInput.checked = worldRules.allowSave === true;

    const metadata = window.VRWorldContext?.currentWorldDefinition?.metadata || {};
    titleInput.value = typeof metadata.title === "string" ? metadata.title : "";
    descriptionInput.value = typeof metadata.description === "string" ? metadata.description : "";
    statusLine.textContent = `World: ${window.VRWorldContext?.currentWorldPath || "(unsaved)"}`;
  }

  function getEnvironmentState() {
    const env = movementState?.environment || {};
    return {
      ...DEFAULT_ENVIRONMENT,
      ...env
    };
  }

  function refreshEnvironmentFields() {
    const env = getEnvironmentState();
    skyColorInput.value = env.skyColor || DEFAULT_ENVIRONMENT.skyColor;
    floorColorInput.value = env.floorColor || DEFAULT_ENVIRONMENT.floorColor;
    skyImageInput.value = env.backgroundImage || "";
    floorImageInput.value = env.floorImage || "";
    envStatusLine.textContent = env.backgroundMode === "image" && env.backgroundImage
      ? "Sky image active."
      : env.floorImage
        ? "Floor image active."
        : "";
  }

  function applyEnvironment(overrides, statusMessage) {
    const consolePanels = window.VRWorldContext?.consolePanels;
    if (consolePanels?.applyEnvironmentState) {
      consolePanels.applyEnvironmentState(overrides);
    } else if (movementState) {
      movementState.environment = {
        ...(movementState.environment || {}),
        ...overrides
      };
    }
    refreshEnvironmentFields();
    if (typeof statusMessage === "string") {
      envStatusLine.textContent = statusMessage;
    }
  }

  function applyToState() {
    if (!movementState) return;
    movementState.worldMode = modeSelect.value === "2d" ? "2d" : "3d";
    movementState.worldRules = {
      ...(movementState.worldRules || {}),
      allowFly: allowFlyInput.checked,
      allowRoll: allowRollInput.checked,
      allowPitch: allowPitchInput.checked,
      allowPlace: allowPlaceInput.checked,
      allowBreak: allowBreakInput.checked,
      allowInspect: allowInspectInput.checked,
      allowToolUse: allowToolUseInput.checked,
      allowSave: allowSaveInput.checked
    };

    const worldDef = window.VRWorldContext?.currentWorldDefinition;
    if (worldDef && typeof worldDef === "object") {
      worldDef.worldMode = movementState.worldMode;
      worldDef.metadata = {
        ...(worldDef.metadata || {}),
        title: titleInput.value.trim(),
        description: descriptionInput.value.trim()
      };
    }
  }

  applyBtn.addEventListener("click", () => {
    applyToState();
    refreshFromState();
  });

  return {
    open() {
      refreshFromState();
      refreshEnvironmentFields();
      visible = true;
      floatingPanel.setVisible(true);
    },
    close() {
      visible = false;
      floatingPanel.setVisible(false);
    },
    isVisible() {
      return visible;
    },
    dispose() {
      floatingPanel.dispose();
    }
  };
}
