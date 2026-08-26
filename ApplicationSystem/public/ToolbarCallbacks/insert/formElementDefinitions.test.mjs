// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/formElementDefinitions.test.mjs
// This test verifies HTML form insertion metadata, toolbar placement, function naming, and conservative script parsing.

import assert from "node:assert/strict";
import fs from "node:fs";
import { getNodevisionCommandDefinition } from "../../Commands/NodevisionCommandRegistry.mjs";
import { findFunctionSource, parseFunctionName } from "../../PanelInstances/Common/Layers/HtmlFunctionParser.mjs";
import {
  buildHandlerScript,
  defaultEventForElement,
  generatedFunctionNameForElement,
  jsIdentifierFromText,
} from "../../PanelInstances/Common/Layers/htmlFormEventTools.mjs";
import { getFormElementDefinition } from "./formElementDefinitions.mjs";

function toolbarItems() {
  const toolbarUrl = new URL("../../ToolbarJSONfiles/insertToolbar.json", import.meta.url);
  const parsed = JSON.parse(fs.readFileSync(toolbarUrl, "utf8"));
  return Array.isArray(parsed) ? parsed : parsed.items || [];
}

function findToolbarItem(heading, parentHeading) {
  return toolbarItems().find((item) => item.heading === heading && item.parentHeading === parentHeading);
}

function fakeElement(tagName, attrs = {}) {
  return {
    ...attrs,
    tagName: tagName.toUpperCase(),
    matches(selector) {
      return selector.split(",").map((part) => part.trim()).includes(tagName.toLowerCase());
    },
  };
}


const requiredCommandSlugs = [
  "button", "text", "number", "email", "password", "search", "telephone", "url", "date", "time", "date-time",
  "checkbox", "radio", "range", "color", "file", "text-area", "select", "label", "fieldset", "form",
];

const requiredToolbarItems = new Map([
  ["Button", "insertFormButton"],
  ["Text Field", "insertFormTextField"],
  ["Number Field", "insertFormNumberField"],
  ["Checkbox", "insertFormCheckbox"],
  ["Radio Button", "insertFormRadioButton"],
  ["Text Area", "insertFormTextArea"],
  ["Select / Dropdown", "insertFormSelectDropdown"],
  ["Form", "insertFormForm"],
]);

assert.ok(findToolbarItem("Structure", "Insert"), "Structure appears under Insert");
assert.ok(findToolbarItem("Form Element", "Insert"), "Form Element appears under Insert");
assert.equal(findToolbarItem("Cartoon Panel", "Structure")?.callbackKey, "insertCartoonPanel");
assert.equal(findToolbarItem("Sensitive Elements", "Structure")?.callbackKey, "insertSensitive");
for (const [heading, callbackKey] of requiredToolbarItems) {
  assert.equal(findToolbarItem(heading, "Form Element")?.callbackKey, callbackKey);
}

for (const slug of requiredCommandSlugs) {
  assert.ok(getNodevisionCommandDefinition("editor.insert.form." + slug), "form command exists for " + slug);
}
assert.equal(getNodevisionCommandDefinition("editor.insert.form.button")?.label, "Insert Button");
assert.equal(getNodevisionCommandDefinition("editor.insert.form.date-time")?.sessionSafe, false);

const samples = {
  button: getFormElementDefinition("button").render({ id: "button-1" }),
  text: getFormElementDefinition("text").render({ id: "text-field-1" }),
  number: getFormElementDefinition("number").render({ id: "number-field-1" }),
  checkbox: getFormElementDefinition("checkbox").render({ id: "checkbox-1" }),
  radio: getFormElementDefinition("radio").render({ id: "radio-button-1" }),
  textarea: getFormElementDefinition("textarea").render({ id: "text-area-1" }),
  select: getFormElementDefinition("select").render({ id: "select-1" }),
  form: getFormElementDefinition("form").render({ id: "form-1", uniqueId: (base) => base + "-1" }),
};

assert.match(samples.button, /<button id="button-1" type="button">Button<\/button>/);
assert.match(samples.text, /<input id="text-field-1" name="text-field-1" type="text"/);
assert.match(samples.number, /type="number"/);
assert.match(samples.checkbox, /<input id="checkbox-1" name="checkbox-1" type="checkbox">/);
assert.match(samples.radio, /<input id="radio-button-1" name="radio-group" type="radio"/);
assert.match(samples.textarea, /<textarea id="text-area-1" name="text-area-1"/);
assert.match(samples.select, /<select id="select-1" name="select-1">/);
assert.match(samples.form, /<form id="form-1" method="post">/);

assert.equal(defaultEventForElement(fakeElement("button")), "click");
assert.equal(defaultEventForElement(fakeElement("input", { type: "checkbox" })), "change");
assert.equal(defaultEventForElement(fakeElement("input", { type: "range" })), "input");
assert.equal(defaultEventForElement(fakeElement("select")), "change");
assert.equal(defaultEventForElement(fakeElement("form")), "submit");
assert.equal(jsIdentifierFromText("contact-form"), "contactForm");
assert.equal(generatedFunctionNameForElement(fakeElement("form", { id: "contact-form" }), "submit", []), "contactFormSubmit");
assert.equal(generatedFunctionNameForElement(fakeElement("button", { id: "button-1" }), "click", ["button1Click"]), "button1Click2");

const handlerScript = buildHandlerScript({ elementId: "button-1", eventName: "click", functionName: "button1Click" });
assert.match(handlerScript, /function button1Click\(event\) \{/);
assert.match(handlerScript, /document\.getElementById\("button-1"\)/);
assert.equal(parseFunctionName("function button1Click(event) {}"), "button1Click");
assert.equal(findFunctionSource(handlerScript, "button1Click")?.source.includes("function button1Click"), true);

console.log("Form element insertion metadata test passed");
