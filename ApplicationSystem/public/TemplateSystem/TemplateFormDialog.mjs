// Nodevision/ApplicationSystem/public/TemplateSystem/TemplateFormDialog.mjs
// Declarative renderer for .template.html form fields.

import { ensureTemplateSystemStyles } from "./TemplatePicker.mjs";

function getTemplateFormModule(template) {
  const html = String(template?.content || "");
  if (!html) return "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const node = doc.querySelector("[data-nodevision-template-form-module]");
    return node?.getAttribute("data-nodevision-template-form-module") || "";
  } catch (err) {
    console.warn("[templates] Could not inspect template form module.", err);
    return "";
  }
}

async function loadTemplateEnhancer(template) {
  const modulePath = getTemplateFormModule(template);
  if (!modulePath) return null;
  const mod = await import(modulePath);
  if (typeof mod.enhanceTemplateForm !== "function") {
    throw new Error("Template form module " + modulePath + " does not export enhanceTemplateForm().");
  }
  return mod.enhanceTemplateForm;
}

function defaultFieldValue(field) {
  if (field.type === "checkbox") return field.defaultValue === "true" ? "true" : "false";
  return field.defaultValue ?? "";
}

function createFieldControl(field, values) {
  const wrapper = document.createElement("div");
  wrapper.className = "nodevision-template-field";

  const labelText = field.label || field.name;
  const id = `nv-template-field-${field.name}-${Math.random().toString(36).slice(2, 7)}`;

  if (field.type === "textarea") {
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = labelText;
    const textarea = document.createElement("textarea");
    textarea.id = id;
    textarea.name = field.name;
    textarea.placeholder = field.placeholder || "";
    textarea.value = defaultFieldValue(field);
    textarea.required = Boolean(field.required);
    textarea.addEventListener("input", () => {
      values[field.name] = textarea.value;
    });
    values[field.name] = textarea.value;
    wrapper.append(label, textarea);
    return wrapper;
  }

  if (field.type === "select") {
    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = labelText;
    const select = document.createElement("select");
    select.id = id;
    select.name = field.name;
    select.required = Boolean(field.required);
    for (const optionInfo of field.options || []) {
      const option = document.createElement("option");
      option.value = optionInfo.value ?? "";
      option.textContent = optionInfo.label || optionInfo.value || "";
      option.selected = optionInfo.selected || option.value === field.defaultValue;
      select.appendChild(option);
    }
    values[field.name] = select.value || defaultFieldValue(field);
    select.addEventListener("change", () => {
      values[field.name] = select.value;
    });
    wrapper.append(label, select);
    return wrapper;
  }

  if (field.type === "radio") {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "nodevision-template-radio-group";
    const legend = document.createElement("legend");
    legend.textContent = labelText;
    fieldset.appendChild(legend);

    const options = field.options || [];
    values[field.name] = field.defaultValue || options[0]?.value || "";
    for (const optionInfo of options) {
      const choice = document.createElement("label");
      choice.className = "nodevision-template-choice";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = field.name;
      input.value = optionInfo.value ?? "";
      input.checked = input.value === values[field.name];
      input.required = Boolean(field.required);
      input.addEventListener("change", () => {
        if (input.checked) values[field.name] = input.value;
      });
      choice.append(input, document.createTextNode(optionInfo.label || optionInfo.value || ""));
      fieldset.appendChild(choice);
    }
    wrapper.appendChild(fieldset);
    return wrapper;
  }

  if (field.type === "checkbox") {
    const choice = document.createElement("label");
    choice.className = "nodevision-template-choice";
    const input = document.createElement("input");
    input.id = id;
    input.type = "checkbox";
    input.name = field.name;
    input.checked = field.defaultValue === "true";
    values[field.name] = input.checked ? "true" : "false";
    input.addEventListener("change", () => {
      values[field.name] = input.checked ? "true" : "false";
    });
    choice.append(input, document.createTextNode(labelText));
    wrapper.appendChild(choice);
    return wrapper;
  }

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = labelText;
  const input = document.createElement("input");
  input.id = id;
  input.name = field.name;
  input.type = field.type || "text";
  input.placeholder = field.placeholder || "";
  input.value = defaultFieldValue(field);
  input.required = Boolean(field.required);
  input.addEventListener("input", () => {
    values[field.name] = input.value;
  });
  values[field.name] = input.value;
  wrapper.append(label, input);
  return wrapper;
}

export function showTemplateFormDialog(template, options = {}) {
  ensureTemplateSystemStyles();
  const fields = template?.form?.fields || [];

  return new Promise((resolve) => {
    const values = {};

    const overlay = document.createElement("div");
    overlay.className = "nodevision-template-overlay";

    const dialog = document.createElement("div");
    dialog.className = "nodevision-template-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");

    const title = document.createElement("h2");
    title.className = "nodevision-template-title";
    title.textContent = options.title || template.displayName || "Template";

    const description = document.createElement("p");
    description.className = "nodevision-template-description";
    description.textContent = options.description || "Fill in the template fields.";

    const form = document.createElement("form");
    form.className = "nodevision-template-form";

    let filenameInput = null;
    if (options.includeFilename) {
      const filenameField = document.createElement("div");
      filenameField.className = "nodevision-template-field";
      const label = document.createElement("label");
      label.htmlFor = "nv-template-destination-filename";
      label.textContent = "Destination filename";
      filenameInput = document.createElement("input");
      filenameInput.id = "nv-template-destination-filename";
      filenameInput.required = true;
      filenameInput.value = options.defaultFilename || "";
      filenameField.append(label, filenameInput);
      form.appendChild(filenameField);
    }

    for (const field of fields) {
      form.appendChild(createFieldControl(field, values));
    }

    let templateEnhancer = null;

    const error = document.createElement("div");
    error.className = "nodevision-template-error";
    form.appendChild(error);

    const actions = document.createElement("div");
    actions.className = "nodevision-template-actions";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.className = "primary";
    submitButton.textContent = options.confirmText || "Render";
    actions.append(cancelButton, submitButton);
    form.appendChild(actions);

    dialog.append(title, description, form);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    loadTemplateEnhancer(template)
      .then((enhanceTemplateForm) => {
        if (!enhanceTemplateForm) return;
        templateEnhancer = enhanceTemplateForm({
          template,
          options,
          form,
          values,
          fields,
          dialog,
          setError,
        }) || null;
      })
      .catch((err) => {
        console.error("[templates] Failed to load template form module:", err);
        setError(err?.message || String(err));
      });

    const cleanup = () => {
      document.removeEventListener("keydown", handleKeydown, true);
      overlay.remove();
    };
    const finish = (result) => {
      cleanup();
      resolve(result || null);
    };
    const setError = (message) => {
      error.textContent = message || "";
    };

    function handleKeydown(event) {
      if (event.key === "Escape") finish(null);
    }

    cancelButton.addEventListener("click", () => finish(null));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(null);
    });
    document.addEventListener("keydown", handleKeydown, true);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setError("");
      if (!form.reportValidity()) return;

      if (templateEnhancer?.beforeSubmit) {
        const ok = await templateEnhancer.beforeSubmit({ values, form, setError });
        if (ok === false) return;
      }

      const filename = filenameInput?.value?.trim() || "";
      if (options.includeFilename && !filename) {
        setError("Destination filename is required.");
        filenameInput?.focus();
        return;
      }

      finish({ values, filename });
    });

    requestAnimationFrame(() => (filenameInput || form.querySelector("input, textarea, select, button"))?.focus());
  });
}

