// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldPropertiesPanel.mjs
// This file defines browser-side world Properties Panel logic for the Nodevision UI. It renders interface components and handles user interactions.

import { createFloatingInventoryPanel } from "/PanelInstances/InfoPanels/PlayerInventory.mjs";
import { normalizeMetaWorldMultiplayer } from "/MetaWorld/MetaWorldMultiplayerConfig.mjs";

const DEFAULT_ENVIRONMENT = {
  skyColor: "#ffffff",
  floorColor: "#d8dee4",
  backgroundMode: "color",
  backgroundImage: "",
  floorImage: "",
  dayNightCycle: {
    enabled: false,
    durationSeconds: 120,
    periods: [
      { time: 0, brightness: 1 }
    ]
  }
};

function cloneDefaultDayNightCycle() {
  return {
    enabled: false,
    durationSeconds: 120,
    periods: [
      { time: 0, brightness: 1 }
    ]
  };
}

function clampFiniteNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeDayNightPeriod(period, fallbackTime = 0) {
  const source = period && typeof period === "object" ? period : {};
  return {
    time: clampFiniteNumber(source.time ?? source.timeSeconds ?? source.at ?? source.offset, 0, Number.MAX_SAFE_INTEGER, fallbackTime),
    brightness: clampFiniteNumber(source.brightness ?? source.level ?? source.intensity, 0, 1, 1)
  };
}

function normalizeDayNightCycle(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const durationSeconds = clampFiniteNumber(source.durationSeconds ?? source.duration ?? source.cycleSeconds, 1, 86400, DEFAULT_ENVIRONMENT.dayNightCycle.durationSeconds);
  const sourcePeriods = Array.isArray(source.periods)
    ? source.periods
    : Array.isArray(source.keyframes)
      ? source.keyframes
      : [];
  const periods = sourcePeriods
    .map((period, index) => normalizeDayNightPeriod(period, index === 0 ? 0 : durationSeconds * index / Math.max(sourcePeriods.length, 1)))
    .map((period) => ({
      time: clampFiniteNumber(period.time, 0, durationSeconds, 0),
      brightness: clampFiniteNumber(period.brightness, 0, 1, 1)
    }))
    .sort((a, b) => a.time - b.time);
  return {
    enabled: source.enabled === true,
    durationSeconds,
    periods: periods.length ? periods : cloneDefaultDayNightCycle().periods
  };
}

