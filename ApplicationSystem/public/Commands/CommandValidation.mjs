// Nodevision/ApplicationSystem/public/Commands/CommandValidation.mjs
// This module validates simple shared Nodevision command argument metadata before handlers run.

import { normalizeNotebookRelativePath } from "../utils/notebookPath.mjs";
import { COMMAND_ERROR_CODES, commandError } from "./CommandErrors.mjs";

function normalizeArgumentSpec(spec, index) {
  if (typeof spec === "string") return { name: spec, type: "any", required: false, index };
  return { type: "any", required: false, index, ...(spec || {}) };
}

function invalid(commandId, spec, message) {
  return commandError(COMMAND_ERROR_CODES.INVALID_ARGUMENT, `${commandId}: ${message}`, {
    commandId,
    argument: spec?.name || `arg${spec?.index ?? ""}`,
  });
}

function validateNotebookPath(value, commandId, spec) {
  const raw = String(value ?? "").trim();
  if (!raw) throw invalid(commandId, spec, `${spec.name} must be a Notebook-relative path.`);
  const slashPath = raw.replace(/\\/g, "/");
  if (raw.includes("\0") || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) || slashPath.startsWith("//")) {
    throw invalid(commandId, spec, `${spec.name} must not be absolute or URL-like.`);
  }
  if (slashPath.startsWith("/") && !slashPath.toLowerCase().startsWith("/notebook/")) {
    throw invalid(commandId, spec, `${spec.name} must be Notebook-relative.`);
  }
  const segments = slashPath.split("/").filter(Boolean);
  if (segments.includes("..")) throw invalid(commandId, spec, `${spec.name} may not contain .. traversal.`);
  return normalizeNotebookRelativePath(raw);
}

function validateOne(value, commandId, spec) {
  if (value === undefined || value === null || value === "") {
    if (spec.required) throw invalid(commandId, spec, `${spec.name} is required.`);
    return spec.default ?? value;
  }
  if (spec.type === "string") return String(value);
  if (spec.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw invalid(commandId, spec, `${spec.name} must be a number.`);
    return number;
  }
  if (spec.type === "boolean") return value === true || value === "true";
  if (spec.type === "notebookPath") return validateNotebookPath(value, commandId, spec);
  if (spec.type === "enum") {
    const text = String(value);
    if (!Array.isArray(spec.values) || !spec.values.includes(text)) {
      throw invalid(commandId, spec, `${spec.name} must be one of: ${(spec.values || []).join(", ")}.`);
    }
    return text;
  }
  return value;
}

export function normalizeCommandArguments(args = [], definition = {}) {
  const specs = (definition.arguments || []).map(normalizeArgumentSpec);
  const required = specs.filter((spec) => spec.required).length;
  if ((args || []).length < required) {
    throw commandError(COMMAND_ERROR_CODES.INVALID_ARGUMENT, `${definition.id}: expected at least ${required} argument(s).`, {
      commandId: definition.id,
    });
  }
  return specs.map((spec, index) => validateOne((args || [])[index], definition.id, spec));
}

export function argumentNames(definition = {}) {
  return (definition.arguments || []).map((spec, index) => normalizeArgumentSpec(spec, index).name || `arg${index + 1}`);
}
