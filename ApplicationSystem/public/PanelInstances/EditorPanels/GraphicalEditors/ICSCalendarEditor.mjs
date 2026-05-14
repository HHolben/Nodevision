// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ICSCalendarEditor.mjs
// Visual weekly calendar editor for .ics files used by TextFamilyEditor.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { fetchText, saveText, resetEditorHooks } from "./FamilyEditorCommon.mjs";
import { setWordCount } from "/StatusBar.mjs";

const MINUTES_PER_DAY = 24 * 60;
const SLOT_MINUTES = 15;
const MIN_EVENT_MINUTES = 15;
const DRAG_THRESHOLD_PX = 4;
const CURRENT_MODE = "ICSCalendarEditing";
const TIMEZONE_STORAGE_KEY = "nodevision.icseditor.displayTimeZone";
const STYLESHEET_ID = "nv-ics-calendar-editor-css";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const WEEKDAY_INDEX_MAP = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const TIME_ZONE_OPTIONS = [
  { value: "__local__", label: "Local" },
  { value: "America/Chicago", label: "America/Chicago" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Denver", label: "America/Denver" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "UTC", label: "UTC" },
];

const CATEGORY_VISUALS = [
  { tokens: ["GENERAL"], color: "#1565C0", icon: "📌", symbol: "•" },
  { tokens: ["WORK", "CAREER", "JOB"], color: "#0D47A1", icon: "💼", symbol: "■" },
  { tokens: ["MEETING", "CALL"], color: "#00897B", icon: "📞", symbol: "◦" },
  { tokens: ["TRAVEL", "COMMUTE", "DRIVE"], color: "#EF6C00", icon: "🚗", symbol: "→" },
  { tokens: ["HEALTH", "MEDICAL", "FITNESS"], color: "#C62828", icon: "🩺", symbol: "✚" },
  { tokens: ["FAMILY", "PERSONAL"], color: "#6A1B9A", icon: "🏠", symbol: "◆" },
  { tokens: ["STUDY", "LEARNING", "SCHOOL"], color: "#455A64", icon: "📚", symbol: "◇" },
];

const SAFE_NAMED_COLORS = {
  black: true,
  white: true,
  gray: true,
  grey: true,
  red: true,
  green: true,
  blue: true,
  orange: true,
  purple: true,
  yellow: true,
  brown: true,
  teal: true,
  navy: true,
  maroon: true,
  olive: true,
  lime: true,
  aqua: true,
  fuchsia: true,
  silver: true,
  gold: true,
  indigo: true,
  violet: true,
  pink: true,
  coral: true,
  crimson: true,
};

let globalEventSeq = 0;

const dateTimeFormatterCache = {};
const dateHeaderFormatterCache = {};
const weekRangeFormatterCache = {};

export async function renderEditor(filePath, container) {
  if (!container) {
    throw new Error("ICS editor container is required.");
  }

  resetEditorHooks();
  await ensureStylesheet();

  const refs = buildLayout(container);
  const state = {
    filePath,
    refs,
    calendarDoc: null,
    events: [],
    parserWarnings: [],
    invalidEventCount: 0,
    veventCount: 0,
    weekOffset: 0,
    selectedTimeZoneValue: "__local__",
    displayTimeZone: getLocalTimeZone(),
    weekBounds: null,
    selectedEventId: null,
    selectedSlot: null,
    currentTimeIntervalId: null,
    interaction: null,
    renderSegmentsById: new Map(),
    cleanupFns: [],
    dirty: false,
    statusType: "info",
  };

  const handleToolbarAction = (callbackKey) => {
    if (callbackKey === "icsAddEvent") {
      addEvent(state);
    }
  };
  state.handleToolbarAction = handleToolbarAction;

  initializeNodevisionState(state);
  bindUiEvents(state);
  buildTimeZoneControls(state);

  try {
    const text = await fetchText(filePath);
    const parsed = parseCalendarDocument(text);

    state.calendarDoc = parsed.doc;
    state.events = parsed.events;
    state.parserWarnings = parsed.warnings;
    state.invalidEventCount = parsed.invalidEventCount;
    state.veventCount = parsed.veventCount;

    if (!hasAnyEventSections(parsed.doc)) {
      ensureCalendarEnvelope(parsed.doc);
      setStatus(state, "No VEVENT entries found. You can add one with Add Event.", "warning");
    } else if (state.events.length === 0) {
      const base = "VEVENT entries were found, but none had valid times for visual rendering.";
      setStatus(state, state.invalidEventCount > 0 ? `${base} Invalid entries are preserved on save.` : base, "warning");
    }

    renderCalendar(state);
    updateEventEditorPanel(state);
    configureToolbarIntegration(state);
    setWordCount(0);
  } catch (error) {
    setWordCount(0);
    const message = error?.message || "Unknown loading error.";
    refs.statusMessage.textContent = `Failed to load .ics file: ${message}`;
    refs.statusMessage.className = "nv-ics-status nv-ics-status-error";
    refs.calendarSection.classList.add("hidden");
    refs.eventPanel.classList.add("hidden");
  }

  const cleanup = () => cleanupRuntime(state);
  container.__nvActiveEditorCleanup = cleanup;
}

function initializeNodevisionState(state) {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = CURRENT_MODE;
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.selectedFile = state.filePath;
  window.NodevisionState.activeEditorFilePath = state.filePath;
  window.NodevisionState.activeActionHandler = state.handleToolbarAction;

  updateToolbarState({
    currentMode: CURRENT_MODE,
    activePanelType: "GraphicalEditor",
    selectedFile: state.filePath,
    activeActionHandler: state.handleToolbarAction,
    fileIsDirty: false,
  });
}

function configureToolbarIntegration(state) {
  const localToolbar = state.refs.localToolbar;
  const subToolbarHost = document.querySelector("#sub-toolbar");

  if (subToolbarHost) {
    localToolbar.classList.add("hidden");
    window.dispatchEvent(
      new CustomEvent("nv-show-subtoolbar", {
        detail: { heading: "Insert", force: true, toggle: false },
      }),
    );
  } else {
    localToolbar.classList.remove("hidden");
  }
}

function cleanupRuntime(state) {
  if (!state) return;

  if (state.currentTimeIntervalId) {
    clearInterval(state.currentTimeIntervalId);
    state.currentTimeIntervalId = null;
  }

  if (state.interaction) {
    teardownInteraction(state, false);
  }

  while (state.cleanupFns.length > 0) {
    const fn = state.cleanupFns.pop();
    try {
      fn();
    } catch (error) {
      console.warn("ICS editor cleanup callback failed:", error);
    }
  }

  if (window.NodevisionState?.activeActionHandler === state.handleToolbarAction) {
    window.NodevisionState.activeActionHandler = null;
    updateToolbarState({ activeActionHandler: null });
  }
}

async function ensureStylesheet() {
  if (document.getElementById(STYLESHEET_ID)) return;

  const link = document.createElement("link");
  link.id = STYLESHEET_ID;
  link.rel = "stylesheet";
  link.href = "/PanelInstances/EditorPanels/GraphicalEditors/ICSCalendarEditor.css";
  await new Promise((resolve) => {
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener("error", resolve, { once: true });
    document.head.appendChild(link);
  });
}

function buildLayout(container) {
  container.innerHTML = `
    <div class="nv-ics-editor" data-nv-ics-root>
      <div class="nv-ics-local-toolbar hidden" data-nv-ics-local-toolbar>
        <button type="button" class="nv-ics-add-event-btn" data-nv-ics-add-event>Add Event</button>
      </div>

      <div class="nv-ics-status nv-ics-status-info" role="status" aria-live="polite" data-nv-ics-status></div>

      <div class="nv-ics-main" data-nv-ics-main>
        <section class="nv-ics-calendar-section" aria-label="Weekly calendar editor" data-nv-ics-calendar-section>
          <div class="nv-ics-week-info">
            <h1 class="nv-ics-title">Weekly Calendar Editor</h1>
            <div class="nv-ics-week-row">
              <button type="button" class="nv-ics-week-nav" data-nv-ics-week-nav="prev" aria-label="Previous week">◀</button>
              <div class="nv-ics-week-range" data-nv-ics-week-range></div>
              <button type="button" class="nv-ics-week-nav" data-nv-ics-week-nav="next" aria-label="Next week">▶</button>
              <button type="button" class="nv-ics-week-nav" data-nv-ics-week-nav="today">Today</button>
            </div>
            <div class="nv-ics-source" data-nv-ics-source></div>
          </div>

          <div class="nv-ics-calendar-scroll" data-nv-ics-calendar-scroll>
            <div class="nv-ics-calendar-header" data-nv-ics-calendar-header></div>
            <div class="nv-ics-calendar-body" data-nv-ics-calendar-body>
              <div class="nv-ics-time-column" data-nv-ics-time-column></div>
              <div class="nv-ics-days-grid" data-nv-ics-days-grid></div>
            </div>
          </div>
        </section>

        <aside class="nv-ics-event-panel" data-nv-ics-event-panel>
          <h2 class="nv-ics-panel-title">Event Properties</h2>
          <div class="nv-ics-panel-empty" data-nv-ics-panel-empty>Select an event to edit.</div>

          <form class="nv-ics-form hidden" data-nv-ics-form>
            <label>UID
              <input type="text" name="uid" data-field="uid" readonly />
            </label>

            <label>Summary
              <input type="text" name="summary" data-field="summary" />
            </label>

            <label>Description
              <textarea name="description" rows="3" data-field="description"></textarea>
            </label>

            <label>Location
              <input type="text" name="location" data-field="location" />
            </label>

            <div class="nv-ics-form-row">
              <label>Start Day
                <input type="date" name="startDay" data-field="startDay" />
              </label>
              <label>Start Time
                <input type="time" step="900" name="startTime" data-field="startTime" />
              </label>
            </div>

            <div class="nv-ics-form-row">
              <label>End Day
                <input type="date" name="endDay" data-field="endDay" />
              </label>
              <label>End Time
                <input type="time" step="900" name="endTime" data-field="endTime" />
              </label>
            </div>

            <label>Categories (comma-separated)
              <input type="text" name="categories" data-field="categories" />
            </label>

            <div class="nv-ics-form-row">
              <label>Priority
                <input type="text" name="priority" data-field="priority" placeholder="1-9 or HIGH/MEDIUM/LOW" />
              </label>

              <label>Status
                <select name="status" data-field="status">
                  <option value="">None</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="TENTATIVE">TENTATIVE</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </label>
            </div>

            <div class="nv-ics-form-row">
              <label>Transparency
                <select name="transp" data-field="transp">
                  <option value="">None</option>
                  <option value="OPAQUE">OPAQUE</option>
                  <option value="TRANSPARENT">TRANSPARENT</option>
                </select>
              </label>

              <label>RRULE Frequency
                <select name="rruleFreq" data-field="rruleFreq">
                  <option value="NONE">None</option>
                  <option value="WEEKLY">Weekly</option>
                </select>
              </label>
            </div>

            <div class="nv-ics-form-row">
              <label>X-NODEVISION-COLOR
                <input type="text" name="xNodevisionColor" data-field="xNodevisionColor" placeholder="#1565C0 or blue" />
              </label>
              <label>Color Picker
                <input type="color" name="xNodevisionColorPicker" data-field="xNodevisionColorPicker" />
              </label>
            </div>

            <div class="nv-ics-form-row">
              <label>X-NODEVISION-ICON
                <input type="text" name="xNodevisionIcon" data-field="xNodevisionIcon" maxlength="16" />
              </label>
              <label>X-NODEVISION-SYMBOL
                <input type="text" name="xNodevisionSymbol" data-field="xNodevisionSymbol" maxlength="16" />
              </label>
            </div>

            <div class="nv-ics-form-actions">
              <button type="button" class="nv-ics-delete-btn" data-nv-ics-delete-event>Delete Event</button>
            </div>
          </form>
        </aside>
      </div>

      <footer class="nv-ics-timezone-bar">
        <div class="nv-ics-timezone-title">Display Time Zone</div>
        <form class="nv-ics-timezone-form" data-nv-ics-timezone-form aria-label="Display time zone"></form>
      </footer>

      <div class="nv-ics-drag-tooltip hidden" data-nv-ics-drag-tooltip></div>
    </div>
  `;

  const refs = {
    root: container.querySelector("[data-nv-ics-root]"),
    statusMessage: container.querySelector("[data-nv-ics-status]"),
    localToolbar: container.querySelector("[data-nv-ics-local-toolbar]"),
    addEventButton: container.querySelector("[data-nv-ics-add-event]"),
    weekRange: container.querySelector("[data-nv-ics-week-range]"),
    sourceLabel: container.querySelector("[data-nv-ics-source]"),
    calendarSection: container.querySelector("[data-nv-ics-calendar-section]"),
    calendarHeader: container.querySelector("[data-nv-ics-calendar-header]"),
    timeColumn: container.querySelector("[data-nv-ics-time-column]"),
    daysGrid: container.querySelector("[data-nv-ics-days-grid]"),
    timezoneForm: container.querySelector("[data-nv-ics-timezone-form]"),
    eventPanel: container.querySelector("[data-nv-ics-event-panel]"),
    panelEmpty: container.querySelector("[data-nv-ics-panel-empty]"),
    eventForm: container.querySelector("[data-nv-ics-form]"),
    deleteButton: container.querySelector("[data-nv-ics-delete-event]"),
    dragTooltip: container.querySelector("[data-nv-ics-drag-tooltip]"),
    weekButtons: container.querySelectorAll("[data-nv-ics-week-nav]"),
  };

  refs.sourceLabel.textContent = "Source:";
  return refs;
}

function bindUiEvents(state) {
  const { refs } = state;

  const addEventClick = () => addEvent(state);
  refs.addEventButton.addEventListener("click", addEventClick);
  state.cleanupFns.push(() => refs.addEventButton.removeEventListener("click", addEventClick));

  const onWeekButtonClick = (event) => {
    const action = event.target?.getAttribute("data-nv-ics-week-nav");
    if (!action) return;

    if (action === "prev") {
      state.weekOffset -= 1;
    } else if (action === "next") {
      state.weekOffset += 1;
    } else {
      state.weekOffset = 0;
    }
    renderCalendar(state);
  };
  refs.root.addEventListener("click", onWeekButtonClick);
  state.cleanupFns.push(() => refs.root.removeEventListener("click", onWeekButtonClick));

  const onGridClick = (event) => handleDaysGridClick(state, event);
  refs.daysGrid.addEventListener("click", onGridClick);
  state.cleanupFns.push(() => refs.daysGrid.removeEventListener("click", onGridClick));

  const onGridPointerDown = (event) => handleGridPointerDown(state, event);
  refs.daysGrid.addEventListener("pointerdown", onGridPointerDown);
  state.cleanupFns.push(() => refs.daysGrid.removeEventListener("pointerdown", onGridPointerDown));

  const onFormInput = (event) => handleEventFormInput(state, event);
  refs.eventForm.addEventListener("input", onFormInput);
  refs.eventForm.addEventListener("change", onFormInput);
  state.cleanupFns.push(() => {
    refs.eventForm.removeEventListener("input", onFormInput);
    refs.eventForm.removeEventListener("change", onFormInput);
  });

  const onDeleteClick = () => deleteSelectedEvent(state);
  refs.deleteButton.addEventListener("click", onDeleteClick);
  state.cleanupFns.push(() => refs.deleteButton.removeEventListener("click", onDeleteClick));

  const keydownHandler = (event) => handleGlobalKeydown(state, event);
  document.addEventListener("keydown", keydownHandler, true);
  state.cleanupFns.push(() => document.removeEventListener("keydown", keydownHandler, true));

  const saveHook = async (path = state.filePath) => {
    const ics = serializeCalendarDocument(state.calendarDoc);
    await saveText(path, ics);
    state.filePath = path;
    setDirty(state, false);
    setStatus(state, "Saved calendar.", "info");
  };

  window.getEditorMarkdown = () => serializeCalendarDocument(state.calendarDoc);
  window.saveMDFile = saveHook;
  window.saveWYSIWYGFile = saveHook;
}

function buildTimeZoneControls(state) {
  const { refs } = state;

  let storedValue = "__local__";
  try {
    const value = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (isKnownTimeZoneValue(value)) {
      storedValue = value;
    }
  } catch {
    storedValue = "__local__";
  }

  state.selectedTimeZoneValue = storedValue;
  state.displayTimeZone = resolveDisplayTimeZone(storedValue);

  refs.timezoneForm.innerHTML = "";
  const localZone = getLocalTimeZone();

  for (let i = 0; i < TIME_ZONE_OPTIONS.length; i += 1) {
    const option = TIME_ZONE_OPTIONS[i];
    const label = document.createElement("label");
    label.className = "nv-ics-timezone-option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "displayTimeZone";
    radio.value = option.value;
    radio.checked = option.value === storedValue;

    const span = document.createElement("span");
    span.textContent = option.value === "__local__" ? `Local (${localZone})` : option.label;

    label.appendChild(radio);
    label.appendChild(span);
    refs.timezoneForm.appendChild(label);
  }

  const onTimezoneChange = (event) => {
    if (!event.target || event.target.name !== "displayTimeZone") return;

    let next = String(event.target.value || "__local__");
    if (!isKnownTimeZoneValue(next)) {
      next = "__local__";
    }

    state.selectedTimeZoneValue = next;
    state.displayTimeZone = resolveDisplayTimeZone(next);

    try {
      localStorage.setItem(TIMEZONE_STORAGE_KEY, next);
    } catch {
      // no-op
    }

    renderCalendar(state);
  };

  refs.timezoneForm.addEventListener("change", onTimezoneChange);
  state.cleanupFns.push(() => refs.timezoneForm.removeEventListener("change", onTimezoneChange));
}

function renderCalendar(state) {
  if (!state.calendarDoc) return;

  state.weekBounds = getWeekBounds(state.displayTimeZone, state.weekOffset);
  renderWeekHeader(state);
  renderGridSkeleton(state);
  renderEvents(state);
  updateSelectedSlotMarker(state);
  updateCurrentTimeLine(state);
  startCurrentTimeTicker(state);
}

function renderWeekHeader(state) {
  const weekText = formatWeekRange(state.weekBounds, state.displayTimeZone);
  state.refs.weekRange.textContent = weekText;
  state.refs.sourceLabel.textContent = `Source: ${state.filePath}`;
}

function renderGridSkeleton(state) {
  const { refs, weekBounds } = state;
  refs.calendarHeader.innerHTML = "";
  refs.timeColumn.innerHTML = "";
  refs.daysGrid.innerHTML = "";

  const corner = document.createElement("div");
  corner.className = "nv-ics-header-corner";
  corner.textContent = "Time";
  refs.calendarHeader.appendChild(corner);

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const dayInfo = weekBounds.days[dayIndex];
    const headerCell = document.createElement("div");
    headerCell.className = "nv-ics-day-header";
    headerCell.dataset.dayIndex = String(dayIndex);

    const name = document.createElement("div");
    name.className = "nv-ics-day-name";
    name.textContent = DAY_NAMES[dayIndex];

    const date = document.createElement("div");
    date.className = "nv-ics-day-date";
    date.textContent = dayInfo.dateLabel;

    headerCell.appendChild(name);
    headerCell.appendChild(date);
    refs.calendarHeader.appendChild(headerCell);
  }

  const rowsPerDay = MINUTES_PER_DAY / SLOT_MINUTES;
  for (let row = 0; row < rowsPerDay; row += 1) {
    const minutesFromMidnight = row * SLOT_MINUTES;
    const slot = document.createElement("div");
    slot.className = "nv-ics-time-slot";
    slot.textContent = formatClockMinutes(minutesFromMidnight, false);
    refs.timeColumn.appendChild(slot);
  }

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const dayColumn = document.createElement("div");
    dayColumn.className = "nv-ics-day-column";
    dayColumn.dataset.dayIndex = String(dayIndex);

    const eventsLayer = document.createElement("div");
    eventsLayer.className = "nv-ics-events-layer";

    const slotMarker = document.createElement("div");
    slotMarker.className = "nv-ics-selected-slot";

    const nowLine = document.createElement("div");
    nowLine.className = "nv-ics-current-time-line";

    dayColumn.appendChild(eventsLayer);
    dayColumn.appendChild(slotMarker);
    dayColumn.appendChild(nowLine);
    refs.daysGrid.appendChild(dayColumn);
  }
}

