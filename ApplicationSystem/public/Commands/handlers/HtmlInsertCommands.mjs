// Nodevision/ApplicationSystem/public/Commands/handlers/HtmlInsertCommands.mjs
// This command handler module routes shared HTML form insertion commands to the active graphical HTML editor form tools.

const FORM_COMMAND_PREFIX = "editor.insert.form.";
const FORM_KIND_BY_COMMAND = Object.freeze({
  button: "button",
  text: "text",
  number: "number",
  email: "email",
  password: "password",
  search: "search",
  telephone: "tel",
  url: "url",
  date: "date",
  time: "time",
  "date-time": "datetime-local",
  checkbox: "checkbox",
  radio: "radio",
  range: "range",
  color: "color",
  file: "file",
  "text-area": "textarea",
  select: "select",
  label: "label",
  fieldset: "fieldset",
  form: "form",
});

export async function insertHtmlFormElementCommand(args = [], context = {}) {
  const commandKind = String(context.commandId || "").slice(FORM_COMMAND_PREFIX.length);
  const kind = FORM_KIND_BY_COMMAND[commandKind];
  if (!kind) throw new Error("Unsupported HTML form insert command: " + (context.commandId || ""));
  const mod = await import("/ToolbarCallbacks/insert/formElementInsertTools.mjs");
  return mod.insertFormElement(kind);
}
