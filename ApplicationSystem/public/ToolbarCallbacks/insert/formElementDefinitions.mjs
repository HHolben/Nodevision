// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/formElementDefinitions.mjs
// This module defines standard HTML form element presets used by the graphical editor Insert Form Element subtoolbar so inserted Notebook markup remains ordinary portable HTML.

const INPUT_EVENTS = Object.freeze(["input", "change", "focus", "blur", "keydown", "keyup"]);
const CHANGE_EVENTS = Object.freeze(["change", "input", "focus", "blur"]);
const ACTION_EVENTS = Object.freeze(["click", "dblclick", "focus", "blur", "keydown", "keyup", "pointerdown", "pointerup"]);
const FORM_EVENTS = Object.freeze(["submit", "input", "change", "focus", "blur", "keydown", "keyup"]);

function inputPreset(label, type, idBase, eventName, events = INPUT_EVENTS) {
  return Object.freeze({
    label,
    idBase,
    eventName,
    events,
    render({ id }) {
      return '<input id="' + id + '" name="' + id + '" type="' + type + '" placeholder="' + label + '">';
    },
  });
}

export const FORM_ELEMENT_DEFINITIONS = Object.freeze({
  button: Object.freeze({
    label: "Button",
    idBase: "button",
    eventName: "click",
    events: ACTION_EVENTS,
    render({ id }) {
      return '<button id="' + id + '" type="button">Button</button>';
    },
  }),
  text: inputPreset("Text Field", "text", "text-field", "input"),
  number: inputPreset("Number Field", "number", "number-field", "input"),
  email: inputPreset("Email Field", "email", "email-field", "input"),
  password: inputPreset("Password Field", "password", "password-field", "input"),
  search: inputPreset("Search Field", "search", "search-field", "input"),
  tel: inputPreset("Telephone Field", "tel", "telephone-field", "input"),
  url: inputPreset("URL Field", "url", "url-field", "input"),
  date: inputPreset("Date Field", "date", "date-field", "change", CHANGE_EVENTS),
  time: inputPreset("Time Field", "time", "time-field", "change", CHANGE_EVENTS),
  "datetime-local": inputPreset("Date/Time Field", "datetime-local", "date-time-field", "change", CHANGE_EVENTS),
  checkbox: Object.freeze({
    label: "Checkbox",
    idBase: "checkbox",
    eventName: "change",
    events: CHANGE_EVENTS,
    render({ id }) {
      return '<label for="' + id + '"><input id="' + id + '" name="' + id + '" type="checkbox"> Checkbox</label>';
    },
  }),
  radio: Object.freeze({
    label: "Radio Button",
    idBase: "radio-button",
    eventName: "change",
    events: CHANGE_EVENTS,
    render({ id }) {
      return '<label for="' + id + '"><input id="' + id + '" name="radio-group" type="radio"> Radio Button</label>';
    },
  }),
  range: Object.freeze({
    label: "Range Slider",
    idBase: "range-slider",
    eventName: "input",
    events: INPUT_EVENTS,
    render({ id }) {
      return '<input id="' + id + '" name="' + id + '" type="range" min="0" max="100" value="50">';
    },
  }),
  color: Object.freeze({
    label: "Color Picker",
    idBase: "color-picker",
    eventName: "input",
    events: CHANGE_EVENTS,
    render({ id }) {
      return '<input id="' + id + '" name="' + id + '" type="color" value="#3366ff">';
    },
  }),
  file: inputPreset("File Input", "file", "file-input", "change", Object.freeze(["change", "focus", "blur"])),
  textarea: Object.freeze({
    label: "Text Area",
    idBase: "text-area",
    eventName: "input",
    events: INPUT_EVENTS,
    render({ id }) {
      return '<textarea id="' + id + '" name="' + id + '" placeholder="Text Area"></textarea>';
    },
  }),
  select: Object.freeze({
    label: "Select / Dropdown",
    idBase: "select-dropdown",
    eventName: "change",
    events: CHANGE_EVENTS,
    render({ id }) {
      return '<select id="' + id + '" name="' + id + '"><option>Option 1</option></select>';
    },
  }),
  label: Object.freeze({
    label: "Label",
    idBase: "label",
    eventName: "",
    events: Object.freeze([]),
    render({ id }) {
      return '<label id="' + id + '">Label</label>';
    },
  }),
  fieldset: Object.freeze({
    label: "Fieldset",
    idBase: "fieldset",
    eventName: "",
    events: Object.freeze([]),
    render({ id }) {
      return '<fieldset id="' + id + '"><legend>Fieldset</legend></fieldset>';
    },
  }),
  form: Object.freeze({
    label: "Form",
    idBase: "form",
    eventName: "submit",
    events: FORM_EVENTS,
    render({ id, uniqueId }) {
      const fieldId = uniqueId("form-field");
      return '<form id="' + id + '"><fieldset><legend>Form</legend><label for="' + fieldId + '">Field</label> <input id="' + fieldId + '" name="field" type="text"> <button type="submit">Submit</button></fieldset></form>';
    },
  }),
});

export function getFormElementDefinition(kind) {
  return FORM_ELEMENT_DEFINITIONS[String(kind || "")] || null;
}