function renderEvents(state) {
  state.renderSegmentsById.clear();

  const dayLayers = new Map();
  const dayColumns = state.refs.daysGrid.querySelectorAll(".nv-ics-day-column");
  for (let i = 0; i < dayColumns.length; i += 1) {
    const dayIndex = Number(dayColumns[i].dataset.dayIndex);
    const layer = dayColumns[i].querySelector(".nv-ics-events-layer");
    if (layer) {
      layer.innerHTML = "";
      dayLayers.set(dayIndex, layer);
    }
  }

  const segmentsByDay = new Map();
  for (let day = 0; day < 7; day += 1) {
    segmentsByDay.set(day, []);
  }

  for (let eventIndex = 0; eventIndex < state.events.length; eventIndex += 1) {
    const eventModel = state.events[eventIndex];
    const occurrences = expandEventOccurrencesForWeek(eventModel, state.weekBounds);

    for (let occurrenceIndex = 0; occurrenceIndex < occurrences.length; occurrenceIndex += 1) {
      const occurrence = occurrences[occurrenceIndex];
      const segments = splitOccurrenceIntoDisplaySegments(
        occurrence.start,
        occurrence.end,
        state.displayTimeZone,
        state.weekBounds,
      );

      for (let segIndex = 0; segIndex < segments.length; segIndex += 1) {
        const seg = segments[segIndex];
        const segmentId = `${eventModel.id}|${occurrence.start.getTime()}|${seg.dayIndex}|${segIndex}`;
        const fullSegment = {
          ...seg,
          segmentId,
          eventId: eventModel.id,
          event: eventModel,
          occurrenceStart: occurrence.start,
          occurrenceEnd: occurrence.end,
        };
        segmentsByDay.get(seg.dayIndex).push(fullSegment);
      }
    }
  }

  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const segments = segmentsByDay.get(dayIndex) || [];
    if (!segments.length) continue;

    const laidOut = assignOverlapLayout(segments);
    const targetLayer = dayLayers.get(dayIndex);
    if (!targetLayer) continue;

    for (let i = 0; i < laidOut.length; i += 1) {
      const segment = laidOut[i];
      const card = createEventElement(state, segment);
      state.renderSegmentsById.set(segment.segmentId, segment);
      targetLayer.appendChild(card);
    }
  }

  let statusMessage = `Loaded ${state.events.length} editable event(s).`;
  let statusType = "info";

  if (state.parserWarnings.length > 0) {
    statusMessage = state.parserWarnings.join(" ");
    statusType = "warning";
  }

  if (state.invalidEventCount > 0) {
    statusMessage += ` Preserved ${state.invalidEventCount} invalid VEVENT block(s).`;
  }

  const totalSegments = Array.from(segmentsByDay.values()).reduce((sum, arr) => sum + arr.length, 0);
  if (totalSegments === 0) {
    statusMessage += " No events fall within this Sunday-Saturday week in the selected time zone.";
  }

  if (!state.dirty) {
    setStatus(state, statusMessage, statusType);
  }
}

