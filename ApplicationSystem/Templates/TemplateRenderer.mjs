// Nodevision/ApplicationSystem/Templates/TemplateRenderer.mjs
// This module parses declarative .template.html files and renders their output without executing template JavaScript.

import { load } from "cheerio";

const SKIPPED_INPUT_TYPES = new Set(["button", "submit", "reset", "file", "image"]);

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeOutputExtension(value) {
  const raw = String(value || "").trim().replace(/^\.+/, "").toLowerCase();
  if (!raw) return "html";
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(raw)) return "html";
  return raw;
}

function textOrFallback(value, fallback) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function getFieldLabel($, form, element, name) {
  const id = element.attr("id");
  if (id) {
    const label = form.find("label").filter((_, node) => $(node).attr("for") === id).first();
    const labelText = textOrFallback(label.text(), "");
    if (labelText) return labelText;
  }

  const parentLabel = element.closest("label");
  const parentLabelText = textOrFallback(parentLabel.text(), "");
  if (parentLabelText) return parentLabelText;

  return textOrFallback(
    element.attr("aria-label") || element.attr("placeholder") || name,
    name,
  );
}

function getSelectOptions($, select) {
  const options = [];
  select.find("option").each((_, optionNode) => {
    const option = $(optionNode);
    const text = textOrFallback(option.text(), option.attr("value") || "");
    options.push({
      value: option.attr("value") ?? text,
      label: text,
      selected: option.is("[selected]"),
    });
  });
  return options;
}

function getDefaultSelectValue(options) {
  const selected = options.find((option) => option.selected);
  return selected?.value ?? options[0]?.value ?? "";
}

function upsertRadioField(fields, field) {
  const existing = fields.find((candidate) => candidate.name === field.name && candidate.type === "radio");
  if (!existing) {
    fields.push(field);
    return;
  }

  existing.options.push(...field.options);
  if (!existing.defaultValue && field.defaultValue) {
    existing.defaultValue = field.defaultValue;
  }
}

export function parseFormTemplate(html) {
  const $ = load(String(html || ""), { scriptingEnabled: false });
  const form = $("form").first();
  if (!form.length) {
    const err = new Error("Template form not found.");
    err.code = "TEMPLATE_FORM_MISSING";
    err.status = 400;
    throw err;
  }

  const outputNode = $("template[data-output]").first();
  if (!outputNode.length) {
    const err = new Error("Template output block not found.");
    err.code = "TEMPLATE_OUTPUT_MISSING";
    err.status = 400;
    throw err;
  }

  const outputExtension = sanitizeOutputExtension(form.attr("data-template-output-extension"));
  const fields = [];

  form.find("input, select, textarea").each((_, node) => {
    const element = $(node);
    const tag = String(node.tagName || "").toLowerCase();
    const name = String(element.attr("name") || "").trim();
    if (!name || element.is("[disabled]")) return;

    if (tag === "input") {
      const type = String(element.attr("type") || "text").toLowerCase();
      if (SKIPPED_INPUT_TYPES.has(type) || type === "hidden") return;

      if (type === "radio") {
        const value = element.attr("value") ?? "";
        upsertRadioField(fields, {
          type: "radio",
          name,
          label: getFieldLabel($, form, element, name),
          required: element.is("[required]"),
          defaultValue: element.is("[checked]") ? value : "",
          options: [{
            value,
            label: textOrFallback(element.attr("data-label") || element.attr("value"), value || name),
            selected: element.is("[checked]"),
          }],
        });
        return;
      }

      fields.push({
        type: type === "checkbox" ? "checkbox" : type,
        name,
        label: getFieldLabel($, form, element, name),
        required: element.is("[required]"),
        placeholder: element.attr("placeholder") || "",
        defaultValue: type === "checkbox"
          ? (element.is("[checked]") ? "true" : "false")
          : (element.attr("value") ?? ""),
      });
      return;
    }

    if (tag === "textarea") {
      fields.push({
        type: "textarea",
        name,
        label: getFieldLabel($, form, element, name),
        required: element.is("[required]"),
        placeholder: element.attr("placeholder") || "",
        defaultValue: element.text() || "",
      });
      return;
    }

    if (tag === "select") {
      const options = getSelectOptions($, element);
      fields.push({
        type: "select",
        name,
        label: getFieldLabel($, form, element, name),
        required: element.is("[required]"),
        defaultValue: getDefaultSelectValue(options),
        options,
      });
    }
  });

  for (const field of fields) {
    if (field.type !== "radio") continue;
    if (!field.defaultValue) field.defaultValue = field.options[0]?.value ?? "";
    for (const option of field.options) {
      option.selected = option.value === field.defaultValue;
    }
  }

  return {
    outputExtension,
    fields,
    outputTemplate: outputNode.html() || "",
  };
}

export function renderTemplateContent(html, values = {}) {
  const parsed = parseFormTemplate(html);
  const submitted = values && typeof values === "object" ? values : {};
  const withRawValues = parsed.outputTemplate.replace(/{{{\s*([A-Za-z0-9_.-]+)\s*}}}/g, (_, name) => {
    const field = parsed.fields.find((candidate) => candidate.name === name);
    const fallback = field?.defaultValue ?? "";
    const value = Object.prototype.hasOwnProperty.call(submitted, name) ? submitted[name] : fallback;
    return String(value ?? "");
  });
  const rendered = withRawValues.replace(/{{\s*([A-Za-z0-9_.-]+)\s*}}/g, (_, name) => {
    const field = parsed.fields.find((candidate) => candidate.name === name);
    const fallback = field?.defaultValue ?? "";
    const value = Object.prototype.hasOwnProperty.call(submitted, name) ? submitted[name] : fallback;
    return escapeHtml(value);
  });

  return {
    content: rendered,
    outputExtension: parsed.outputExtension,
    fields: parsed.fields,
  };
}