function normalizeEnvironmentState(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const environment = {
    ...DEFAULT_ENVIRONMENT,
    ...source
  };
  environment.dayNightCycle = normalizeDayNightCycle(source.dayNightCycle ?? source.dayNight ?? source.lightCycle ?? DEFAULT_ENVIRONMENT.dayNightCycle);
  return environment;
}

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
    closeBehavior: "hide",
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

  const cycleSection = document.createElement("div");
  cycleSection.style.display = "flex";
  cycleSection.style.flexDirection = "column";
  cycleSection.style.gap = "8px";
  cycleSection.style.paddingTop = "6px";
  cycleSection.style.borderTop = "1px solid rgba(255,255,255,0.08)";
  environmentSection.appendChild(cycleSection);

  const cycleTitle = document.createElement("div");
  cycleTitle.textContent = "Day / Night Cycle";
  cycleTitle.style.fontWeight = "600";
  cycleSection.appendChild(cycleTitle);

  const cycleHeader = document.createElement("div");
  cycleHeader.style.display = "grid";
  cycleHeader.style.gridTemplateColumns = "minmax(0, 1fr) minmax(90px, 140px)";
  cycleHeader.style.gap = "8px";
  cycleSection.appendChild(cycleHeader);

  const dayNightEnabledInput = createField("Enabled", (() => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.style.width = "auto";
    return input;
  })(), cycleHeader);

  const cycleDurationInput = createField("Cycle Length (s)", (() => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.step = "1";
    input.value = "120";
    return input;
  })(), cycleHeader);

  const cycleRows = document.createElement("div");
  cycleRows.style.display = "flex";
  cycleRows.style.flexDirection = "column";
  cycleRows.style.gap = "6px";
  cycleSection.appendChild(cycleRows);

  const cycleButtonRow = document.createElement("div");
  cycleButtonRow.style.display = "flex";
  cycleButtonRow.style.gap = "8px";
  cycleButtonRow.style.flexWrap = "wrap";
  cycleSection.appendChild(cycleButtonRow);

  const addPeriodBtn = document.createElement("button");
  addPeriodBtn.type = "button";
  addPeriodBtn.textContent = "Add Period";
  cycleButtonRow.appendChild(addPeriodBtn);

  const applyCycleBtn = document.createElement("button");
  applyCycleBtn.type = "button";
  applyCycleBtn.textContent = "Apply Cycle";
  cycleButtonRow.appendChild(applyCycleBtn);

  const resetCycleBtn = document.createElement("button");
  resetCycleBtn.type = "button";
  resetCycleBtn.textContent = "Full Brightness";
  cycleButtonRow.appendChild(resetCycleBtn);

  function formatCycleNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : String(Math.round(number * 100) / 100);
  }

  function refreshCycleRemoveButtons() {
    const buttons = Array.from(cycleRows.querySelectorAll("[data-remove-cycle-period]"));
    buttons.forEach((button) => {
      button.disabled = buttons.length <= 1;
    });
  }

  function createCyclePeriodRow(period = { time: 0, brightness: 1 }) {
    const row = document.createElement("div");
    row.dataset.cycleRow = "true";
    row.style.display = "grid";
    row.style.gridTemplateColumns = "minmax(72px, 1fr) minmax(84px, 1fr) auto";
    row.style.gap = "6px";
    row.style.alignItems = "end";

    const timeInput = document.createElement("input");
    timeInput.type = "number";
    timeInput.min = "0";
    timeInput.step = "1";
    timeInput.value = formatCycleNumber(period.time);
    timeInput.dataset.cycleTime = "true";
    createField("Time (s)", timeInput, row);

    const brightnessInput = document.createElement("input");
    brightnessInput.type = "number";
    brightnessInput.min = "0";
    brightnessInput.max = "1";
    brightnessInput.step = "0.05";
    brightnessInput.value = formatCycleNumber(period.brightness);
    brightnessInput.dataset.cycleBrightness = "true";
    createField("Brightness", brightnessInput, row);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.textContent = "Remove";
    removeBtn.dataset.removeCyclePeriod = "true";
    row.appendChild(removeBtn);

    timeInput.addEventListener("change", () => applyCycle("Day/night cycle updated."));
    brightnessInput.addEventListener("change", () => applyCycle("Day/night cycle updated."));
    removeBtn.addEventListener("click", () => {
      row.remove();
      ensureCyclePeriod();
      refreshCycleRemoveButtons();
      applyCycle("Day/night period removed.");
    });
    return row;
  }

  function ensureCyclePeriod() {
    if (!cycleRows.querySelector("[data-cycle-row]")) {
      cycleRows.appendChild(createCyclePeriodRow({ time: 0, brightness: 1 }));
    }
  }

  function setCycleFields(cycle) {
    const normalized = normalizeDayNightCycle(cycle);
    dayNightEnabledInput.checked = normalized.enabled;
    cycleDurationInput.value = formatCycleNumber(normalized.durationSeconds);
    cycleRows.replaceChildren();
    normalized.periods.forEach((period) => {
      cycleRows.appendChild(createCyclePeriodRow(period));
    });
    ensureCyclePeriod();
    refreshCycleRemoveButtons();
  }

  function readCycleFromFields() {
    const rows = Array.from(cycleRows.querySelectorAll("[data-cycle-row]"));
    const periods = rows.map((row, index) => {
      const timeInput = row.querySelector("[data-cycle-time]");
      const brightnessInput = row.querySelector("[data-cycle-brightness]");
      return {
        time: Number(timeInput?.value ?? index),
        brightness: Number(brightnessInput?.value ?? 1)
      };
    });
    return normalizeDayNightCycle({
      enabled: dayNightEnabledInput.checked,
      durationSeconds: Number(cycleDurationInput.value),
      periods
    });
  }

  function applyCycle(statusMessage = "Day/night cycle applied.") {
    const cycle = readCycleFromFields();
    setCycleFields(cycle);
    applyEnvironment({ dayNightCycle: cycle }, statusMessage);
  }

  addPeriodBtn.addEventListener("click", () => {
    const cycle = readCycleFromFields();
    const nextTime = Math.min(
      cycle.durationSeconds,
      Math.round((cycle.durationSeconds * cycle.periods.length / Math.max(cycle.periods.length + 1, 2)) * 100) / 100
    );
    cycleRows.appendChild(createCyclePeriodRow({ time: nextTime, brightness: 1 }));
    refreshCycleRemoveButtons();
    applyCycle("Day/night period added.");
  });

  applyCycleBtn.addEventListener("click", () => applyCycle());
  resetCycleBtn.addEventListener("click", () => {
    setCycleFields(cloneDefaultDayNightCycle());
    applyCycle("Full brightness restored.");
  });
  dayNightEnabledInput.addEventListener("change", () => {
    applyCycle(dayNightEnabledInput.checked ? "Day/night cycle enabled." : "Day/night cycle disabled.");
  });
  cycleDurationInput.addEventListener("change", () => applyCycle("Cycle length updated."));

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

  const multiplayerSection = document.createElement("div");
  multiplayerSection.style.display = "flex";
  multiplayerSection.style.flexDirection = "column";
  multiplayerSection.style.gap = "8px";
  multiplayerSection.style.paddingTop = "6px";
  multiplayerSection.style.borderTop = "1px solid rgba(255,255,255,0.1)";
  root.appendChild(multiplayerSection);

  const multiplayerTitle = document.createElement("div");
  multiplayerTitle.textContent = "Multiplayer";
  multiplayerTitle.style.fontWeight = "600";
  multiplayerSection.appendChild(multiplayerTitle);

  const multiplayerGrid = document.createElement("div");
  multiplayerGrid.style.display = "grid";
  multiplayerGrid.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
  multiplayerGrid.style.gap = "8px";
  multiplayerSection.appendChild(multiplayerGrid);

  const multiplayerEnabledInput = createField("Enable Presence", (() => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.style.width = "auto";
    return input;
  })(), multiplayerGrid);

  const multiplayerShowNamesInput = createField("Show Names", (() => {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.style.width = "auto";
    return input;
  })(), multiplayerGrid);

  const multiplayerPublishRateInput = createField("Publish Rate (ms)", (() => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "250";
    input.max = "5000";
    input.step = "50";
    return input;
  })(), multiplayerGrid);

  const multiplayerSnapshotRateInput = createField("Snapshot Rate (ms)", (() => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "300";
    input.max = "5000";
    input.step = "50";
    return input;
  })(), multiplayerGrid);

  const multiplayerAvatarScaleInput = createField("Avatar Scale", (() => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0.35";
    input.max = "2.5";
    input.step = "0.05";
    return input;
  })(), multiplayerGrid);

  const multiplayerStatusLine = document.createElement("div");
  multiplayerStatusLine.style.opacity = "0.85";
  multiplayerSection.appendChild(multiplayerStatusLine);

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
    return normalizeEnvironmentState({
      ...DEFAULT_ENVIRONMENT,
      ...env
    });
  }

  function refreshEnvironmentFields() {
    const env = getEnvironmentState();
    skyColorInput.value = env.skyColor || DEFAULT_ENVIRONMENT.skyColor;
    floorColorInput.value = env.floorColor || DEFAULT_ENVIRONMENT.floorColor;
    skyImageInput.value = env.backgroundImage || "";
    floorImageInput.value = env.floorImage || "";
    setCycleFields(env.dayNightCycle);
    envStatusLine.textContent = env.backgroundMode === "image" && env.backgroundImage
      ? "Sky image active."
      : env.floorImage
        ? "Floor image active."
        : "";
  }

  function syncWorldEnvironment(env) {
    const definition = normalizeEnvironmentState(env);
    const worldDef = window.VRWorldContext?.currentWorldDefinition;
    if (worldDef && typeof worldDef === "object") {
      worldDef.environment = {
        ...(worldDef.environment || {}),
        ...definition
      };
      worldDef.metadata = worldDef.metadata && typeof worldDef.metadata === "object" ? worldDef.metadata : {};
      worldDef.metadata.environment = {
        ...(worldDef.metadata.environment || {}),
        ...definition
      };
    }
    if (window.NodevisionState) window.NodevisionState.fileIsDirty = true;
    return definition;
  }

  function applyEnvironment(overrides, statusMessage) {
    const sourceOverrides = overrides && typeof overrides === "object" ? overrides : {};
    const nextEnvironment = normalizeEnvironmentState({
      ...getEnvironmentState(),
      ...sourceOverrides
    });
    const consolePanels = window.VRWorldContext?.consolePanels;
    if (consolePanels?.applyEnvironmentState) {
      consolePanels.applyEnvironmentState(sourceOverrides);
    } else if (movementState) {
      movementState.environment = nextEnvironment;
    }
    syncWorldEnvironment(movementState?.environment || nextEnvironment);
    refreshEnvironmentFields();
    if (typeof statusMessage === "string") {
      envStatusLine.textContent = statusMessage;
    }
  }

  function getMultiplayerState() {
    const worldDef = window.VRWorldContext?.currentWorldDefinition || {};
    return normalizeMetaWorldMultiplayer(
      movementState?.multiplayer
      || worldDef?.metadata?.multiplayer
      || worldDef?.multiplayer
      || {}
    );
  }

  function formatMultiplayerNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : String(Math.round(number * 100) / 100);
  }

  function setMultiplayerFields(multiplayer) {
    const normalized = normalizeMetaWorldMultiplayer(multiplayer);
    multiplayerEnabledInput.checked = normalized.enabled;
    multiplayerShowNamesInput.checked = normalized.showNames !== false;
    multiplayerPublishRateInput.value = formatMultiplayerNumber(normalized.publishRateMs);
    multiplayerSnapshotRateInput.value = formatMultiplayerNumber(normalized.snapshotRateMs);
    multiplayerAvatarScaleInput.value = formatMultiplayerNumber(normalized.avatarScale);
  }

  function refreshMultiplayerFields() {
    const multiplayer = getMultiplayerState();
    setMultiplayerFields(multiplayer);
    const runtimeStatus = window.VRWorldContext?.multiplayerClient?.getStatus?.();
    multiplayerStatusLine.textContent = multiplayer.enabled
      ? (runtimeStatus?.status || "Multiplayer presence enabled.")
      : "Multiplayer presence disabled.";
  }

  function readMultiplayerFromFields() {
    return normalizeMetaWorldMultiplayer({
      enabled: multiplayerEnabledInput.checked,
      showNames: multiplayerShowNamesInput.checked,
      publishRateMs: Number(multiplayerPublishRateInput.value),
      snapshotRateMs: Number(multiplayerSnapshotRateInput.value),
      avatarScale: Number(multiplayerAvatarScaleInput.value)
    });
  }

  function syncWorldMultiplayer(multiplayer) {
    const definition = normalizeMetaWorldMultiplayer(multiplayer);
    if (movementState) movementState.multiplayer = definition;
    const worldDef = window.VRWorldContext?.currentWorldDefinition;
    if (worldDef && typeof worldDef === "object") {
      worldDef.multiplayer = definition;
      worldDef.metadata = worldDef.metadata && typeof worldDef.metadata === "object" ? worldDef.metadata : {};
      worldDef.metadata.multiplayer = definition;
    }
    window.VRWorldContext?.multiplayerClient?.configure?.({
      worldPath: window.VRWorldContext?.currentWorldPath || window.selectedFilePath || "",
      settings: definition
    });
    if (window.NodevisionState) window.NodevisionState.fileIsDirty = true;
    return definition;
  }

  function applyMultiplayer(statusMessage = "Multiplayer settings applied.") {
    const multiplayer = syncWorldMultiplayer(readMultiplayerFromFields());
    setMultiplayerFields(multiplayer);
    multiplayerStatusLine.textContent = statusMessage;
  }

  [
    multiplayerEnabledInput,
    multiplayerShowNamesInput,
    multiplayerPublishRateInput,
    multiplayerSnapshotRateInput,
    multiplayerAvatarScaleInput
  ].forEach((input) => {
    input.addEventListener("change", () => applyMultiplayer("Multiplayer settings updated."));
  });

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
    if (window.NodevisionState) window.NodevisionState.fileIsDirty = true;
  }

  applyBtn.addEventListener("click", () => {
    applyToState();
    applyCycle("World properties applied.");
    applyMultiplayer("World properties applied.");
    refreshFromState();
  });

  return {
    open() {
      refreshFromState();
      refreshEnvironmentFields();
      refreshMultiplayerFields();
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