function createEventElement(state, segment) {
  const eventModel = segment.event;
  const priorityInfo = getPriorityInfo(eventModel.priority);
  const visual = getEventVisualInfo(eventModel);

  const card = document.createElement("div");
  card.className = `nv-ics-event-card ${priorityInfo.className}`;
  if (state.selectedEventId === eventModel.id) {
    card.classList.add("is-selected");
  }

  card.dataset.eventId = eventModel.id;
  card.dataset.segmentId = segment.segmentId;
  card.tabIndex = 0;

  const pixelsPerMinute = getPixelsPerMinute(state);
  const topPx = segment.startMinutes * pixelsPerMinute;
  const durationMinutes = Math.max(segment.endMinutes - segment.startMinutes, MIN_EVENT_MINUTES);
  const heightPx = Math.max(durationMinutes * pixelsPerMinute - 2, 12);

  card.style.top = `${topPx.toFixed(2)}px`;
  card.style.height = `${heightPx.toFixed(2)}px`;

  const widthPct = 100 / Math.max(1, segment.columnCount);
  const leftPct = widthPct * segment.columnIndex;
  const gap = 6;

  card.style.left = `calc(${leftPct.toFixed(4)}% + ${gap / 2}px)`;
  card.style.width = `calc(${widthPct.toFixed(4)}% - ${gap}px)`;
  card.style.zIndex = state.selectedEventId === eventModel.id ? "45" : "20";

  applyNodevisionEventColor(card, visual.color);

  const resizeTop = document.createElement("div");
  resizeTop.className = "nv-ics-resize-handle top";
  resizeTop.dataset.resize = "start";
  resizeTop.title = "Drag to change event start time";

  const resizeBottom = document.createElement("div");
  resizeBottom.className = "nv-ics-resize-handle bottom";
  resizeBottom.dataset.resize = "end";
  resizeBottom.title = "Drag to change event end time";

  const title = document.createElement("div");
  title.className = "nv-ics-event-title";

  if (visual.icon) {
    const icon = document.createElement("span");
    icon.className = "nv-ics-event-icon";
    icon.textContent = visual.icon;
    title.appendChild(icon);
  }

  const titleText = document.createElement("span");
  titleText.className = "nv-ics-event-title-text";
  titleText.textContent = eventModel.summary || "(Untitled Event)";
  title.appendChild(titleText);

  const meta = document.createElement("div");
  meta.className = "nv-ics-event-meta";
  const timeText = `${formatClockMinutes(segment.startMinutes, false)} - ${formatClockMinutes(segment.endMinutes, true)}`;
  meta.textContent = visual.symbol ? `${visual.symbol} ${timeText}` : timeText;

  const footer = document.createElement("div");
  footer.className = "nv-ics-event-footer";
  footer.textContent = priorityInfo.label;

  card.appendChild(resizeTop);
  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(footer);
  card.appendChild(resizeBottom);

  const tooltipParts = [
    eventModel.summary || "(Untitled Event)",
    `${DAY_NAMES[segment.dayIndex]} ${timeText}`,
  ];
  if (eventModel.location) tooltipParts.push(`Location: ${eventModel.location}`);
  if (eventModel.description) tooltipParts.push(eventModel.description);
  card.title = tooltipParts.join("\n");

  const onFocus = () => selectEvent(state, eventModel.id, { scrollIntoView: false });
  card.addEventListener("focus", onFocus);
  card.addEventListener("click", () => selectEvent(state, eventModel.id, { scrollIntoView: false }));

  return card;
}

function assignOverlapLayout(segments) {
  const sorted = [...segments].sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) {
      return a.startMinutes - b.startMinutes;
    }
    if (a.endMinutes !== b.endMinutes) {
      return a.endMinutes - b.endMinutes;
    }
    return a.eventId.localeCompare(b.eventId);
  });

  const groups = [];
  let active = [];
  let currentGroup = null;

  for (let i = 0; i < sorted.length; i += 1) {
    const seg = sorted[i];

    active = active.filter((item) => item.endMinutes > seg.startMinutes);
    if (active.length === 0) {
      currentGroup = { segments: [], maxColumns: 0 };
      groups.push(currentGroup);
    }

    const usedColumns = new Set(active.map((item) => item.columnIndex));
    let columnIndex = 0;
    while (usedColumns.has(columnIndex)) {
      columnIndex += 1;
    }

    const decorated = {
      ...seg,
      columnIndex,
      columnCount: 1,
    };

    currentGroup.segments.push(decorated);
    active.push({
      endMinutes: seg.endMinutes,
      columnIndex,
    });

    if (columnIndex + 1 > currentGroup.maxColumns) {
      currentGroup.maxColumns = columnIndex + 1;
    }
  }

  const output = [];
  for (let g = 0; g < groups.length; g += 1) {
    const group = groups[g];
    for (let i = 0; i < group.segments.length; i += 1) {
      group.segments[i].columnCount = Math.max(1, group.maxColumns);
      output.push(group.segments[i]);
    }
  }

  return output;
}

function handleDaysGridClick(state, event) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  if (target.closest(".nv-ics-event-card")) {
    return;
  }

  const dayColumn = target.closest(".nv-ics-day-column");
  if (!dayColumn) return;

  const dayIndex = Number(dayColumn.dataset.dayIndex);
  if (!Number.isFinite(dayIndex)) return;

  const minutes = pointerToMinutesInColumn(state, dayColumn, event.clientY);
  state.selectedSlot = {
    dayIndex,
    startMinutes: snapToStep(minutes, SLOT_MINUTES),
  };

  updateSelectedSlotMarker(state);
}

function handleGridPointerDown(state, event) {
  if (event.button !== 0) return;

  const target = event.target;
  if (!(target instanceof Element)) return;

  const card = target.closest(".nv-ics-event-card");
  if (!card) return;

  const eventId = card.getAttribute("data-event-id");
  const segmentId = card.getAttribute("data-segment-id");
  if (!eventId || !segmentId) return;

  const segment = state.renderSegmentsById.get(segmentId);
  if (!segment) return;

  selectEvent(state, eventId, { scrollIntoView: false });

  let mode = "move";
  if (target.closest(".nv-ics-resize-handle.top")) {
    mode = "resize-start";
  } else if (target.closest(".nv-ics-resize-handle.bottom")) {
    mode = "resize-end";
  }

  startInteraction(state, event, card, segment, mode);
}

function startInteraction(state, pointerEvent, card, segment, mode) {
  const eventModel = getEventById(state, segment.eventId);
  if (!eventModel) return;

  const pointerWeek = projectPointerToWeek(state, pointerEvent.clientX, pointerEvent.clientY);
  const pointerOffsetMinutes = pointerWeek
    ? pointerWeek.minutes - segment.startMinutes
    : 0;

  const interaction = {
    pointerId: pointerEvent.pointerId,
    mode,
    eventId: segment.eventId,
    segmentId: segment.segmentId,
    sourceDayIndex: segment.dayIndex,
    sourceStartMinutes: segment.startMinutes,
    sourceEndMinutes: segment.endMinutes,
    sourceDurationMinutes: Math.max(segment.endMinutes - segment.startMinutes, MIN_EVENT_MINUTES),
    pointerOffsetMinutes,
    startX: pointerEvent.clientX,
    startY: pointerEvent.clientY,
    started: false,
    preview: null,
    card,
  };

  state.interaction = interaction;

  card.classList.add("is-drag-source");

  const moveHandler = (event) => handleInteractionMove(state, event);
  const upHandler = (event) => handleInteractionEnd(state, event, true);
  const cancelHandler = (event) => handleInteractionEnd(state, event, false);

  window.addEventListener("pointermove", moveHandler);
  window.addEventListener("pointerup", upHandler, { once: true });
  window.addEventListener("pointercancel", cancelHandler, { once: true });

  interaction.detach = () => {
    window.removeEventListener("pointermove", moveHandler);
    window.removeEventListener("pointerup", upHandler);
    window.removeEventListener("pointercancel", cancelHandler);
  };

  pointerEvent.preventDefault();
}

function handleInteractionMove(state, pointerEvent) {
  const interaction = state.interaction;
  if (!interaction) return;

  const dx = pointerEvent.clientX - interaction.startX;
  const dy = pointerEvent.clientY - interaction.startY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (!interaction.started && dist < DRAG_THRESHOLD_PX) {
    return;
  }

  if (!interaction.started) {
    interaction.started = true;
  }

  const projected = projectPointerToWeek(state, pointerEvent.clientX, pointerEvent.clientY);
  if (!projected) return;

  let dayIndex = projected.dayIndex;
  let startMinutes = interaction.sourceStartMinutes;
  let endMinutes = interaction.sourceEndMinutes;

  if (interaction.mode === "move") {
    startMinutes = snapToStep(projected.minutes - interaction.pointerOffsetMinutes, SLOT_MINUTES);
    const maxStart = MINUTES_PER_DAY - interaction.sourceDurationMinutes;
    startMinutes = clamp(startMinutes, 0, Math.max(0, maxStart));
    endMinutes = startMinutes + interaction.sourceDurationMinutes;
  } else if (interaction.mode === "resize-start") {
    dayIndex = interaction.sourceDayIndex;
    startMinutes = snapToStep(projected.minutes, SLOT_MINUTES);
    startMinutes = clamp(startMinutes, 0, interaction.sourceEndMinutes - MIN_EVENT_MINUTES);
    endMinutes = interaction.sourceEndMinutes;
  } else if (interaction.mode === "resize-end") {
    dayIndex = interaction.sourceDayIndex;
    endMinutes = snapToStep(projected.minutes, SLOT_MINUTES);
    endMinutes = clamp(endMinutes, interaction.sourceStartMinutes + MIN_EVENT_MINUTES, MINUTES_PER_DAY);
    startMinutes = interaction.sourceStartMinutes;
  }

  interaction.preview = {
    dayIndex,
    startMinutes,
    endMinutes,
  };

  updateInteractionPreviewVisual(state);
  updateDragTooltip(state, pointerEvent.clientX, pointerEvent.clientY, interaction.preview);
  pointerEvent.preventDefault();
}

function handleInteractionEnd(state, pointerEvent, shouldCommit) {
  const interaction = state.interaction;
  if (!interaction) return;

  const commit = shouldCommit && interaction.started && interaction.preview;
  if (commit) {
    applyInteractionPreview(state, interaction.preview, interaction);
  }

  teardownInteraction(state, false);
  hideDragTooltip(state);

  if (commit) {
    renderCalendar(state);
    updateEventEditorPanel(state);
  }

  if (pointerEvent) {
    pointerEvent.preventDefault();
  }
}

function teardownInteraction(state, cancelledByEscape) {
  const interaction = state.interaction;
  if (!interaction) return;

  interaction.detach?.();
  interaction.card?.classList.remove("is-drag-source");

  const preview = state.refs.daysGrid.querySelector(".nv-ics-interaction-preview");
  if (preview) {
    preview.remove();
  }

  if (cancelledByEscape) {
    setStatus(state, "Drag/resize canceled.", "info");
  }

  state.interaction = null;
}

function updateInteractionPreviewVisual(state) {
  const interaction = state.interaction;
  if (!interaction || !interaction.preview) return;

  const { dayIndex, startMinutes, endMinutes } = interaction.preview;
  const gridRect = state.refs.daysGrid.getBoundingClientRect();
  if (gridRect.width <= 0 || gridRect.height <= 0) return;

  let preview = state.refs.daysGrid.querySelector(".nv-ics-interaction-preview");
  if (!preview) {
    preview = document.createElement("div");
    preview.className = "nv-ics-interaction-preview";
    state.refs.daysGrid.appendChild(preview);
  }

  const dayWidth = gridRect.width / 7;
  const pixelsPerMinute = getPixelsPerMinute(state);

  const leftPx = dayIndex * dayWidth + 5;
  const topPx = startMinutes * pixelsPerMinute;
  const heightPx = Math.max((endMinutes - startMinutes) * pixelsPerMinute - 2, 10);

  preview.style.left = `${leftPx}px`;
  preview.style.top = `${topPx}px`;
  preview.style.width = `${Math.max(18, dayWidth - 10)}px`;
  preview.style.height = `${heightPx}px`;
}

function updateDragTooltip(state, clientX, clientY, preview) {
  const tooltip = state.refs.dragTooltip;
  const start = formatClockMinutes(preview.startMinutes, false);
  const end = formatClockMinutes(preview.endMinutes, true);
  tooltip.textContent = `${DAY_NAMES[preview.dayIndex]} ${start} - ${end}`;
  tooltip.classList.remove("hidden");
  tooltip.style.left = `${clientX + 14}px`;
  tooltip.style.top = `${clientY + 14}px`;
}

function hideDragTooltip(state) {
  const tooltip = state.refs.dragTooltip;
  tooltip.classList.add("hidden");
}

function applyInteractionPreview(state, preview, interaction) {
  const eventModel = getEventById(state, interaction.eventId);
  if (!eventModel) return;

  const startDate = weekSlotToUtcDate(state.weekBounds, preview.dayIndex, preview.startMinutes, state.displayTimeZone);
  const endDate = weekSlotToUtcDate(state.weekBounds, preview.dayIndex, preview.endMinutes, state.displayTimeZone);

  if (!startDate || !endDate || endDate.getTime() <= startDate.getTime()) {
    return;
  }

  setEventTimeRange(state, eventModel, startDate, endDate, {
    updateRecurrenceByDay: true,
    dayIndex: preview.dayIndex,
    reason: interaction.mode === "move" ? "Moved event" : "Resized event",
  });
}

