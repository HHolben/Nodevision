(function () {
  "use strict";

  var DEFAULT_SLOT_MINUTES = 60;
  var MIN_SLOT_MINUTES = 5;
  var MAX_SLOT_MINUTES = 240;
  var MINUTES_PER_DAY = 24 * 60;
  var DEFAULT_SLOT_HEIGHT_PX = 22;
  var TIMEZONE_STORAGE_KEY = "nodevision.icsviewer.displayTimeZone";
  var INCREMENT_STORAGE_KEY = "nodevision.icsviewer.slotMinutes";

  var DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];
  var WEEKDAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  var WEEKDAY_INDEX_MAP = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  var TIME_ZONE_OPTIONS = [
    { value: "__local__", label: "Local" },
    { value: "America/Chicago", label: "America/Chicago" },
    { value: "America/New_York", label: "America/New_York" },
    { value: "America/Denver", label: "America/Denver" },
    { value: "America/Los_Angeles", label: "America/Los_Angeles" },
    { value: "UTC", label: "UTC" }
  ];

  var CATEGORY_VISUALS = [
    { tokens: ["GARDEN", "PLANT", "YARD"], color: "#2E7D32", icon: "🌱", symbol: "⚙" },
    { tokens: ["WRITING", "AUTHOR", "MANUSCRIPT"], color: "#7B1FA2", icon: "✍️", symbol: "✎" },
    { tokens: ["WORK", "CAREER", "JOB"], color: "#1565C0", icon: "💼", symbol: "■" },
    { tokens: ["TRAVEL", "COMMUTE", "DRIVE"], color: "#EF6C00", icon: "🚗", symbol: "→" },
    { tokens: ["STUDY.COM", "STUDYCOM", "STUDY", "LEARNING"], color: "#6E7582", icon: "📚", symbol: "◇" }
  ];

  var SAFE_NAMED_COLORS = {
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
    crimson: true
  };

  var dateTimeFormatterCache = {};
  var dateHeaderFormatterCache = {};
  var weekRangeFormatterCache = {};

  var refs = {};
  var state = {
    filePath: "",
    events: [],
    parserWarnings: [],
    selectedTimeZoneValue: "__local__",
    displayTimeZone: "UTC",
    slotMinutes: DEFAULT_SLOT_MINUTES,
    rowsPerDay: 24,
    weekBounds: null,
    currentTimeIntervalId: null
  };

  document.addEventListener("DOMContentLoaded", initViewer);
  window.addEventListener("beforeunload", stopCurrentTimeTicker);

  function initViewer() {
    refs.statusMessage = document.getElementById("statusMessage");
    refs.calendarSection = document.getElementById("calendarSection");
    refs.weekRangeLabel = document.getElementById("weekRangeLabel");
    refs.filePathLabel = document.getElementById("filePathLabel");
    refs.calendarHeader = document.getElementById("calendarHeader");
    refs.timeColumn = document.getElementById("timeColumn");
    refs.daysGrid = document.getElementById("daysGrid");
    refs.timezoneForm = document.getElementById("timezoneForm");

    state.slotMinutes = loadStoredSlotMinutes();
    state.rowsPerDay = getRowsPerDay(state.slotMinutes);
    setRowsPerDayCssVar();

    buildTimeZoneControls();

    var filePath = getFilePathFromQuery();
    if (!filePath) {
      showFatalError("No .ics file path was provided. Use ?file=/Notebook/Schedule/your_file.ics");
      return;
    }

    state.filePath = filePath;
    refs.filePathLabel.textContent = "Source: " + state.filePath;
    loadCalendarFile();
  }

  function getFilePathFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var rawValue = params.get("file");
    if (!rawValue) {
      return "";
    }

    var value = String(rawValue).trim();
    if (!value) {
      return "";
    }

    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && value.charAt(0) !== "/") {
      value = "/" + value;
    }

    return value;
  }

  function buildTimeZoneControls() {
    var storedValue = "__local__";
    try {
      var localStorageValue = localStorage.getItem(TIMEZONE_STORAGE_KEY);
      if (isKnownTimeZoneValue(localStorageValue)) {
        storedValue = localStorageValue;
      }
    } catch (error) {
      storedValue = "__local__";
    }

    state.selectedTimeZoneValue = storedValue;
    state.displayTimeZone = resolveDisplayTimeZone(storedValue);

    refs.timezoneForm.innerHTML = "";
    var localZone = getLocalTimeZone();

    for (var i = 0; i < TIME_ZONE_OPTIONS.length; i += 1) {
      var option = TIME_ZONE_OPTIONS[i];
      var optionLabel = option.label;
      if (option.value === "__local__") {
        optionLabel = "Local (" + localZone + ")";
      }

      var label = document.createElement("label");
      label.className = "timezone-option";

      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "displayTimeZone";
      radio.value = option.value;
      radio.checked = option.value === storedValue;

      var text = document.createElement("span");
      text.textContent = optionLabel;

      label.appendChild(radio);
      label.appendChild(text);
      refs.timezoneForm.appendChild(label);
    }

    refs.timezoneForm.addEventListener("change", function (event) {
      if (!event.target || event.target.name !== "displayTimeZone") {
        return;
      }

      var nextValue = String(event.target.value || "__local__");
      if (!isKnownTimeZoneValue(nextValue)) {
        nextValue = "__local__";
      }

      state.selectedTimeZoneValue = nextValue;
      state.displayTimeZone = resolveDisplayTimeZone(nextValue);

      try {
        localStorage.setItem(TIMEZONE_STORAGE_KEY, nextValue);
      } catch (error) {
        // no-op
      }

      if (state.events.length > 0) {
        renderCalendar();
      }
    });
  }

  async function loadCalendarFile() {
    showStatus("Loading calendar file...", "info");

    try {
      var response = await fetch(state.filePath, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("HTTP " + response.status + " " + response.statusText);
      }

      var icsText = await response.text();
      var parseResult = parseICS(icsText);

      if (parseResult.veventCount === 0) {
        showFatalError("No VEVENT entries were found in this .ics file.");
        return;
      }

      if (parseResult.events.length === 0) {
        showFatalError("Found VEVENT entries, but event dates were invalid.");
        return;
      }

      state.events = parseResult.events;
      state.parserWarnings = parseResult.warnings.slice();

      refs.calendarSection.classList.remove("hidden");
      renderCalendar();
    } catch (error) {
      var message = error && error.message ? error.message : "Unknown loading error.";
      showFatalError("Could not load .ics file at " + state.filePath + ". " + message);
    }
  }

  function renderCalendar() {
    state.rowsPerDay = getRowsPerDay(state.slotMinutes);
    setRowsPerDayCssVar();
    state.weekBounds = getCurrentWeekBounds(state.displayTimeZone);

    renderWeekHeader();
    renderGridSkeleton();
    renderEvents();

    startCurrentTimeTicker();
  }

  function renderWeekHeader() {
    refs.weekRangeLabel.textContent = formatWeekRange(state.weekBounds, state.displayTimeZone);
  }

  function renderGridSkeleton() {
    refs.calendarHeader.innerHTML = "";
    refs.timeColumn.innerHTML = "";
    refs.daysGrid.innerHTML = "";

    var corner = document.createElement("div");
    corner.className = "header-corner";

    var cornerTitle = document.createElement("div");
    cornerTitle.className = "header-corner-title";
    cornerTitle.textContent = "Time";

    var incrementControl = document.createElement("label");
    incrementControl.className = "increment-control";

    var incrementLabel = document.createElement("span");
    incrementLabel.className = "increment-label";
    incrementLabel.textContent = "Step";

    var incrementInput = document.createElement("input");
    incrementInput.className = "increment-input";
    incrementInput.type = "number";
    incrementInput.min = String(MIN_SLOT_MINUTES);
    incrementInput.max = String(MAX_SLOT_MINUTES);
    incrementInput.step = "5";
    incrementInput.value = String(state.slotMinutes);
    incrementInput.title = "Row increment in minutes";
    incrementInput.setAttribute("aria-label", "Calendar row increment in minutes");

    var incrementUnit = document.createElement("span");
    incrementUnit.className = "increment-unit";
    incrementUnit.textContent = "min";

    incrementControl.appendChild(incrementLabel);
    incrementControl.appendChild(incrementInput);
    incrementControl.appendChild(incrementUnit);
    corner.appendChild(cornerTitle);
    corner.appendChild(incrementControl);
    refs.calendarHeader.appendChild(corner);

    incrementInput.addEventListener("change", onIncrementInputChange);

    for (var dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      var dayInfo = state.weekBounds.days[dayIndex];

      var headerCell = document.createElement("div");
      headerCell.className = "day-header";
      headerCell.dataset.dayIndex = String(dayIndex);

      var nameEl = document.createElement("div");
      nameEl.className = "day-header-name";
      nameEl.textContent = DAY_NAMES[dayIndex];

      var dateEl = document.createElement("div");
      dateEl.className = "day-header-date";
      dateEl.textContent = dayInfo.dateLabel;

      headerCell.appendChild(nameEl);
      headerCell.appendChild(dateEl);
      refs.calendarHeader.appendChild(headerCell);
    }

    for (var row = 0; row < state.rowsPerDay; row += 1) {
      var minutesFromMidnight = row * state.slotMinutes;
      var timeRow = document.createElement("div");
      timeRow.className = "time-slot";
      timeRow.textContent = formatClockMinutes(minutesFromMidnight, false);
      refs.timeColumn.appendChild(timeRow);
    }

    for (var col = 0; col < 7; col += 1) {
      var dayColumn = document.createElement("div");
      dayColumn.className = "day-column";
      dayColumn.dataset.dayIndex = String(col);

      var eventsLayer = document.createElement("div");
      eventsLayer.className = "events-layer";

      var nowLine = document.createElement("div");
      nowLine.className = "current-time-line";

      dayColumn.appendChild(eventsLayer);
      dayColumn.appendChild(nowLine);
      refs.daysGrid.appendChild(dayColumn);
    }
  }

  function onIncrementInputChange(event) {
    var nextMinutes = normalizeSlotMinutes(event.target.value, state.slotMinutes);
    event.target.value = String(nextMinutes);

    if (nextMinutes === state.slotMinutes) {
      return;
    }

    state.slotMinutes = nextMinutes;
    state.rowsPerDay = getRowsPerDay(nextMinutes);
    setRowsPerDayCssVar();

    try {
      localStorage.setItem(INCREMENT_STORAGE_KEY, String(nextMinutes));
    } catch (error) {
      // no-op
    }

    renderCalendar();
  }

  function renderEvents() {
    var dayColumns = refs.daysGrid.querySelectorAll(".day-column");
    for (var i = 0; i < dayColumns.length; i += 1) {
      var layer = dayColumns[i].querySelector(".events-layer");
      if (layer) {
        layer.innerHTML = "";
      }
    }

    var segmentsRendered = 0;

    for (var eventIndex = 0; eventIndex < state.events.length; eventIndex += 1) {
      var eventModel = state.events[eventIndex];
      var occurrences = expandEventOccurrencesForWeek(eventModel, state.weekBounds);

      for (var occurrenceIndex = 0; occurrenceIndex < occurrences.length; occurrenceIndex += 1) {
        var occurrence = occurrences[occurrenceIndex];
        var segments = splitOccurrenceIntoDisplaySegments(
          occurrence.start,
          occurrence.end,
          state.displayTimeZone,
          state.weekBounds
        );

        for (var segIndex = 0; segIndex < segments.length; segIndex += 1) {
          var segment = segments[segIndex];
          var targetColumn = refs.daysGrid.querySelector(
            '.day-column[data-day-index="' + segment.dayIndex + '"] .events-layer'
          );

          if (!targetColumn) {
            continue;
          }

          var eventElement = createEventElement(eventModel, segment);
          targetColumn.appendChild(eventElement);
          segmentsRendered += 1;
        }
      }
    }

    var statusMessages = [];
    if (state.parserWarnings.length > 0) {
      statusMessages.push(state.parserWarnings.join(" "));
    }
    if (segmentsRendered === 0) {
      statusMessages.push("No events fall within this Sunday-Saturday week in the selected time zone.");
    }

    if (statusMessages.length > 0) {
      showStatus(statusMessages.join(" "), state.parserWarnings.length > 0 ? "warning" : "info");
    } else {
      showStatus("Loaded " + state.events.length + " event(s).", "info");
    }

    updateCurrentTimeLine();
  }

  function createEventElement(eventModel, segment) {
    var priorityInfo = getPriorityInfo(eventModel.priority);
    var visualInfo = getEventVisualInfo(eventModel);
    var pixelsPerMinute = getPixelsPerMinute();
    var slotHeight = getSlotHeightPx();

    var eventCard = document.createElement("div");
    eventCard.className = "event-card " + priorityInfo.className;

    var topPx = segment.startMinutes * pixelsPerMinute;
    var durationMinutes = Math.max(segment.endMinutes - segment.startMinutes, 5);
    var heightPx = durationMinutes * pixelsPerMinute - 2;

    eventCard.style.top = topPx.toFixed(2) + "px";
    eventCard.style.height = Math.max(heightPx, Math.max(8, slotHeight * 0.35)).toFixed(2) + "px";

    applyNodevisionEventColor(eventCard, visualInfo.color);

    var title = document.createElement("div");
    title.className = "event-title";

    if (visualInfo.icon) {
      var icon = document.createElement("span");
      icon.className = "event-icon";
      icon.textContent = visualInfo.icon;
      title.appendChild(icon);
    }

    var titleText = document.createElement("span");
    titleText.className = "event-title-text";
    titleText.textContent = eventModel.summary || "(Untitled Event)";
    title.appendChild(titleText);

    eventCard.appendChild(title);

    var meta = document.createElement("div");
    meta.className = "event-meta";
    var timeText =
      formatClockMinutes(segment.startMinutes, false) +
      " - " +
      formatClockMinutes(segment.endMinutes, true);
    meta.textContent = visualInfo.symbol ? (visualInfo.symbol + " · " + timeText) : timeText;
    eventCard.appendChild(meta);

    if (eventModel.priority !== null && typeof eventModel.priority !== "undefined" && String(eventModel.priority).trim() !== "") {
      var priority = document.createElement("div");
      priority.className = "event-priority";
      priority.textContent = "Priority: " + priorityInfo.label;
      eventCard.appendChild(priority);
    }

    if (eventModel.description) {
      eventCard.title = eventModel.description;
    }

    return eventCard;
  }

  function startCurrentTimeTicker() {
    stopCurrentTimeTicker();
    updateCurrentTimeLine();
    state.currentTimeIntervalId = setInterval(updateCurrentTimeLine, 60000);
  }

  function stopCurrentTimeTicker() {
    if (state.currentTimeIntervalId) {
      clearInterval(state.currentTimeIntervalId);
      state.currentTimeIntervalId = null;
    }
  }

  function updateCurrentTimeLine() {
    var lines = refs.daysGrid.querySelectorAll(".current-time-line");
    for (var i = 0; i < lines.length; i += 1) {
      lines[i].style.display = "none";
    }

    if (!state.weekBounds) {
      return;
    }

    var now = new Date();
    var nowParts = convertDateToTimeZoneParts(now, state.displayTimeZone);
    var dayIndex = state.weekBounds.dateKeyToIndex[nowParts.dateKey];

    if (typeof dayIndex !== "number") {
      return;
    }

    var line = refs.daysGrid.querySelector(
      '.day-column[data-day-index="' + dayIndex + '"] .current-time-line'
    );
    if (!line) {
      return;
    }

    var nowMinutes = nowParts.hour * 60 + nowParts.minute + nowParts.second / 60;
    var topPx = nowMinutes * getPixelsPerMinute();

    line.style.top = topPx.toFixed(2) + "px";
    line.style.display = "block";
  }

  function parseICS(icsText) {
    var unfoldedText = unfoldICS(icsText);
    var lines = unfoldedText.split("\n");

    var inEvent = false;
    var rawEvent = null;
    var result = {
      events: [],
      veventCount: 0,
      invalidEventCount: 0,
      warnings: []
    };

    for (var i = 0; i < lines.length; i += 1) {
      var line = lines[i];
      if (!line) {
        continue;
      }

      var trimmed = line.trim();
      var upper = trimmed.toUpperCase();

      if (upper === "BEGIN:VEVENT") {
        inEvent = true;
        rawEvent = {};
        continue;
      }

      if (upper === "END:VEVENT") {
        if (inEvent && rawEvent) {
          result.veventCount += 1;
          var built = buildEventModel(rawEvent);
          if (built.event) {
            result.events.push(built.event);
          } else {
            result.invalidEventCount += 1;
          }
        }
        inEvent = false;
        rawEvent = null;
        continue;
      }

      if (!inEvent || !rawEvent) {
        continue;
      }

      var parsedProperty = parsePropertyLine(line);
      if (!parsedProperty) {
        continue;
      }

      var name = parsedProperty.name;
      var value = parsedProperty.value;
      var params = parsedProperty.params;

      if (name === "SUMMARY") {
        rawEvent.summary = unescapeICalText(value);
      } else if (name === "DESCRIPTION") {
        rawEvent.description = unescapeICalText(value);
      } else if (name === "DTSTART") {
        rawEvent.dtstart = { value: value, params: params };
      } else if (name === "DTEND") {
        rawEvent.dtend = { value: value, params: params };
      } else if (name === "RRULE") {
        rawEvent.rrule = parseRRule(value);
      } else if (name === "CATEGORIES") {
        var cats = parseCategoryList(value);
        if (!rawEvent.categories) {
          rawEvent.categories = [];
        }
        rawEvent.categories = rawEvent.categories.concat(cats);
      } else if (name === "PRIORITY") {
        rawEvent.priority = String(value || "").trim();
      } else if (name === "X-NODEVISION-COLOR") {
        rawEvent.xNodevisionColor = unescapeICalText(value).trim();
      } else if (name === "X-NODEVISION-ICON") {
        rawEvent.xNodevisionIcon = unescapeICalText(value).trim();
      } else if (name === "X-NODEVISION-SYMBOL") {
        rawEvent.xNodevisionSymbol = unescapeICalText(value).trim();
      }
    }

    if (result.invalidEventCount > 0) {
      result.warnings.push(
        "Skipped " +
          result.invalidEventCount +
          " event(s) with invalid or unsupported date values."
      );
    }

    return result;
  }

  function buildEventModel(rawEvent) {
    if (!rawEvent.dtstart || !rawEvent.dtend) {
      return { event: null };
    }

    var startParsed = parseICalDate(rawEvent.dtstart.value, rawEvent.dtstart.params, null);
    if (!startParsed || !startParsed.date || !isFiniteDate(startParsed.date)) {
      return { event: null };
    }

    var endParsed = parseICalDate(
      rawEvent.dtend.value,
      rawEvent.dtend.params,
      startParsed.sourceTimeZone
    );
    if (!endParsed || !endParsed.date || !isFiniteDate(endParsed.date)) {
      return { event: null };
    }

    if (endParsed.date.getTime() <= startParsed.date.getTime()) {
      return { event: null };
    }

    return {
      event: {
        summary: rawEvent.summary || "(Untitled Event)",
        description: rawEvent.description || "",
        startDate: startParsed.date,
        endDate: endParsed.date,
        sourceTimeZone: startParsed.sourceTimeZone,
        rrule: rawEvent.rrule || null,
        categories: rawEvent.categories || [],
        priority: rawEvent.priority || null,
        xNodevisionColor: rawEvent.xNodevisionColor || "",
        xNodevisionIcon: rawEvent.xNodevisionIcon || "",
        xNodevisionSymbol: rawEvent.xNodevisionSymbol || ""
      }
    };
  }

  function unfoldICS(text) {
    var normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    var inputLines = normalized.split("\n");
    var unfolded = [];

    for (var i = 0; i < inputLines.length; i += 1) {
      var currentLine = inputLines[i];
      if (
        unfolded.length > 0 &&
        currentLine.length > 0 &&
        (currentLine.charAt(0) === " " || currentLine.charAt(0) === "\t")
      ) {
        unfolded[unfolded.length - 1] += currentLine.slice(1);
      } else {
        unfolded.push(currentLine);
      }
    }

    return unfolded.join("\n");
  }

  function parsePropertyLine(line) {
    var colonIndex = line.indexOf(":");
    if (colonIndex <= 0) {
      return null;
    }

    var left = line.slice(0, colonIndex);
    var value = line.slice(colonIndex + 1);

    var parts = left.split(";");
    if (parts.length === 0) {
      return null;
    }

    var name = String(parts[0] || "").trim().toUpperCase();
    if (!name) {
      return null;
    }

    var params = {};
    for (var i = 1; i < parts.length; i += 1) {
      var paramRaw = parts[i];
      var eqIndex = paramRaw.indexOf("=");
      if (eqIndex === -1) {
        params[String(paramRaw).toUpperCase()] = true;
        continue;
      }

      var key = paramRaw.slice(0, eqIndex).toUpperCase();
      var paramValue = paramRaw.slice(eqIndex + 1);
      if (
        paramValue.length >= 2 &&
        paramValue.charAt(0) === "\"" &&
        paramValue.charAt(paramValue.length - 1) === "\""
      ) {
        paramValue = paramValue.slice(1, -1);
      }
      params[key] = paramValue;
    }

    return {
      name: name,
      params: params,
      value: value
    };
  }

  function parseRRule(value) {
    var rule = {};
    var entries = String(value || "").split(";");
    for (var i = 0; i < entries.length; i += 1) {
      var item = entries[i];
      var eqIndex = item.indexOf("=");
      if (eqIndex <= 0) {
        continue;
      }
      var key = item.slice(0, eqIndex).trim().toUpperCase();
      var val = item.slice(eqIndex + 1).trim().toUpperCase();
      if (!key) {
        continue;
      }
      rule[key] = val;
    }
    return rule;
  }

  function parseCategoryList(value) {
    var split = splitEscaped(String(value || ""), ",");
    var categories = [];
    for (var i = 0; i < split.length; i += 1) {
      var text = unescapeICalText(split[i]).trim();
      if (text) {
        categories.push(text);
      }
    }
    return categories;
  }

  function splitEscaped(value, delimiter) {
    var result = [];
    var current = "";
    var escaping = false;

    for (var i = 0; i < value.length; i += 1) {
      var char = value.charAt(i);
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

  function unescapeICalText(input) {
    var text = String(input || "");
    var output = "";

    for (var i = 0; i < text.length; i += 1) {
      var char = text.charAt(i);
      if (char === "\\" && i + 1 < text.length) {
        var next = text.charAt(i + 1);
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

  function parseICalDate(value, params, fallbackTimeZone) {
    var raw = String(value || "").trim();
    if (!raw) {
      return null;
    }

    var dateMatch = raw.match(
      /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?$/i
    );
    if (!dateMatch) {
      return null;
    }

    var year = parseInt(dateMatch[1], 10);
    var month = parseInt(dateMatch[2], 10);
    var day = parseInt(dateMatch[3], 10);
    var hasTime = typeof dateMatch[4] !== "undefined";
    var hour = hasTime ? parseInt(dateMatch[4], 10) : 0;
    var minute = hasTime ? parseInt(dateMatch[5], 10) : 0;
    var second = hasTime && dateMatch[6] ? parseInt(dateMatch[6], 10) : 0;
    var isUtc = Boolean(dateMatch[7]);

    if (!isValidDateParts(year, month, day, hour, minute, second)) {
      return null;
    }

    var paramsUpper = params || {};
    var tzid = paramsUpper.TZID ? String(paramsUpper.TZID).trim() : "";
    if (!tzid && fallbackTimeZone && fallbackTimeZone !== "LOCAL") {
      tzid = fallbackTimeZone;
    }

    var date = null;
    var sourceTimeZone = "LOCAL";

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
            year: year,
            month: month,
            day: day,
            hour: hour,
            minute: minute,
            second: second
          },
          tzid
        );
        sourceTimeZone = tzid;
      }
    } else {
      date = new Date(year, month - 1, day, hour, minute, second, 0);
      sourceTimeZone = "LOCAL";
    }

    if (!isFiniteDate(date)) {
      return null;
    }

    return {
      date: date,
      sourceTimeZone: sourceTimeZone
    };
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
      return [
        {
          start: eventModel.startDate,
          end: eventModel.endDate
        }
      ];
    }

    return [];
  }

  function expandWeeklyRecurringOccurrences(eventModel, weekBounds) {
    var sourceZone = normalizeSourceTimeZone(eventModel.sourceTimeZone);
    var durationMs = eventModel.endDate.getTime() - eventModel.startDate.getTime();
    if (durationMs <= 0) {
      return [];
    }

    var anchorParts = convertDateToTimeZoneParts(eventModel.startDate, sourceZone);
    var anchorEpoch = epochDay(anchorParts.year, anchorParts.month, anchorParts.day);
    var recurrenceDays = getRecurrenceWeekdayCodes(eventModel.rrule, anchorParts.weekdayCode);
    if (recurrenceDays.length === 0) {
      return [];
    }

    var recurrenceDaySet = {};
    for (var i = 0; i < recurrenceDays.length; i += 1) {
      recurrenceDaySet[recurrenceDays[i]] = true;
    }

    var interval = parsePositiveInteger(eventModel.rrule.INTERVAL, 1);
    var untilDate = parseRRuleUntil(eventModel.rrule, sourceZone);

    var rangeStartSource = convertDateToTimeZoneParts(weekBounds.weekStart, sourceZone);
    var rangeEndSource = convertDateToTimeZoneParts(
      new Date(weekBounds.weekEndExclusive.getTime() - 1),
      sourceZone
    );

    var candidateStartEpoch =
      epochDay(rangeStartSource.year, rangeStartSource.month, rangeStartSource.day) - 7;
    var candidateEndEpoch =
      epochDay(rangeEndSource.year, rangeEndSource.month, rangeEndSource.day) + 7;

    var seen = {};
    var occurrences = [];

    for (var candidateEpoch = candidateStartEpoch; candidateEpoch <= candidateEndEpoch; candidateEpoch += 1) {
      var ymd = epochDayToYMD(candidateEpoch);
      var weekdayIndex = getWeekdayIndexFromYMD(ymd.year, ymd.month, ymd.day);
      var weekdayCode = WEEKDAY_CODES[weekdayIndex];
      if (!recurrenceDaySet[weekdayCode]) {
        continue;
      }

      var weeksSinceAnchor = Math.floor((candidateEpoch - anchorEpoch) / 7);
      // Nodevision schedules use weekly templates; mirror the recurrence pattern
      // across adjacent weeks so current-week rendering is not blocked by a future anchor date.
      if (Math.abs(weeksSinceAnchor) % interval !== 0) {
        continue;
      }

      var occurrenceStart = sourceZone === "LOCAL"
        ? new Date(
            ymd.year,
            ymd.month - 1,
            ymd.day,
            anchorParts.hour,
            anchorParts.minute,
            anchorParts.second,
            0
          )
        : zonedTimeToUtc(
            {
              year: ymd.year,
              month: ymd.month,
              day: ymd.day,
              hour: anchorParts.hour,
              minute: anchorParts.minute,
              second: anchorParts.second
            },
            sourceZone
          );

      if (!isFiniteDate(occurrenceStart)) {
        continue;
      }

      if (untilDate && occurrenceStart.getTime() > untilDate.getTime()) {
        continue;
      }

      var occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);

      if (occurrenceEnd.getTime() <= weekBounds.weekStart.getTime()) {
        continue;
      }
      if (occurrenceStart.getTime() >= weekBounds.weekEndExclusive.getTime()) {
        continue;
      }

      var key = occurrenceStart.toISOString() + "|" + occurrenceEnd.toISOString();
      if (seen[key]) {
        continue;
      }

      seen[key] = true;
      occurrences.push({
        start: occurrenceStart,
        end: occurrenceEnd
      });
    }

    occurrences.sort(function (a, b) {
      return a.start.getTime() - b.start.getTime();
    });

    return occurrences;
  }

  function getRecurrenceWeekdayCodes(rrule, fallbackCode) {
    if (!rrule || !rrule.BYDAY) {
      return fallbackCode ? [fallbackCode] : [];
    }

    var byDayRaw = String(rrule.BYDAY).split(",");
    var validCodes = [];
    var seen = {};

    for (var i = 0; i < byDayRaw.length; i += 1) {
      var token = byDayRaw[i].trim().toUpperCase();
      if (!token) {
        continue;
      }

      var code = token.slice(-2);
      if (WEEKDAY_CODES.indexOf(code) === -1) {
        continue;
      }
      if (seen[code]) {
        continue;
      }

      seen[code] = true;
      validCodes.push(code);
    }

    if (validCodes.length === 0 && fallbackCode) {
      return [fallbackCode];
    }

    return validCodes;
  }

  function parseRRuleUntil(rrule, sourceZone) {
    if (!rrule || !rrule.UNTIL) {
      return null;
    }

    var untilRaw = String(rrule.UNTIL).trim();
    if (!untilRaw) {
      return null;
    }

    var params = {};
    if (!/[zZ]$/.test(untilRaw) && sourceZone && sourceZone !== "LOCAL") {
      params.TZID = sourceZone;
    }

    var parsed = parseICalDate(untilRaw, params, sourceZone);
    return parsed && parsed.date ? parsed.date : null;
  }

  function splitOccurrenceIntoDisplaySegments(startDate, endDate, timeZone, weekBounds) {
    if (
      !isFiniteDate(startDate) ||
      !isFiniteDate(endDate) ||
      endDate.getTime() <= startDate.getTime()
    ) {
      return [];
    }

    var clippedStartMs = Math.max(startDate.getTime(), weekBounds.weekStart.getTime());
    var clippedEndMs = Math.min(endDate.getTime(), weekBounds.weekEndExclusive.getTime());

    if (clippedEndMs <= clippedStartMs) {
      return [];
    }

    var clippedStart = new Date(clippedStartMs);
    var clippedEnd = new Date(clippedEndMs);
    var lastMoment = new Date(clippedEndMs - 1);

    var startParts = convertDateToTimeZoneParts(clippedStart, timeZone);
    var endParts = convertDateToTimeZoneParts(lastMoment, timeZone);

    var startEpoch = epochDay(startParts.year, startParts.month, startParts.day);
    var endEpoch = epochDay(endParts.year, endParts.month, endParts.day);

    var segments = [];

    for (var dayEpoch = startEpoch; dayEpoch <= endEpoch; dayEpoch += 1) {
      var ymd = epochDayToYMD(dayEpoch);
      var dayKey = formatDateKey(ymd.year, ymd.month, ymd.day);
      var dayIndex = weekBounds.dateKeyToIndex[dayKey];
      if (typeof dayIndex !== "number") {
        continue;
      }

      var dayStart = zonedTimeToUtc(
        {
          year: ymd.year,
          month: ymd.month,
          day: ymd.day,
          hour: 0,
          minute: 0,
          second: 0
        },
        timeZone
      );
      var nextYmd = addDaysToYMD(ymd.year, ymd.month, ymd.day, 1);
      var dayEnd = zonedTimeToUtc(
        {
          year: nextYmd.year,
          month: nextYmd.month,
          day: nextYmd.day,
          hour: 0,
          minute: 0,
          second: 0
        },
        timeZone
      );

      var segmentStartMs = Math.max(clippedStartMs, dayStart.getTime());
      var segmentEndMs = Math.min(clippedEndMs, dayEnd.getTime());
      if (segmentEndMs <= segmentStartMs) {
        continue;
      }

      var segmentStart = new Date(segmentStartMs);
      var segmentEnd = new Date(segmentEndMs);

      var startSegmentParts = convertDateToTimeZoneParts(segmentStart, timeZone);
      var endSegmentParts = convertDateToTimeZoneParts(segmentEnd, timeZone);

      var startMinutes =
        startSegmentParts.hour * 60 +
        startSegmentParts.minute +
        startSegmentParts.second / 60;

      var endMinutes;
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
        endMinutes = Math.min(MINUTES_PER_DAY, startMinutes + state.slotMinutes);
      }

      segments.push({
        dayIndex: dayIndex,
        startMinutes: startMinutes,
        endMinutes: endMinutes,
        startDate: segmentStart,
        endDate: segmentEnd
      });
    }

    return segments;
  }

  function getCurrentWeekBounds(timeZone) {
    var nowParts = convertDateToTimeZoneParts(new Date(), timeZone);
    var sundayYmd = addDaysToYMD(
      nowParts.year,
      nowParts.month,
      nowParts.day,
      -nowParts.weekdayIndex
    );

    var days = [];
    var dateKeyToIndex = {};

    for (var i = 0; i < 7; i += 1) {
      var ymd = addDaysToYMD(sundayYmd.year, sundayYmd.month, sundayYmd.day, i);
      var dateKey = formatDateKey(ymd.year, ymd.month, ymd.day);
      dateKeyToIndex[dateKey] = i;

      var dayLabelAnchor = zonedTimeToUtc(
        {
          year: ymd.year,
          month: ymd.month,
          day: ymd.day,
          hour: 12,
          minute: 0,
          second: 0
        },
        timeZone
      );

      days.push({
        year: ymd.year,
        month: ymd.month,
        day: ymd.day,
        dateKey: dateKey,
        dateLabel: getDayHeaderLabel(dayLabelAnchor, timeZone)
      });
    }

    var weekStart = zonedTimeToUtc(
      {
        year: sundayYmd.year,
        month: sundayYmd.month,
        day: sundayYmd.day,
        hour: 0,
        minute: 0,
        second: 0
      },
      timeZone
    );

    var nextSunday = addDaysToYMD(sundayYmd.year, sundayYmd.month, sundayYmd.day, 7);
    var weekEndExclusive = zonedTimeToUtc(
      {
        year: nextSunday.year,
        month: nextSunday.month,
        day: nextSunday.day,
        hour: 0,
        minute: 0,
        second: 0
      },
      timeZone
    );

    return {
      weekStart: weekStart,
      weekEndExclusive: weekEndExclusive,
      days: days,
      dateKeyToIndex: dateKeyToIndex
    };
  }

  function convertDateToTimeZoneParts(date, timeZone) {
    var formatter = getDateTimeFormatter(timeZone);
    var partsList = formatter.formatToParts(date);
    var parts = {};

    for (var i = 0; i < partsList.length; i += 1) {
      var part = partsList[i];
      if (part.type !== "literal") {
        parts[part.type] = part.value;
      }
    }

    var weekdayIndex = WEEKDAY_INDEX_MAP[parts.weekday];
    if (typeof weekdayIndex !== "number") {
      weekdayIndex = getWeekdayIndexFromYMD(
        parseInt(parts.year, 10),
        parseInt(parts.month, 10),
        parseInt(parts.day, 10)
      );
    }

    var dateKey = formatDateKey(
      parseInt(parts.year, 10),
      parseInt(parts.month, 10),
      parseInt(parts.day, 10)
    );

    return {
      year: parseInt(parts.year, 10),
      month: parseInt(parts.month, 10),
      day: parseInt(parts.day, 10),
      hour: parseInt(parts.hour, 10),
      minute: parseInt(parts.minute, 10),
      second: parseInt(parts.second, 10),
      weekdayIndex: weekdayIndex,
      weekdayCode: WEEKDAY_CODES[weekdayIndex],
      dateKey: dateKey
    };
  }

  function zonedTimeToUtc(parts, timeZone) {
    var year = parts.year;
    var month = parts.month;
    var day = parts.day;
    var hour = parts.hour || 0;
    var minute = parts.minute || 0;
    var second = parts.second || 0;

    if (timeZone === "LOCAL") {
      return new Date(year, month - 1, day, hour, minute, second, 0);
    }

    var utcReference = Date.UTC(year, month - 1, day, hour, minute, second, 0);
    var shifted = utcReference;

    for (var i = 0; i < 4; i += 1) {
      var offsetMs = getOffsetMillisForZone(new Date(shifted), timeZone);
      shifted = utcReference - offsetMs;
    }

    return new Date(shifted);
  }

  function getOffsetMillisForZone(date, timeZone) {
    if (timeZone === "LOCAL") {
      return -date.getTimezoneOffset() * 60000;
    }

    var parts = convertDateToTimeZoneParts(date, timeZone);
    var asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      0
    );
    return asUtc - date.getTime();
  }

  function getDayHeaderLabel(date, timeZone) {
    var formatter = getDateHeaderFormatter(timeZone);
    return formatter.format(date);
  }

  function formatWeekRange(weekBounds, timeZone) {
    var first = weekBounds.days[0];
    var last = weekBounds.days[6];

    var firstMidday = zonedTimeToUtc(
      {
        year: first.year,
        month: first.month,
        day: first.day,
        hour: 12,
        minute: 0,
        second: 0
      },
      timeZone
    );
    var lastMidday = zonedTimeToUtc(
      {
        year: last.year,
        month: last.month,
        day: last.day,
        hour: 12,
        minute: 0,
        second: 0
      },
      timeZone
    );

    var formatter = getWeekRangeFormatter(timeZone);
    return (
      formatter.format(firstMidday) +
      " - " +
      formatter.format(lastMidday) +
      " (" +
      timeZone +
      ")"
    );
  }

  function getDateTimeFormatter(timeZone) {
    var key = timeZone || "LOCAL";
    if (!dateTimeFormatterCache[key]) {
      var options = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        weekday: "short",
        hourCycle: "h23",
        hour12: false
      };
      if (timeZone && timeZone !== "LOCAL") {
        options.timeZone = timeZone;
      }
      dateTimeFormatterCache[key] = new Intl.DateTimeFormat("en-US", options);
    }
    return dateTimeFormatterCache[key];
  }

  function getDateHeaderFormatter(timeZone) {
    var key = timeZone || "LOCAL";
    if (!dateHeaderFormatterCache[key]) {
      var options = {
        month: "short",
        day: "numeric"
      };
      if (timeZone && timeZone !== "LOCAL") {
        options.timeZone = timeZone;
      }
      dateHeaderFormatterCache[key] = new Intl.DateTimeFormat("en-US", options);
    }
    return dateHeaderFormatterCache[key];
  }

  function getWeekRangeFormatter(timeZone) {
    var key = timeZone || "LOCAL";
    if (!weekRangeFormatterCache[key]) {
      var options = {
        month: "short",
        day: "numeric",
        year: "numeric"
      };
      if (timeZone && timeZone !== "LOCAL") {
        options.timeZone = timeZone;
      }
      weekRangeFormatterCache[key] = new Intl.DateTimeFormat("en-US", options);
    }
    return weekRangeFormatterCache[key];
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

  function normalizeSourceTimeZone(sourceTimeZone) {
    if (!sourceTimeZone || sourceTimeZone === "LOCAL") {
      return "LOCAL";
    }
    if (sourceTimeZone === "UTC") {
      return "UTC";
    }
    if (isSupportedTimeZone(sourceTimeZone)) {
      return sourceTimeZone;
    }
    return "LOCAL";
  }

  function isKnownTimeZoneValue(value) {
    if (!value) {
      return false;
    }
    for (var i = 0; i < TIME_ZONE_OPTIONS.length; i += 1) {
      if (TIME_ZONE_OPTIONS[i].value === value) {
        return true;
      }
    }
    return false;
  }

  function isSupportedTimeZone(timeZone) {
    if (!timeZone) {
      return false;
    }
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timeZone }).format(new Date());
      return true;
    } catch (error) {
      return false;
    }
  }

  function getLocalTimeZone() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && isSupportedTimeZone(tz)) {
        return tz;
      }
    } catch (error) {
      // no-op
    }
    return "UTC";
  }

  function getPriorityInfo(priorityValue) {
    if (priorityValue === null || typeof priorityValue === "undefined") {
      return {
        label: "MEDIUM",
        className: "priority-medium"
      };
    }

    var text = String(priorityValue).trim();
    if (!text) {
      return {
        label: "MEDIUM",
        className: "priority-medium"
      };
    }

    var upper = text.toUpperCase();
    var numeric = parseInt(upper, 10);

    if (!isNaN(numeric)) {
      if (numeric <= 3) {
        return { label: "HIGH (" + numeric + ")", className: "priority-high" };
      }
      if (numeric >= 8) {
        return { label: "LOW (" + numeric + ")", className: "priority-low" };
      }
      return { label: "MEDIUM (" + numeric + ")", className: "priority-medium" };
    }

    if (upper.indexOf("HIGH") !== -1) {
      return { label: "HIGH", className: "priority-high" };
    }
    if (upper.indexOf("LOW") !== -1) {
      return { label: "LOW", className: "priority-low" };
    }

    return { label: "MEDIUM", className: "priority-medium" };
  }

  function getEventVisualInfo(eventModel) {
    var categoryFallback = getCategoryFallbackVisual(eventModel.categories || []);
    var preferredColor = sanitizeCssColor(eventModel.xNodevisionColor);
    var preferredIcon = sanitizeNodevisionMarker(eventModel.xNodevisionIcon);
    var preferredSymbol = sanitizeNodevisionMarker(eventModel.xNodevisionSymbol);

    return {
      color: preferredColor || categoryFallback.color || null,
      icon: preferredIcon || categoryFallback.icon || "",
      symbol: preferredSymbol || categoryFallback.symbol || ""
    };
  }

  function getCategoryFallbackVisual(categories) {
    if (!categories || categories.length === 0) {
      return { color: null, icon: "", symbol: "" };
    }

    var normalizedCategories = [];
    for (var i = 0; i < categories.length; i += 1) {
      var upper = String(categories[i] || "").toUpperCase();
      if (upper) {
        normalizedCategories.push(upper);
      }
    }

    for (var mapIndex = 0; mapIndex < CATEGORY_VISUALS.length; mapIndex += 1) {
      var mapped = CATEGORY_VISUALS[mapIndex];
      for (var catIndex = 0; catIndex < normalizedCategories.length; catIndex += 1) {
        var category = normalizedCategories[catIndex];
        for (var tokenIndex = 0; tokenIndex < mapped.tokens.length; tokenIndex += 1) {
          var token = mapped.tokens[tokenIndex];
          if (category.indexOf(token) !== -1) {
            return {
              color: mapped.color,
              icon: mapped.icon,
              symbol: mapped.symbol
            };
          }
        }
      }
    }

    return { color: null, icon: "", symbol: "" };
  }

  function sanitizeCssColor(value) {
    var raw = String(value || "").trim();
    if (!raw) {
      return null;
    }

    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
      return raw;
    }

    if (!/^[a-z]+$/i.test(raw)) {
      return null;
    }

    var lower = raw.toLowerCase();
    if (!SAFE_NAMED_COLORS[lower]) {
      return null;
    }

    try {
      if (typeof CSS !== "undefined" && typeof CSS.supports === "function") {
        if (!CSS.supports("color", lower)) {
          return null;
        }
      }
    } catch (error) {
      // no-op
    }

    return lower;
  }

  function sanitizeNodevisionMarker(value) {
    var raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    var compact = raw.replace(/\s+/g, " ");
    return Array.from(compact).slice(0, 4).join("");
  }

  function applyNodevisionEventColor(eventCard, color) {
    if (!color) {
      return;
    }

    eventCard.style.borderLeft = "6px solid " + color;
    eventCard.style.borderColor = color;

    var tinted = toRgbaIfHex(color, 0.2);
    if (tinted) {
      eventCard.style.backgroundColor = tinted;
    }
  }

  function toRgbaIfHex(color, alpha) {
    var raw = String(color || "").trim();
    var match = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) {
      return "";
    }

    var hex = match[1];
    var fullHex;
    if (hex.length === 3) {
      fullHex =
        hex.charAt(0) + hex.charAt(0) +
        hex.charAt(1) + hex.charAt(1) +
        hex.charAt(2) + hex.charAt(2);
    } else {
      fullHex = hex;
    }

    var r = parseInt(fullHex.slice(0, 2), 16);
    var g = parseInt(fullHex.slice(2, 4), 16);
    var b = parseInt(fullHex.slice(4, 6), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  }

  function showStatus(message, type) {
    refs.statusMessage.textContent = String(message || "");
    refs.statusMessage.className = "status-message show " + (type || "info");
  }

  function showFatalError(message) {
    stopCurrentTimeTicker();
    refs.calendarSection.classList.add("hidden");
    showStatus(message, "error");
  }

  function formatClockMinutes(minutes, allowEndOfDay) {
    var maxValue = allowEndOfDay ? MINUTES_PER_DAY : MINUTES_PER_DAY - 1;
    var rounded = Math.round(minutes);
    var clampedMinutes = clamp(rounded, 0, maxValue);
    if (allowEndOfDay && clampedMinutes === MINUTES_PER_DAY) {
      return "24:00";
    }
    var hours = Math.floor(clampedMinutes / 60);
    var mins = clampedMinutes % 60;
    return pad2(hours) + ":" + pad2(mins);
  }

  function parsePositiveInteger(value, fallbackValue) {
    var parsed = parseInt(String(value || ""), 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    return fallbackValue;
  }

  function loadStoredSlotMinutes() {
    var fallbackValue = DEFAULT_SLOT_MINUTES;
    try {
      var storedValue = localStorage.getItem(INCREMENT_STORAGE_KEY);
      return normalizeSlotMinutes(storedValue, fallbackValue);
    } catch (error) {
      return fallbackValue;
    }
  }

  function normalizeSlotMinutes(value, fallbackValue) {
    var parsed = parseInt(String(value || ""), 10);
    if (isNaN(parsed)) {
      return fallbackValue;
    }
    return clamp(parsed, MIN_SLOT_MINUTES, MAX_SLOT_MINUTES);
  }

  function getRowsPerDay(slotMinutes) {
    return Math.max(1, Math.ceil(MINUTES_PER_DAY / slotMinutes));
  }

  function setRowsPerDayCssVar() {
    document.documentElement.style.setProperty("--rows-per-day", String(state.rowsPerDay));
  }

  function addDaysToYMD(year, month, day, deltaDays) {
    var utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    utcDate.setUTCDate(utcDate.getUTCDate() + deltaDays);
    return {
      year: utcDate.getUTCFullYear(),
      month: utcDate.getUTCMonth() + 1,
      day: utcDate.getUTCDate()
    };
  }

  function epochDay(year, month, day) {
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  }

  function epochDayToYMD(dayValue) {
    var date = new Date(dayValue * 86400000);
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate()
    };
  }

  function getWeekdayIndexFromYMD(year, month, day) {
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  }

  function formatDateKey(year, month, day) {
    return String(year) + "-" + pad2(month) + "-" + pad2(day);
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function getSlotHeightPx() {
    var cssValue = getComputedStyle(document.documentElement).getPropertyValue("--slot-height");
    var parsed = parseFloat(cssValue);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
    return DEFAULT_SLOT_HEIGHT_PX;
  }

  function getDayHeightPx() {
    return getSlotHeightPx() * state.rowsPerDay;
  }

  function getPixelsPerMinute() {
    return getDayHeightPx() / MINUTES_PER_DAY;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isFiniteDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
  }

  function isValidDateParts(year, month, day, hour, minute, second) {
    if (month < 1 || month > 12) {
      return false;
    }
    if (day < 1 || day > 31) {
      return false;
    }
    if (hour < 0 || hour > 23) {
      return false;
    }
    if (minute < 0 || minute > 59) {
      return false;
    }
    if (second < 0 || second > 59) {
      return false;
    }

    var check = new Date(Date.UTC(year, month - 1, day, hour, minute, second, 0));
    return (
      check.getUTCFullYear() === year &&
      check.getUTCMonth() + 1 === month &&
      check.getUTCDate() === day
    );
  }
})();
