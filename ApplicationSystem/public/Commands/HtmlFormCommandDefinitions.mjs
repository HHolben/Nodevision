// Nodevision/ApplicationSystem/public/Commands/HtmlFormCommandDefinitions.mjs
// This module provides shared command metadata for inserting standard HTML form elements.

export const HTML_FORM_INSERT_COMMANDS = Object.freeze([
  ["button", "Button"],
  ["text", "Text Field"],
  ["number", "Number Field"],
  ["email", "Email Field"],
  ["password", "Password Field"],
  ["search", "Search Field"],
  ["telephone", "Telephone Field"],
  ["url", "URL Field"],
  ["date", "Date Field"],
  ["time", "Time Field"],
  ["date-time", "Date/Time Field"],
  ["checkbox", "Checkbox"],
  ["radio", "Radio Button"],
  ["range", "Range Slider"],
  ["color", "Color Picker"],
  ["file", "File Input"],
  ["text-area", "Text Area"],
  ["select", "Select / Dropdown"],
  ["label", "Label"],
  ["fieldset", "Fieldset"],
  ["form", "Form"],
].map(([kind, label]) => ({
  id: "editor.insert.form." + kind,
  category: "HTML Insert",
  label: "Insert " + label,
  description: "Insert a standard HTML " + label.toLowerCase() + " into the active graphical HTML editor.",
  sessionSafe: false,
  arguments: [],
  returns: "status",
})));