function handleGlobalKeydown(state, event) {
  if (event.key === "Escape" && state.interaction) {
    teardownInteraction(state, true);
    hideDragTooltip(state);
    renderCalendar(state);
    event.preventDefault();
    return;
  }

  if (event.key !== "Delete") return;

  if (!state.selectedEventId) return;

  const active = document.activeElement;
  if (
    active &&
    (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT" || active.isContentEditable)
  ) {
    return;
  }

  deleteSelectedEvent(state);
  event.preventDefault();
}

function deleteSelectedEvent(state) {
  const selected = getEventById(state, state.selectedEventId);
  if (!selected) return;

  const label = selected.summary || "Untitled Event";
  const ok = window.confirm(`Delete event \"${label}\"?`);
  if (!ok) return;

  removeEventSection(state.calendarDoc, selected.id);
  state.events = state.events.filter((eventModel) => eventModel.id !== selected.id);
  state.selectedEventId = null;

  setDirty(state, true);
  setStatus(state, `Deleted event \"${label}\".`, "info");

  renderCalendar(state);
  updateEventEditorPanel(state);
}

function selectEvent(state, eventId, { scrollIntoView = true } = {}) {
  const eventModel = getEventById(state, eventId);
  if (!eventModel) return;

  state.selectedEventId = eventId;
  updateEventEditorPanel(state);

  const cards = state.refs.daysGrid.querySelectorAll(`.nv-ics-event-card[data-event-id=\"${cssEscape(eventId)}\"]`);
  cards.forEach((card) => card.classList.add("is-selected"));

  if (scrollIntoView && cards.length > 0) {
    cards[0].scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  renderCalendar(state);
}

function handleEventFormInput(state, event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return;
  }

  const selected = getEventById(state, state.selectedEventId);
  if (!selected) return;

  const field = target.getAttribute("data-field");
  if (!field) return;

  if (field === "uid") {
    return;
  }

  if (field === "summary") {
    selected.summary = String(target.value || "");
    markEventChanged(state, selected, "Updated summary");
  } else if (field === "description") {
    selected.description = String(target.value || "");
    markEventChanged(state, selected, "Updated description");
  } else if (field === "location") {
    selected.location = String(target.value || "");
    markEventChanged(state, selected, "Updated location");
  } else if (field === "categories") {
    selected.categories = parseCategoryInput(target.value);
    markEventChanged(state, selected, "Updated categories");
  } else if (field === "priority") {
    selected.priority = String(target.value || "").trim();
    markEventChanged(state, selected, "Updated priority");
  } else if (field === "status") {
    selected.status = String(target.value || "").trim().toUpperCase();
    markEventChanged(state, selected, "Updated status");
  } else if (field === "transp") {
    selected.transp = String(target.value || "").trim().toUpperCase();
    markEventChanged(state, selected, "Updated transparency");
  } else if (field === "xNodevisionColor") {
    selected.xNodevisionColor = String(target.value || "").trim();
    const picker = state.refs.eventForm.querySelector('[data-field="xNodevisionColorPicker"]');
    if (picker instanceof HTMLInputElement) {
      const hex = normalizeHexColor(selected.xNodevisionColor);
      if (hex) picker.value = hex;
    }
    markEventChanged(state, selected, "Updated event color");
  } else if (field === "xNodevisionColorPicker") {
    selected.xNodevisionColor = String(target.value || "").trim();
    const textInput = state.refs.eventForm.querySelector('[data-field="xNodevisionColor"]');
    if (textInput instanceof HTMLInputElement) {
      textInput.value = selected.xNodevisionColor;
    }
    markEventChanged(state, selected, "Updated event color");
  } else if (field === "xNodevisionIcon") {
    selected.xNodevisionIcon = sanitizeNodevisionMarker(target.value);
    target.value = selected.xNodevisionIcon;
    markEventChanged(state, selected, "Updated event icon");
  } else if (field === "xNodevisionSymbol") {
    selected.xNodevisionSymbol = sanitizeNodevisionMarker(target.value);
    target.value = selected.xNodevisionSymbol;
    markEventChanged(state, selected, "Updated event symbol");
  } else if (field === "rruleFreq") {
    const freq = String(target.value || "NONE").toUpperCase();
    if (freq === "WEEKLY") {
      const startParts = convertDateToTimeZoneParts(selected.startDate, state.displayTimeZone);
      selected.rrule = {
        FREQ: "WEEKLY",
        BYDAY: WEEKDAY_CODES[startParts.weekdayIndex],
      };
    } else {
      selected.rrule = null;
    }
    markEventChanged(state, selected, "Updated recurrence");
  } else if (
    field === "startDay" ||
    field === "startTime" ||
    field === "endDay" ||
    field === "endTime"
  ) {
    updateSelectedEventTimeFromForm(state, selected);
  }

  renderCalendar(state);
}

function updateSelectedEventTimeFromForm(state, selectedEvent) {
  const form = state.refs.eventForm;
  const startDay = String(form.querySelector('[data-field="startDay"]')?.value || "").trim();
  const startTime = String(form.querySelector('[data-field="startTime"]')?.value || "").trim();
  const endDay = String(form.querySelector('[data-field="endDay"]')?.value || "").trim();
  const endTime = String(form.querySelector('[data-field="endTime"]')?.value || "").trim();

  const startMinutes = parseTimeInputMinutes(startTime);
  const endMinutes = parseTimeInputMinutes(endTime);

  if (!startDay || !endDay || startMinutes === null || endMinutes === null) {
    return;
  }

  const startParts = parseDateInput(startDay);
  const endParts = parseDateInput(endDay);
  if (!startParts || !endParts) return;

  const startDate = zonedTimeToUtc(
    {
      year: startParts.year,
      month: startParts.month,
      day: startParts.day,
      hour: Math.floor(startMinutes / 60),
      minute: startMinutes % 60,
      second: 0,
    },
    state.displayTimeZone,
  );

  const endDate = zonedTimeToUtc(
    {
      year: endParts.year,
      month: endParts.month,
      day: endParts.day,
      hour: Math.floor(endMinutes / 60),
      minute: endMinutes % 60,
      second: 0,
    },
    state.displayTimeZone,
  );

  if (!startDate || !endDate) return;

  let correctedEnd = endDate;
  if (correctedEnd.getTime() <= startDate.getTime()) {
    correctedEnd = new Date(startDate.getTime() + MIN_EVENT_MINUTES * 60000);

    const correctedParts = convertDateToTimeZoneParts(correctedEnd, state.displayTimeZone);
    const correctedDay = `${correctedParts.year}-${pad2(correctedParts.month)}-${pad2(correctedParts.day)}`;
    const correctedTime = `${pad2(correctedParts.hour)}:${pad2(correctedParts.minute)}`;

    const endDayInput = form.querySelector('[data-field="endDay"]');
    const endTimeInput = form.querySelector('[data-field="endTime"]');
    if (endDayInput instanceof HTMLInputElement) endDayInput.value = correctedDay;
    if (endTimeInput instanceof HTMLInputElement) endTimeInput.value = correctedTime;
  }

  const selectedParts = convertDateToTimeZoneParts(startDate, state.displayTimeZone);
  setEventTimeRange(state, selectedEvent, startDate, correctedEnd, {
    updateRecurrenceByDay: true,
    dayIndex: selectedParts.weekdayIndex,
    reason: "Updated event time",
  });
}

function updateEventEditorPanel(state) {
  const selected = getEventById(state, state.selectedEventId);
  const { panelEmpty, eventForm } = state.refs;

  if (!selected) {
    panelEmpty.classList.remove("hidden");
    eventForm.classList.add("hidden");
    return;
  }

  panelEmpty.classList.add("hidden");
  eventForm.classList.remove("hidden");

  const startParts = convertDateToTimeZoneParts(selected.startDate, state.displayTimeZone);
  const endParts = convertDateToTimeZoneParts(selected.endDate, state.displayTimeZone);

  const setField = (key, value) => {
    const el = eventForm.querySelector(`[data-field="${key}"]`);
    if (!el) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      el.value = value;
    }
  };

  setField("uid", selected.uid || "");
  setField("summary", selected.summary || "");
  setField("description", selected.description || "");
  setField("location", selected.location || "");
  setField("categories", (selected.categories || []).join(", "));
  setField("priority", selected.priority || "");
  setField("status", selected.status || "");
  setField("transp", selected.transp || "");
  setField("xNodevisionColor", selected.xNodevisionColor || "");
  setField("xNodevisionIcon", selected.xNodevisionIcon || "");
  setField("xNodevisionSymbol", selected.xNodevisionSymbol || "");
  setField("rruleFreq", selected.rrule && String(selected.rrule.FREQ || "").toUpperCase() === "WEEKLY" ? "WEEKLY" : "NONE");

  const startDay = `${startParts.year}-${pad2(startParts.month)}-${pad2(startParts.day)}`;
  const endDay = `${endParts.year}-${pad2(endParts.month)}-${pad2(endParts.day)}`;

  setField("startDay", startDay);
  setField("endDay", endDay);
  setField("startTime", `${pad2(startParts.hour)}:${pad2(startParts.minute)}`);
  setField("endTime", `${pad2(endParts.hour)}:${pad2(endParts.minute)}`);

  const picker = eventForm.querySelector('[data-field="xNodevisionColorPicker"]');
  if (picker instanceof HTMLInputElement) {
    picker.value = normalizeHexColor(selected.xNodevisionColor) || "#1565c0";
  }
}

function addEvent(state) {
  if (!state.weekBounds) {
    renderCalendar(state);
    if (!state.weekBounds) return;
  }

  const slot = state.selectedSlot || findNextOpenSlot(state);
  const dayInfo = state.weekBounds.days[slot.dayIndex] || state.weekBounds.days[0];

  const startDate = weekSlotToUtcDate(state.weekBounds, slot.dayIndex, slot.startMinutes, state.displayTimeZone);
  const endDate = weekSlotToUtcDate(state.weekBounds, slot.dayIndex, slot.startMinutes + 30, state.displayTimeZone);

  const visualFallback = getCategoryFallbackVisual(["GENERAL"]);

  const style = inferNewEventDateStyle(state.displayTimeZone, state.selectedTimeZoneValue);

  const newEvent = {
    id: createLocalEventId(),
    uid: generateUid(dayInfo),
    summary: "New Event",
    description: "",
    location: "",
    startDate,
    endDate,
    sourceTimeZone: normalizeSourceTimeZone(style.kind === "tzid" ? style.tzid : style.kind === "utc" ? "UTC" : "LOCAL"),
    dateStyle: {
      start: style,
      end: style,
    },
    endSource: "DTEND",
    durationRaw: "",
    rrule: null,
    categories: ["GENERAL"],
    priority: "",
    status: "",
    transp: "",
    xNodevisionColor: visualFallback.color || "#1565C0",
    xNodevisionIcon: visualFallback.icon || "📌",
    xNodevisionSymbol: visualFallback.symbol || "•",
    unknownPropertyLines: [],
    rawLines: null,
    changed: true,
    isNew: true,
  };

  insertEventSection(state.calendarDoc, newEvent);
  state.events.push(newEvent);
  state.selectedEventId = newEvent.id;
  state.selectedSlot = { ...slot };

  setDirty(state, true);
  setStatus(state, `Created event \"${newEvent.summary}\".`, "info");

  renderCalendar(state);
  updateEventEditorPanel(state);

  const summaryInput = state.refs.eventForm.querySelector('[data-field="summary"]');
  if (summaryInput instanceof HTMLInputElement) {
    summaryInput.focus();
    summaryInput.select();
  }
}

function findNextOpenSlot(state) {
  const segmentsByDay = new Map();
  for (let day = 0; day < 7; day += 1) segmentsByDay.set(day, []);

  for (let i = 0; i < state.events.length; i += 1) {
    const eventModel = state.events[i];
    const occurrences = expandEventOccurrencesForWeek(eventModel, state.weekBounds);
    for (let o = 0; o < occurrences.length; o += 1) {
      const segments = splitOccurrenceIntoDisplaySegments(
        occurrences[o].start,
        occurrences[o].end,
        state.displayTimeZone,
        state.weekBounds,
      );
      for (let s = 0; s < segments.length; s += 1) {
        segmentsByDay.get(segments[s].dayIndex).push(segments[s]);
      }
    }
  }

  for (let day = 0; day < 7; day += 1) {
    const daySegments = segmentsByDay.get(day) || [];
    for (let start = 0; start <= MINUTES_PER_DAY - 30; start += 30) {
      const end = start + 30;
      const hasConflict = daySegments.some((seg) => start < seg.endMinutes && end > seg.startMinutes);
      if (!hasConflict) {
        return { dayIndex: day, startMinutes: start };
      }
    }
  }

  return { dayIndex: 0, startMinutes: 8 * 60 };
}

function updateSelectedSlotMarker(state) {
  const markers = state.refs.daysGrid.querySelectorAll(".nv-ics-selected-slot");
  markers.forEach((marker) => {
    marker.style.display = "none";
  });

  if (!state.selectedSlot) return;

  const dayColumn = state.refs.daysGrid.querySelector(`.nv-ics-day-column[data-day-index=\"${state.selectedSlot.dayIndex}\"]`);
  if (!dayColumn) return;

  const marker = dayColumn.querySelector(".nv-ics-selected-slot");
  if (!marker) return;

  marker.style.display = "block";
  marker.style.top = `${state.selectedSlot.startMinutes * getPixelsPerMinute(state)}px`;
  marker.style.height = `${Math.max(8, SLOT_MINUTES * getPixelsPerMinute(state))}px`;
}

function startCurrentTimeTicker(state) {
  if (state.currentTimeIntervalId) {
    clearInterval(state.currentTimeIntervalId);
  }

  state.currentTimeIntervalId = setInterval(() => updateCurrentTimeLine(state), 60000);
  updateCurrentTimeLine(state);
}

function updateCurrentTimeLine(state) {
  const lines = state.refs.daysGrid.querySelectorAll(".nv-ics-current-time-line");
  lines.forEach((line) => {
    line.style.display = "none";
  });

  if (!state.weekBounds) return;

  const now = new Date();
  const nowParts = convertDateToTimeZoneParts(now, state.displayTimeZone);
  const dayIndex = state.weekBounds.dateKeyToIndex[nowParts.dateKey];
  if (typeof dayIndex !== "number") return;

  const line = state.refs.daysGrid.querySelector(`.nv-ics-day-column[data-day-index=\"${dayIndex}\"] .nv-ics-current-time-line`);
  if (!line) return;

  const nowMinutes = nowParts.hour * 60 + nowParts.minute + nowParts.second / 60;
  line.style.top = `${(nowMinutes * getPixelsPerMinute(state)).toFixed(2)}px`;
  line.style.display = "block";
}

function setEventTimeRange(state, eventModel, startDate, endDate, options = {}) {
  if (!isFiniteDate(startDate) || !isFiniteDate(endDate)) return;
  if (endDate.getTime() <= startDate.getTime()) return;

  eventModel.startDate = new Date(startDate.getTime());
  eventModel.endDate = new Date(endDate.getTime());
  eventModel.endSource = "DTEND";
  eventModel.durationRaw = "";

  if (options.updateRecurrenceByDay && eventModel.rrule && String(eventModel.rrule.FREQ || "").toUpperCase() === "WEEKLY") {
    const dayIndex = Number.isFinite(options.dayIndex)
      ? options.dayIndex
      : convertDateToTimeZoneParts(startDate, state.displayTimeZone).weekdayIndex;

    eventModel.rrule = {
      ...eventModel.rrule,
      FREQ: "WEEKLY",
      BYDAY: WEEKDAY_CODES[dayIndex],
    };

    // TODO(nodevision): support RECURRENCE-ID detached instances when editing one recurring occurrence.
  }

  markEventChanged(state, eventModel, options.reason || "Updated event time");
}

function markEventChanged(state, eventModel, statusMessage) {
  if (!eventModel) return;
  eventModel.changed = true;
  setDirty(state, true);
  setStatus(state, statusMessage, "info");
}

function setDirty(state, dirty) {
  state.dirty = Boolean(dirty);
  updateToolbarState({ fileIsDirty: state.dirty });
}

function setStatus(state, message, type = "info") {
  state.statusType = type;
  const cls = type === "error"
    ? "nv-ics-status-error"
    : type === "warning"
      ? "nv-ics-status-warning"
      : "nv-ics-status-info";

  state.refs.statusMessage.textContent = String(message || "");
  state.refs.statusMessage.className = `nv-ics-status ${cls}`;
}

function getEventById(state, eventId) {
  if (!eventId) return null;
  for (let i = 0; i < state.events.length; i += 1) {
    if (state.events[i].id === eventId) {
      return state.events[i];
    }
  }
  return null;
}

function parseCalendarDocument(icsText) {
  const unfoldedLines = unfoldICS(icsText);
  const sections = [];

  let outsideLines = [];
  let inEvent = false;
  let eventLines = [];

  for (let i = 0; i < unfoldedLines.length; i += 1) {
    const line = unfoldedLines[i];
    const upper = String(line || "").trim().toUpperCase();

    if (!inEvent && upper === "BEGIN:VEVENT") {
      if (outsideLines.length > 0) {
        sections.push({ type: "outside", lines: outsideLines });
        outsideLines = [];
      }
      inEvent = true;
      eventLines = [line];
      continue;
    }

    if (inEvent) {
      eventLines.push(line);
      if (upper === "END:VEVENT") {
        const block = parseEventBlock(eventLines);
        sections.push({ type: "event", block });
        inEvent = false;
        eventLines = [];
      }
      continue;
    }

    outsideLines.push(line);
  }

  if (inEvent && eventLines.length > 0) {
    outsideLines = outsideLines.concat(eventLines);
  }
  if (outsideLines.length > 0) {
    sections.push({ type: "outside", lines: outsideLines });
  }

  const doc = { sections };

  const events = [];
  let veventCount = 0;
  let invalidEventCount = 0;
  for (let i = 0; i < sections.length; i += 1) {
    if (sections[i].type !== "event") continue;
    veventCount += 1;
    const block = sections[i].block;
    if (block.event) {
      events.push(block.event);
    } else {
      invalidEventCount += 1;
    }
  }

  const warnings = [];
  if (invalidEventCount > 0) {
    warnings.push(
      `Skipped ${invalidEventCount} VEVENT entr${invalidEventCount === 1 ? "y" : "ies"} with invalid or unsupported date values in the visual layer.`,
    );
  }

  return {
    doc,
    events,
    warnings,
    invalidEventCount,
    veventCount,
  };
}

function parseEventBlock(rawLines) {
  const propertyLines = [];
  for (let i = 1; i < rawLines.length - 1; i += 1) {
    propertyLines.push(rawLines[i]);
  }

  const event = {
    id: createLocalEventId(),
    uid: "",
    summary: "",
    description: "",
    location: "",
    startDate: null,
    endDate: null,
    sourceTimeZone: "LOCAL",
    dateStyle: {
      start: { kind: "local", tzid: "", hasSeconds: false },
      end: { kind: "local", tzid: "", hasSeconds: false },
    },
    endSource: "DTEND",
    durationRaw: "",
    rrule: null,
    categories: [],
    priority: "",
    status: "",
    transp: "",
    xNodevisionColor: "",
    xNodevisionIcon: "",
    xNodevisionSymbol: "",
    unknownPropertyLines: [],
    rawLines: [...rawLines],
    changed: false,
    isNew: false,
  };

  let dtstartInfo = null;
  let dtendInfo = null;
  let durationInfo = null;
  let startParsed = null;
  let endParsed = null;

  const seenManaged = {};

  for (let i = 0; i < propertyLines.length; i += 1) {
    const line = propertyLines[i];
    const parsed = parsePropertyLine(line);
    if (!parsed) {
      event.unknownPropertyLines.push(line);
      continue;
    }

    const { name, value, params } = parsed;

    const markDuplicate = () => {
      event.unknownPropertyLines.push(line);
    };

    if (name === "UID") {
      if (seenManaged.UID) {
        markDuplicate();
      } else {
        event.uid = unescapeICalText(value).trim();
        seenManaged.UID = true;
      }
    } else if (name === "SUMMARY") {
      if (seenManaged.SUMMARY) {
        markDuplicate();
      } else {
        event.summary = unescapeICalText(value);
        seenManaged.SUMMARY = true;
      }
    } else if (name === "DESCRIPTION") {
      if (seenManaged.DESCRIPTION) {
        markDuplicate();
      } else {
        event.description = unescapeICalText(value);
        seenManaged.DESCRIPTION = true;
      }
    } else if (name === "LOCATION") {
      if (seenManaged.LOCATION) {
        markDuplicate();
      } else {
        event.location = unescapeICalText(value);
        seenManaged.LOCATION = true;
      }
    } else if (name === "DTSTART") {
      if (seenManaged.DTSTART) {
        markDuplicate();
      } else {
        dtstartInfo = { value, params, rawLine: line };
        seenManaged.DTSTART = true;
      }
    } else if (name === "DTEND") {
      if (seenManaged.DTEND) {
        markDuplicate();
      } else {
        dtendInfo = { value, params, rawLine: line };
        seenManaged.DTEND = true;
      }
    } else if (name === "DURATION") {
      if (seenManaged.DURATION) {
        markDuplicate();
      } else {
        durationInfo = { value, params, rawLine: line };
        seenManaged.DURATION = true;
      }
    } else if (name === "RRULE") {
      if (seenManaged.RRULE) {
        markDuplicate();
      } else {
        event.rrule = parseRRule(value);
        seenManaged.RRULE = true;
      }
    } else if (name === "CATEGORIES") {
      const cats = parseCategoryList(value);
      event.categories = event.categories.concat(cats);
    } else if (name === "PRIORITY") {
      if (seenManaged.PRIORITY) {
        markDuplicate();
      } else {
        event.priority = String(value || "").trim();
        seenManaged.PRIORITY = true;
      }
    } else if (name === "STATUS") {
      if (seenManaged.STATUS) {
        markDuplicate();
      } else {
        event.status = String(value || "").trim().toUpperCase();
        seenManaged.STATUS = true;
      }
    } else if (name === "TRANSP") {
      if (seenManaged.TRANSP) {
        markDuplicate();
      } else {
        event.transp = String(value || "").trim().toUpperCase();
        seenManaged.TRANSP = true;
      }
    } else if (name === "X-NODEVISION-COLOR") {
      if (seenManaged["X-NODEVISION-COLOR"]) {
        markDuplicate();
      } else {
        event.xNodevisionColor = unescapeICalText(value).trim();
        seenManaged["X-NODEVISION-COLOR"] = true;
      }
    } else if (name === "X-NODEVISION-ICON") {
      if (seenManaged["X-NODEVISION-ICON"]) {
        markDuplicate();
      } else {
        event.xNodevisionIcon = sanitizeNodevisionMarker(unescapeICalText(value).trim());
        seenManaged["X-NODEVISION-ICON"] = true;
      }
    } else if (name === "X-NODEVISION-SYMBOL") {
      if (seenManaged["X-NODEVISION-SYMBOL"]) {
        markDuplicate();
      } else {
        event.xNodevisionSymbol = sanitizeNodevisionMarker(unescapeICalText(value).trim());
        seenManaged["X-NODEVISION-SYMBOL"] = true;
      }
    } else {
      event.unknownPropertyLines.push(line);
    }
  }

  if (!dtstartInfo) {
    return {
      event: null,
      rawLines: [...rawLines],
      reason: "Missing DTSTART",
    };
  }

  startParsed = parseICalDate(dtstartInfo.value, dtstartInfo.params, null);
  if (!startParsed?.date) {
    return {
      event: null,
      rawLines: [...rawLines],
      reason: "Invalid DTSTART",
    };
  }

  event.sourceTimeZone = startParsed.sourceTimeZone;
  event.dateStyle.start = inferDateStyleFromParsed(dtstartInfo.value, dtstartInfo.params);

  if (dtendInfo) {
    endParsed = parseICalDate(dtendInfo.value, dtendInfo.params, startParsed.sourceTimeZone);
    if (!endParsed?.date) {
      return {
        event: null,
        rawLines: [...rawLines],
        reason: "Invalid DTEND",
      };
    }

    event.endSource = "DTEND";
    event.dateStyle.end = inferDateStyleFromParsed(dtendInfo.value, dtendInfo.params);
  } else if (durationInfo) {
    const durationMs = parseICalDurationToMs(durationInfo.value);
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return {
        event: null,
        rawLines: [...rawLines],
        reason: "Invalid DURATION",
      };
    }

    endParsed = { date: new Date(startParsed.date.getTime() + durationMs) };
    event.endSource = "DURATION";
    event.durationRaw = String(durationInfo.value || "").trim();
    event.dateStyle.end = event.dateStyle.start;
  } else {
    return {
      event: null,
      rawLines: [...rawLines],
      reason: "Missing DTEND and DURATION",
    };
  }

  if (endParsed.date.getTime() <= startParsed.date.getTime()) {
    return {
      event: null,
      rawLines: [...rawLines],
      reason: "DTEND before DTSTART",
    };
  }

  event.startDate = startParsed.date;
  event.endDate = endParsed.date;

  if (!event.uid) {
    event.uid = generateUid({
      year: startParsed.date.getUTCFullYear(),
      month: startParsed.date.getUTCMonth() + 1,
      day: startParsed.date.getUTCDate(),
    });
  }

  if (!event.summary) {
    event.summary = "New Event";
  }

  return {
    event,
    rawLines: [...rawLines],
    reason: "",
  };
}

function removeEventSection(doc, eventId) {
  if (!doc || !Array.isArray(doc.sections)) return;
  doc.sections = doc.sections.filter((section) => {
    if (section.type !== "event") return true;
    const eventModel = section.block?.event;
    if (!eventModel) return true;
    return eventModel.id !== eventId;
  });
}

function insertEventSection(doc, eventModel) {
  const newSection = {
    type: "event",
    block: {
      event: eventModel,
      rawLines: null,
      reason: "",
    },
  };

  if (!doc.sections || doc.sections.length === 0) {
    doc.sections = [
      { type: "outside", lines: ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nodevision//ICS Calendar Editor//EN"] },
      newSection,
      { type: "outside", lines: ["END:VCALENDAR"] },
    ];
    return;
  }

  let inserted = false;
  for (let i = 0; i < doc.sections.length; i += 1) {
    const section = doc.sections[i];
    if (section.type !== "outside" || !Array.isArray(section.lines)) continue;

    const endIndex = section.lines.findIndex((line) => String(line || "").trim().toUpperCase() === "END:VCALENDAR");
    if (endIndex === -1) continue;

    const before = section.lines.slice(0, endIndex);
    const after = section.lines.slice(endIndex);

    const replacement = [];
    if (before.length > 0) replacement.push({ type: "outside", lines: before });
    replacement.push(newSection);
    if (after.length > 0) replacement.push({ type: "outside", lines: after });

    doc.sections.splice(i, 1, ...replacement);
    inserted = true;
    break;
  }

  if (!inserted) {
    doc.sections.push(newSection);
  }
}

function hasAnyEventSections(doc) {
  if (!doc || !Array.isArray(doc.sections)) return false;
  return doc.sections.some((section) => section.type === "event");
}

function ensureCalendarEnvelope(doc) {
  if (!doc.sections) doc.sections = [];

  const allLines = doc.sections
    .filter((section) => section.type === "outside")
    .flatMap((section) => section.lines || []);

  const hasBegin = allLines.some((line) => String(line || "").trim().toUpperCase() === "BEGIN:VCALENDAR");
  const hasEnd = allLines.some((line) => String(line || "").trim().toUpperCase() === "END:VCALENDAR");

  if (!hasBegin) {
    doc.sections.unshift({
      type: "outside",
      lines: ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nodevision//ICS Calendar Editor//EN"],
    });
  }
  if (!hasEnd) {
    doc.sections.push({
      type: "outside",
      lines: ["END:VCALENDAR"],
    });
  }
}

function serializeCalendarDocument(doc) {
  ensureCalendarEnvelope(doc);

  const lines = [];

  for (let i = 0; i < doc.sections.length; i += 1) {
    const section = doc.sections[i];
    if (section.type === "outside") {
      lines.push(...(section.lines || []));
      continue;
    }

    if (section.type === "event") {
      const block = section.block || {};
      if (block.event) {
        if (!block.event.changed && Array.isArray(block.event.rawLines) && block.event.rawLines.length > 0) {
          lines.push(...block.event.rawLines);
        } else {
          lines.push(...serializeEvent(block.event));
        }
      } else if (Array.isArray(block.rawLines) && block.rawLines.length > 0) {
        lines.push(...block.rawLines);
      }
    }
  }

  const foldedLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    const raw = String(lines[i] ?? "");
    const pieces = foldICalLine(raw);
    foldedLines.push(...pieces);
  }

  return `${foldedLines.join("\r\n")}\r\n`;
}

function serializeEvent(eventModel) {
  const lines = ["BEGIN:VEVENT"];

  const uid = eventModel.uid || generateUid(convertDateToTimeZoneParts(eventModel.startDate, "UTC"));
  lines.push(`UID:${escapeICalText(uid)}`);

  lines.push(formatDateLine("DTSTART", eventModel.startDate, eventModel.dateStyle.start));

  if (eventModel.endSource === "DURATION" && eventModel.durationRaw && !eventModel.changed) {
    lines.push(`DURATION:${eventModel.durationRaw}`);
  } else {
    lines.push(formatDateLine("DTEND", eventModel.endDate, eventModel.dateStyle.end || eventModel.dateStyle.start));
  }

  lines.push(`SUMMARY:${escapeICalText(eventModel.summary || "New Event")}`);

  if (eventModel.description) {
    lines.push(`DESCRIPTION:${escapeICalText(eventModel.description)}`);
  }

  if (eventModel.location) {
    lines.push(`LOCATION:${escapeICalText(eventModel.location)}`);
  }

  if (eventModel.rrule && String(eventModel.rrule.FREQ || "").toUpperCase() === "WEEKLY") {
    const byDay = String(eventModel.rrule.BYDAY || "").trim().toUpperCase();
    const parts = ["FREQ=WEEKLY"];
    if (byDay && WEEKDAY_CODES.includes(byDay)) {
      parts.push(`BYDAY=${byDay}`);
    }
    lines.push(`RRULE:${parts.join(";")}`);
  }

  if (eventModel.categories && eventModel.categories.length > 0) {
    lines.push(`CATEGORIES:${eventModel.categories.map((cat) => escapeICalText(cat)).join(",")}`);
  }

  if (eventModel.priority) {
    lines.push(`PRIORITY:${String(eventModel.priority).trim()}`);
  }

  if (eventModel.status) {
    lines.push(`STATUS:${String(eventModel.status).trim().toUpperCase()}`);
  }

  if (eventModel.transp) {
    lines.push(`TRANSP:${String(eventModel.transp).trim().toUpperCase()}`);
  }

  if (eventModel.xNodevisionColor) {
    lines.push(`X-NODEVISION-COLOR:${escapeICalText(eventModel.xNodevisionColor)}`);
  }

  if (eventModel.xNodevisionIcon) {
    lines.push(`X-NODEVISION-ICON:${escapeICalText(eventModel.xNodevisionIcon)}`);
  }

  if (eventModel.xNodevisionSymbol) {
    lines.push(`X-NODEVISION-SYMBOL:${escapeICalText(eventModel.xNodevisionSymbol)}`);
  }

  if (Array.isArray(eventModel.unknownPropertyLines)) {
    for (let i = 0; i < eventModel.unknownPropertyLines.length; i += 1) {
      const line = String(eventModel.unknownPropertyLines[i] || "");
      const upper = line.trim().toUpperCase();
      if (!upper || upper === "BEGIN:VEVENT" || upper === "END:VEVENT") {
        continue;
      }
      lines.push(line);
    }
  }

  lines.push("END:VEVENT");
  return lines;
}

function formatDateLine(name, date, style) {
  const normalized = style || { kind: "local", tzid: "", hasSeconds: false };
  const kind = normalized.kind || "local";
  const hasSeconds = Boolean(normalized.hasSeconds);

  if (kind === "utc") {
    const y = date.getUTCFullYear();
    const m = pad2(date.getUTCMonth() + 1);
    const d = pad2(date.getUTCDate());
    const h = pad2(date.getUTCHours());
    const min = pad2(date.getUTCMinutes());
    const sec = pad2(date.getUTCSeconds());
    const timePart = hasSeconds ? `${h}${min}${sec}` : `${h}${min}00`;
    return `${name}:${y}${m}${d}T${timePart}Z`;
  }

  if (kind === "tzid" && normalized.tzid && isSupportedTimeZone(normalized.tzid)) {
    const parts = convertDateToTimeZoneParts(date, normalized.tzid);
    const sec = hasSeconds ? pad2(parts.second) : "00";
    return `${name};TZID=${normalized.tzid}:${parts.year}${pad2(parts.month)}${pad2(parts.day)}T${pad2(parts.hour)}${pad2(parts.minute)}${sec}`;
  }

  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  const sec = hasSeconds ? pad2(date.getSeconds()) : "00";
  return `${name}:${y}${m}${d}T${h}${min}${sec}`;
}

function inferDateStyleFromParsed(rawValue, params) {
  const value = String(rawValue || "").trim();
  const hasSeconds = /T\d{6}/.test(value);
  const upperValue = value.toUpperCase();
  const tzid = params?.TZID ? String(params.TZID || "").trim() : "";

  if (upperValue.endsWith("Z")) {
    return { kind: "utc", tzid: "", hasSeconds };
  }

  if (tzid && tzid.toUpperCase() !== "UTC") {
    return { kind: "tzid", tzid, hasSeconds };
  }

  if (tzid && tzid.toUpperCase() === "UTC") {
    return { kind: "utc", tzid: "", hasSeconds };
  }

  return { kind: "local", tzid: "", hasSeconds };
}

function inferNewEventDateStyle(displayTimeZone, selectedValue) {
  if (selectedValue === "UTC" || displayTimeZone === "UTC") {
    return { kind: "utc", tzid: "", hasSeconds: false };
  }

  if (selectedValue !== "__local__" && isSupportedTimeZone(displayTimeZone)) {
    return { kind: "tzid", tzid: displayTimeZone, hasSeconds: false };
  }

  return { kind: "local", tzid: "", hasSeconds: false };
}

function parsePropertyLine(line) {
  const text = String(line || "");
  const colonIndex = text.indexOf(":");
  if (colonIndex <= 0) {
    return null;
  }

  const left = text.slice(0, colonIndex);
  const value = text.slice(colonIndex + 1);

  const chunks = left.split(";");
  if (!chunks.length) return null;

  const name = String(chunks[0] || "").trim().toUpperCase();
  if (!name) return null;

  const params = {};
  for (let i = 1; i < chunks.length; i += 1) {
    const raw = String(chunks[i] || "");
    const eq = raw.indexOf("=");
    if (eq < 0) {
      params[raw.toUpperCase()] = true;
      continue;
    }

    const key = raw.slice(0, eq).trim().toUpperCase();
    let paramValue = raw.slice(eq + 1).trim();
    if (paramValue.startsWith('"') && paramValue.endsWith('"') && paramValue.length >= 2) {
      paramValue = paramValue.slice(1, -1);
    }
    params[key] = paramValue;
  }

  return {
    name,
    value,
    params,
    rawLine: text,
  };
}

function parseRRule(value) {
  const rule = {};
  const tokens = String(value || "").split(";");
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const eq = token.indexOf("=");
    if (eq <= 0) continue;

    const key = token.slice(0, eq).trim().toUpperCase();
    const val = token.slice(eq + 1).trim().toUpperCase();
    if (!key) continue;
    rule[key] = val;
  }
  return rule;
}

function parseCategoryList(value) {
  const pieces = splitEscaped(String(value || ""), ",");
  const categories = [];
  for (let i = 0; i < pieces.length; i += 1) {
    const text = unescapeICalText(pieces[i]).trim();
    if (text) categories.push(text);
  }
  return categories;
}

function parseCategoryInput(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitEscaped(value, delimiter) {
  const result = [];
  let current = "";
  let escaping = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value.charAt(i);

    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaping = true;
      continue;
    }

    if (char === delimiter) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function unfoldICS(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const unfolded = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (
      unfolded.length > 0 &&
      line.length > 0 &&
      (line.charAt(0) === " " || line.charAt(0) === "\t")
    ) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  return unfolded;
}

function parseICalDate(value, params, fallbackTimeZone) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/i);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hasTime = typeof match[4] !== "undefined";
  const hour = hasTime ? parseInt(match[4], 10) : 0;
  const minute = hasTime ? parseInt(match[5], 10) : 0;
  const second = hasTime && match[6] ? parseInt(match[6], 10) : 0;
  const isUtc = Boolean(match[7]);

  if (!isValidDateParts(year, month, day, hour, minute, second)) return null;

  const upperParams = params || {};
  let tzid = upperParams.TZID ? String(upperParams.TZID).trim() : "";
  if (!tzid && fallbackTimeZone && fallbackTimeZone !== "LOCAL") {
    tzid = fallbackTimeZone;
  }

  let date = null;
  let sourceTimeZone = "LOCAL";

  if (isUtc) {
    date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
    sourceTimeZone = "UTC";
  } else if (tzid) {
    if (tzid.toUpperCase() === "UTC") {
      date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
      sourceTimeZone = "UTC";
    } else if (!isSupportedTimeZone(tzid)) {
      return null;
    } else {
      date = zonedTimeToUtc(
        {
          year,
          month,
          day,
          hour,
          minute,
          second,
        },
        tzid,
      );
      sourceTimeZone = tzid;
    }
  } else {
    date = new Date(year, month - 1, day, hour, minute, second, 0);
    sourceTimeZone = "LOCAL";
  }

  if (!isFiniteDate(date)) return null;

  return {
    date,
    sourceTimeZone,
  };
}

function parseICalDurationToMs(raw) {
  const match = String(raw || "").trim().toUpperCase().match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;

  const sign = match[1] === "-" ? -1 : 1;
  const weeks = parseInt(match[2] || "0", 10);
  const days = parseInt(match[3] || "0", 10);
  const hours = parseInt(match[4] || "0", 10);
  const minutes = parseInt(match[5] || "0", 10);
  const seconds = parseInt(match[6] || "0", 10);

  const totalSeconds = (((weeks * 7 + days) * 24 + hours) * 60 + minutes) * 60 + seconds;
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;
  return sign * totalSeconds * 1000;
}

function foldICalLine(line) {
  const maxOctets = 75;
  const encoder = new TextEncoder();

  if (encoder.encode(line).length <= maxOctets) {
    return [line];
  }

  const segments = [];
  let remaining = line;

  while (remaining.length > 0) {
    let cut = remaining.length;
    while (cut > 0 && encoder.encode(remaining.slice(0, cut)).length > maxOctets) {
      cut -= 1;
    }

    if (cut <= 0) {
      cut = 1;
    }

    const head = remaining.slice(0, cut);
    segments.push(head);
    remaining = remaining.slice(cut);

    if (remaining.length > 0) {
      remaining = ` ${remaining}`;
    }
  }

  return segments;
}

function escapeICalText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function unescapeICalText(value) {
  const text = String(value || "");
  let output = "";

  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (char === "\\" && i + 1 < text.length) {
      const next = text.charAt(i + 1);
      if (next === "n" || next === "N") {
        output += "\n";
      } else if (next === "," || next === ";" || next === "\\") {
        output += next;
      } else {
        output += next;
      }
      i += 1;
    } else {
      output += char;
    }
  }

  return output;
}

function expandEventOccurrencesForWeek(eventModel, weekBounds) {
  if (
    eventModel.rrule &&
    String(eventModel.rrule.FREQ || "").toUpperCase() === "WEEKLY"
  ) {
    return expandWeeklyRecurringOccurrences(eventModel, weekBounds);
  }

  if (
    eventModel.endDate.getTime() > weekBounds.weekStart.getTime() &&
    eventModel.startDate.getTime() < weekBounds.weekEndExclusive.getTime()
  ) {
    return [{ start: eventModel.startDate, end: eventModel.endDate }];
  }

  return [];
}

function expandWeeklyRecurringOccurrences(eventModel, weekBounds) {
  const sourceZone = normalizeSourceTimeZone(eventModel.sourceTimeZone);
  const durationMs = eventModel.endDate.getTime() - eventModel.startDate.getTime();
  if (durationMs <= 0) return [];

  const anchorParts = convertDateToTimeZoneParts(eventModel.startDate, sourceZone);
  const anchorEpoch = epochDay(anchorParts.year, anchorParts.month, anchorParts.day);

  const recurrenceDays = getRecurrenceWeekdayCodes(eventModel.rrule, anchorParts.weekdayCode);
  if (recurrenceDays.length === 0) return [];

  const daySet = {};
  for (let i = 0; i < recurrenceDays.length; i += 1) {
    daySet[recurrenceDays[i]] = true;
  }

  const interval = parsePositiveInteger(eventModel.rrule.INTERVAL, 1);
  const untilDate = parseRRuleUntil(eventModel.rrule, sourceZone);

  const rangeStartSource = convertDateToTimeZoneParts(weekBounds.weekStart, sourceZone);
  const rangeEndSource = convertDateToTimeZoneParts(new Date(weekBounds.weekEndExclusive.getTime() - 1), sourceZone);

  const candidateStart = epochDay(rangeStartSource.year, rangeStartSource.month, rangeStartSource.day) - 7;
  const candidateEnd = epochDay(rangeEndSource.year, rangeEndSource.month, rangeEndSource.day) + 7;

  const seen = {};
  const occurrences = [];

  for (let epoch = candidateStart; epoch <= candidateEnd; epoch += 1) {
    const ymd = epochDayToYMD(epoch);
    const weekdayIndex = getWeekdayIndexFromYMD(ymd.year, ymd.month, ymd.day);
    const weekdayCode = WEEKDAY_CODES[weekdayIndex];
    if (!daySet[weekdayCode]) continue;

    const weeksSinceAnchor = Math.floor((epoch - anchorEpoch) / 7);
    if (Math.abs(weeksSinceAnchor) % interval !== 0) continue;

    const occurrenceStart = sourceZone === "LOCAL"
      ? new Date(ymd.year, ymd.month - 1, ymd.day, anchorParts.hour, anchorParts.minute, anchorParts.second, 0)
      : zonedTimeToUtc(
          {
            year: ymd.year,
            month: ymd.month,
            day: ymd.day,
            hour: anchorParts.hour,
            minute: anchorParts.minute,
            second: anchorParts.second,
          },
          sourceZone,
        );

    if (!isFiniteDate(occurrenceStart)) continue;
    if (untilDate && occurrenceStart.getTime() > untilDate.getTime()) continue;

    const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
    if (occurrenceEnd.getTime() <= weekBounds.weekStart.getTime()) continue;
    if (occurrenceStart.getTime() >= weekBounds.weekEndExclusive.getTime()) continue;

    const key = `${occurrenceStart.toISOString()}|${occurrenceEnd.toISOString()}`;
    if (seen[key]) continue;

    seen[key] = true;
    occurrences.push({ start: occurrenceStart, end: occurrenceEnd });
  }

  occurrences.sort((a, b) => a.start.getTime() - b.start.getTime());
  return occurrences;
}

function splitOccurrenceIntoDisplaySegments(startDate, endDate, timeZone, weekBounds) {
  if (!isFiniteDate(startDate) || !isFiniteDate(endDate) || endDate.getTime() <= startDate.getTime()) {
    return [];
  }

  const clippedStartMs = Math.max(startDate.getTime(), weekBounds.weekStart.getTime());
  const clippedEndMs = Math.min(endDate.getTime(), weekBounds.weekEndExclusive.getTime());
  if (clippedEndMs <= clippedStartMs) return [];

  const clippedStart = new Date(clippedStartMs);
  const clippedEnd = new Date(clippedEndMs);
  const lastMoment = new Date(clippedEndMs - 1);

  const startParts = convertDateToTimeZoneParts(clippedStart, timeZone);
  const endParts = convertDateToTimeZoneParts(lastMoment, timeZone);

  const startEpoch = epochDay(startParts.year, startParts.month, startParts.day);
  const endEpoch = epochDay(endParts.year, endParts.month, endParts.day);

  const segments = [];

  for (let epoch = startEpoch; epoch <= endEpoch; epoch += 1) {
    const ymd = epochDayToYMD(epoch);
    const dateKey = formatDateKey(ymd.year, ymd.month, ymd.day);
    const dayIndex = weekBounds.dateKeyToIndex[dateKey];
    if (typeof dayIndex !== "number") continue;

    const dayStart = zonedTimeToUtc(
      {
        year: ymd.year,
        month: ymd.month,
        day: ymd.day,
        hour: 0,
        minute: 0,
        second: 0,
      },
      timeZone,
    );

    const nextYmd = addDaysToYMD(ymd.year, ymd.month, ymd.day, 1);
    const dayEnd = zonedTimeToUtc(
      {
        year: nextYmd.year,
        month: nextYmd.month,
        day: nextYmd.day,
        hour: 0,
        minute: 0,
        second: 0,
      },
      timeZone,
    );

    const segmentStartMs = Math.max(clippedStartMs, dayStart.getTime());
    const segmentEndMs = Math.min(clippedEndMs, dayEnd.getTime());
    if (segmentEndMs <= segmentStartMs) continue;

    const segmentStart = new Date(segmentStartMs);
    const segmentEnd = new Date(segmentEndMs);

    const startSegmentParts = convertDateToTimeZoneParts(segmentStart, timeZone);
    const endSegmentParts = convertDateToTimeZoneParts(segmentEnd, timeZone);

    let startMinutes =
      startSegmentParts.hour * 60 +
      startSegmentParts.minute +
      startSegmentParts.second / 60;

    let endMinutes;
    if (segmentEndMs === dayEnd.getTime()) {
      endMinutes = MINUTES_PER_DAY;
    } else {
      endMinutes =
        endSegmentParts.hour * 60 +
        endSegmentParts.minute +
        endSegmentParts.second / 60;
    }

    startMinutes = clamp(startMinutes, 0, MINUTES_PER_DAY);
    endMinutes = clamp(endMinutes, 0, MINUTES_PER_DAY);

    if (endMinutes <= startMinutes) {
      endMinutes = Math.min(MINUTES_PER_DAY, startMinutes + SLOT_MINUTES);
    }

    segments.push({
      dayIndex,
      startMinutes,
      endMinutes,
      startDate: segmentStart,
      endDate: segmentEnd,
    });
  }

  return segments;
}

function getRecurrenceWeekdayCodes(rrule, fallbackCode) {
  if (!rrule || !rrule.BYDAY) {
    return fallbackCode ? [fallbackCode] : [];
  }

  const tokens = String(rrule.BYDAY).split(",");
  const valid = [];
  const seen = {};

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i].trim().toUpperCase();
    if (!token) continue;

    const code = token.slice(-2);
    if (!WEEKDAY_CODES.includes(code)) continue;
    if (seen[code]) continue;

    seen[code] = true;
    valid.push(code);
  }

  if (valid.length === 0 && fallbackCode) {
    return [fallbackCode];
  }

  return valid;
}

function parseRRuleUntil(rrule, sourceZone) {
  if (!rrule || !rrule.UNTIL) return null;
  const untilRaw = String(rrule.UNTIL || "").trim();
  if (!untilRaw) return null;

  const params = {};
  if (!/[zZ]$/.test(untilRaw) && sourceZone && sourceZone !== "LOCAL") {
    params.TZID = sourceZone;
  }

  const parsed = parseICalDate(untilRaw, params, sourceZone);
  return parsed?.date || null;
}

function getWeekBounds(timeZone, weekOffset = 0) {
  const nowParts = convertDateToTimeZoneParts(new Date(), timeZone);
  const sunday = addDaysToYMD(nowParts.year, nowParts.month, nowParts.day, -nowParts.weekdayIndex + weekOffset * 7);

  const days = [];
  const dateKeyToIndex = {};

  for (let i = 0; i < 7; i += 1) {
    const ymd = addDaysToYMD(sunday.year, sunday.month, sunday.day, i);
    const dateKey = formatDateKey(ymd.year, ymd.month, ymd.day);
    dateKeyToIndex[dateKey] = i;

    const anchor = zonedTimeToUtc(
      {
        year: ymd.year,
        month: ymd.month,
        day: ymd.day,
        hour: 12,
        minute: 0,
        second: 0,
      },
      timeZone,
    );

    days.push({
      year: ymd.year,
      month: ymd.month,
      day: ymd.day,
      dateKey,
      dateLabel: getDayHeaderLabel(anchor, timeZone),
    });
  }

  const weekStart = zonedTimeToUtc(
    {
      year: sunday.year,
      month: sunday.month,
      day: sunday.day,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone,
  );

  const nextSunday = addDaysToYMD(sunday.year, sunday.month, sunday.day, 7);
  const weekEndExclusive = zonedTimeToUtc(
    {
      year: nextSunday.year,
      month: nextSunday.month,
      day: nextSunday.day,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone,
  );

  return {
    weekStart,
    weekEndExclusive,
    days,
    dateKeyToIndex,
  };
}

function convertDateToTimeZoneParts(date, timeZone) {
  const formatter = getDateTimeFormatter(timeZone);
  const partsList = formatter.formatToParts(date);
  const parts = {};

  for (let i = 0; i < partsList.length; i += 1) {
    const part = partsList[i];
    if (part.type !== "literal") {
      parts[part.type] = part.value;
    }
  }

  let weekdayIndex = WEEKDAY_INDEX_MAP[parts.weekday];
  if (typeof weekdayIndex !== "number") {
    weekdayIndex = getWeekdayIndexFromYMD(
      parseInt(parts.year, 10),
      parseInt(parts.month, 10),
      parseInt(parts.day, 10),
    );
  }

  const dateKey = formatDateKey(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10),
    parseInt(parts.day, 10),
  );

  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    weekdayIndex,
    weekdayCode: WEEKDAY_CODES[weekdayIndex],
    dateKey,
  };
}

function zonedTimeToUtc(parts, timeZone) {
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  const hour = parts.hour || 0;
  const minute = parts.minute || 0;
  const second = parts.second || 0;

  if (timeZone === "LOCAL") {
    return new Date(year, month - 1, day, hour, minute, second, 0);
  }

  const utcReference = Date.UTC(year, month - 1, day, hour, minute, second, 0);
  let shifted = utcReference;

  for (let i = 0; i < 4; i += 1) {
    const offsetMs = getOffsetMillisForZone(new Date(shifted), timeZone);
    shifted = utcReference - offsetMs;
  }

  return new Date(shifted);
}

function weekSlotToUtcDate(weekBounds, dayIndex, minutes, timeZone) {
  const base = weekBounds.days[dayIndex];
  if (!base) return null;

  let adjustedDay = { year: base.year, month: base.month, day: base.day };
  let safeMinutes = minutes;

  if (safeMinutes >= MINUTES_PER_DAY) {
    adjustedDay = addDaysToYMD(base.year, base.month, base.day, 1);
    safeMinutes -= MINUTES_PER_DAY;
  }

  safeMinutes = clamp(safeMinutes, 0, MINUTES_PER_DAY - 1);

  return zonedTimeToUtc(
    {
      year: adjustedDay.year,
      month: adjustedDay.month,
      day: adjustedDay.day,
      hour: Math.floor(safeMinutes / 60),
      minute: safeMinutes % 60,
      second: 0,
    },
    timeZone,
  );
}

function getOffsetMillisForZone(date, timeZone) {
  if (timeZone === "LOCAL") {
    return -date.getTimezoneOffset() * 60000;
  }

  const parts = convertDateToTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, 0);
  return asUtc - date.getTime();
}

function getDateTimeFormatter(timeZone) {
  const key = timeZone || "LOCAL";
  if (!dateTimeFormatterCache[key]) {
    const options = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
      hour12: false,
    };

    if (timeZone && timeZone !== "LOCAL") {
      options.timeZone = timeZone;
    }

    dateTimeFormatterCache[key] = new Intl.DateTimeFormat("en-US", options);
  }

  return dateTimeFormatterCache[key];
}

function getDateHeaderFormatter(timeZone) {
  const key = timeZone || "LOCAL";
  if (!dateHeaderFormatterCache[key]) {
    const options = { month: "short", day: "numeric" };
    if (timeZone && timeZone !== "LOCAL") {
      options.timeZone = timeZone;
    }
    dateHeaderFormatterCache[key] = new Intl.DateTimeFormat("en-US", options);
  }
  return dateHeaderFormatterCache[key];
}

function getWeekRangeFormatter(timeZone) {
  const key = timeZone || "LOCAL";
  if (!weekRangeFormatterCache[key]) {
    const options = { month: "short", day: "numeric", year: "numeric" };
    if (timeZone && timeZone !== "LOCAL") {
      options.timeZone = timeZone;
    }
    weekRangeFormatterCache[key] = new Intl.DateTimeFormat("en-US", options);
  }
  return weekRangeFormatterCache[key];
}

function getDayHeaderLabel(date, timeZone) {
  return getDateHeaderFormatter(timeZone).format(date);
}

function formatWeekRange(weekBounds, timeZone) {
  const first = weekBounds.days[0];
  const last = weekBounds.days[6];

  const firstMidday = zonedTimeToUtc(
    {
      year: first.year,
      month: first.month,
      day: first.day,
      hour: 12,
      minute: 0,
      second: 0,
    },
    timeZone,
  );

  const lastMidday = zonedTimeToUtc(
    {
      year: last.year,
      month: last.month,
      day: last.day,
      hour: 12,
      minute: 0,
      second: 0,
    },
    timeZone,
  );

  const formatter = getWeekRangeFormatter(timeZone);
  return `${formatter.format(firstMidday)} - ${formatter.format(lastMidday)} (${timeZone})`;
}

function normalizeSourceTimeZone(sourceTimeZone) {
  if (!sourceTimeZone || sourceTimeZone === "LOCAL") return "LOCAL";
  if (sourceTimeZone === "UTC") return "UTC";
  if (isSupportedTimeZone(sourceTimeZone)) return sourceTimeZone;
  return "LOCAL";
}

function resolveDisplayTimeZone(value) {
  if (value === "__local__") {
    return getLocalTimeZone();
  }
  if (isSupportedTimeZone(value)) {
    return value;
  }
  return getLocalTimeZone();
}

function isKnownTimeZoneValue(value) {
  if (!value) return false;
  for (let i = 0; i < TIME_ZONE_OPTIONS.length; i += 1) {
    if (TIME_ZONE_OPTIONS[i].value === value) {
      return true;
    }
  }
  return false;
}

function isSupportedTimeZone(timeZone) {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getLocalTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && isSupportedTimeZone(tz)) return tz;
  } catch {
    // no-op
  }
  return "UTC";
}

function getPriorityInfo(value) {
  if (value === null || typeof value === "undefined" || String(value).trim() === "") {
    return { label: "MEDIUM", className: "priority-medium" };
  }

  const text = String(value).trim().toUpperCase();
  const numeric = parseInt(text, 10);
  if (!Number.isNaN(numeric)) {
    if (numeric <= 3) return { label: `HIGH (${numeric})`, className: "priority-high" };
    if (numeric >= 8) return { label: `LOW (${numeric})`, className: "priority-low" };
    return { label: `MEDIUM (${numeric})`, className: "priority-medium" };
  }

  if (text.includes("HIGH")) return { label: "HIGH", className: "priority-high" };
  if (text.includes("LOW")) return { label: "LOW", className: "priority-low" };
  return { label: "MEDIUM", className: "priority-medium" };
}

function getEventVisualInfo(eventModel) {
  const categoryFallback = getCategoryFallbackVisual(eventModel.categories || []);
  const preferredColor = sanitizeCssColor(eventModel.xNodevisionColor);
  const preferredIcon = sanitizeNodevisionMarker(eventModel.xNodevisionIcon);
  const preferredSymbol = sanitizeNodevisionMarker(eventModel.xNodevisionSymbol);

  return {
    color: preferredColor || categoryFallback.color || "#1565C0",
    icon: preferredIcon || categoryFallback.icon || "📌",
    symbol: preferredSymbol || categoryFallback.symbol || "•",
  };
}

function getCategoryFallbackVisual(categories) {
  if (!categories || categories.length === 0) {
    return { color: null, icon: "", symbol: "" };
  }

  const normalized = [];
  for (let i = 0; i < categories.length; i += 1) {
    const upper = String(categories[i] || "").toUpperCase();
    if (upper) normalized.push(upper);
  }

  for (let mapIndex = 0; mapIndex < CATEGORY_VISUALS.length; mapIndex += 1) {
    const mapped = CATEGORY_VISUALS[mapIndex];
    for (let catIndex = 0; catIndex < normalized.length; catIndex += 1) {
      const cat = normalized[catIndex];
      for (let tokenIndex = 0; tokenIndex < mapped.tokens.length; tokenIndex += 1) {
        const token = mapped.tokens[tokenIndex];
        if (cat.includes(token)) {
          return {
            color: mapped.color,
            icon: mapped.icon,
            symbol: mapped.symbol,
          };
        }
      }
    }
  }

  return { color: null, icon: "", symbol: "" };
}

function sanitizeCssColor(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
    return raw;
  }

  if (!/^[a-z]+$/i.test(raw)) {
    return null;
  }

  const lower = raw.toLowerCase();
  if (!SAFE_NAMED_COLORS[lower]) return null;

  try {
    if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
      if (!CSS.supports("color", lower)) return null;
    }
  } catch {
    // no-op
  }

  return lower;
}

function normalizeHexColor(value) {
  const raw = String(value || "").trim();
  const shortMatch = raw.match(/^#([0-9a-f]{3})$/i);
  if (shortMatch) {
    const s = shortMatch[1];
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`.toLowerCase();
  }

  const fullMatch = raw.match(/^#([0-9a-f]{6})$/i);
  if (fullMatch) {
    return `#${fullMatch[1].toLowerCase()}`;
  }

  return "";
}

function sanitizeNodevisionMarker(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const compact = raw.replace(/\s+/g, " ");
  return Array.from(compact).slice(0, 4).join("");
}

function applyNodevisionEventColor(card, color) {
  if (!color) return;

  card.style.borderLeft = `6px solid ${color}`;
  card.style.borderColor = color;

  const tinted = toRgbaIfHex(color, 0.2);
  if (tinted) {
    card.style.backgroundColor = tinted;
  }
}

function toRgbaIfHex(color, alpha) {
  const raw = String(color || "").trim();
  const match = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return "";

  const hex = match[1];
  const fullHex = hex.length === 3
    ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
    : hex;

  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatClockMinutes(minutes, allowEndOfDay) {
  const maxValue = allowEndOfDay ? MINUTES_PER_DAY : MINUTES_PER_DAY - 1;
  const rounded = Math.round(minutes);
  const clampedMinutes = clamp(rounded, 0, maxValue);
  if (allowEndOfDay && clampedMinutes === MINUTES_PER_DAY) {
    return "24:00";
  }
  const hours = Math.floor(clampedMinutes / 60);
  const mins = clampedMinutes % 60;
  return `${pad2(hours)}:${pad2(mins)}`;
}

function parseTimeInputMinutes(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function parseDateInput(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (!isValidDateParts(year, month, day, 0, 0, 0)) return null;
  return { year, month, day };
}

function pointerToMinutesInColumn(state, dayColumn, clientY) {
  const rect = dayColumn.getBoundingClientRect();
  const y = clamp(clientY - rect.top, 0, rect.height);
  return y / getPixelsPerMinute(state);
}

function projectPointerToWeek(state, clientX, clientY) {
  const rect = state.refs.daysGrid.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const x = clamp(clientX - rect.left, 0, rect.width - 0.001);
  const y = clamp(clientY - rect.top, 0, rect.height);

  const dayWidth = rect.width / 7;
  const dayIndex = clamp(Math.floor(x / dayWidth), 0, 6);
  const minutes = y / getPixelsPerMinute(state);

  return {
    dayIndex,
    minutes,
  };
}

function snapToStep(minutes, step) {
  return Math.round(minutes / step) * step;
}

function getPixelsPerMinute(state) {
  const slotHeightCss = getComputedStyle(document.documentElement).getPropertyValue("--nv-ics-slot-height");
  const slotHeight = parseFloat(slotHeightCss);
  const resolvedSlotHeight = Number.isFinite(slotHeight) && slotHeight > 0 ? slotHeight : 18;
  return resolvedSlotHeight / SLOT_MINUTES;
}

function parsePositiveInteger(value, fallbackValue) {
  const parsed = parseInt(String(value || ""), 10);
  if (!Number.isNaN(parsed) && parsed > 0) {
    return parsed;
  }
  return fallbackValue;
}

function addDaysToYMD(year, month, day, deltaDays) {
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  utcDate.setUTCDate(utcDate.getUTCDate() + deltaDays);
  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  };
}

function epochDay(year, month, day) {
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function epochDayToYMD(dayValue) {
  const date = new Date(dayValue * 86400000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function getWeekdayIndexFromYMD(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatDateKey(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isFiniteDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

function isValidDateParts(year, month, day, hour, minute, second) {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (hour < 0 || hour > 23) return false;
  if (minute < 0 || minute > 59) return false;
  if (second < 0 || second > 59) return false;

  const probe = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() + 1 === month &&
    probe.getUTCDate() === day &&
    probe.getUTCHours() === hour &&
    probe.getUTCMinutes() === minute &&
    probe.getUTCSeconds() === second
  );
}

function createLocalEventId() {
  globalEventSeq += 1;
  return `nv-ics-${Date.now().toString(36)}-${globalEventSeq.toString(36)}`;
}

function generateUid(dayInfo) {
  let randomBits = "";
  try {
    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    randomBits = `${arr[0].toString(16)}${arr[1].toString(16)}`;
  } catch {
    randomBits = Math.floor(Math.random() * 1e16).toString(16);
  }

  const y = dayInfo?.year || new Date().getUTCFullYear();
  const m = dayInfo?.month || 1;
  const d = dayInfo?.day || 1;
  return `nodevision-${y}${pad2(m)}${pad2(d)}-${randomBits}@nodevision.local`;
}

function cssEscape(value) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
