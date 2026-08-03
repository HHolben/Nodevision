// Nodevision/ApplicationSystem/public/panels/toolbarConditions.mjs
// This module evaluates declarative toolbar visibility and disabled-state conditions against the current Nodevision editor attention context and user settings.

import { readEditorAttentionSettings } from "../EditorAttentionState.mjs";

function list(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
}

function normalizeMode(value) {
  return typeof value === "string" ? value.trim() : value;
}

function matchesOne(actual, expected) {
  const expectedValues = list(expected).map(normalizeMode);
  if (!expectedValues.length) return true;
  return expectedValues.includes(actual);
}

function resolveContextValue(key, context) {
  const attention = context.attentionSnapshot || {};
  const state = context.state || {};
  switch (key) {
    case "fileFamily": return attention.fileFamily || state.fileFamily;
    case "editorMode": return attention.editorMode || state.editorMode || state.currentMode;
    case "mode": return state.currentMode || attention.editorMode;
    case "activeTool": return attention.activeTool || state.activeTool;
    case "selectedObjectType": return attention.selectedObjectType || state.selectedObjectType;
    case "selectedObjectTypes": return attention.selectedObjectType || state.selectedObjectType;
    case "hasSelection": return Boolean(attention.hasSelection || state.hasSelection || state.hasEditableSelection);
    case "hasEditableSelection": return Boolean(attention.hasEditableSelection || state.hasEditableSelection);
    default:
      if (Object.prototype.hasOwnProperty.call(attention, key)) return attention[key];
      return state[key];
  }
}

function conditionPasses(key, expected, context) {
  const actual = resolveContextValue(key, context);
  if (key === "hasSelection" || key === "hasEditableSelection") {
    return Boolean(actual) === Boolean(expected);
  }
  if (key === "selectedObjectTypes") {
    return matchesOne(actual, expected);
  }
  return matchesOne(actual, expected);
}

export function matchesToolbarPredicate(predicate, context = {}) {
  if (!predicate || typeof predicate !== "object") return true;
  if (Array.isArray(predicate.anyOf)) {
    return predicate.anyOf.some(entry => matchesToolbarPredicate(entry, context));
  }
  if (Array.isArray(predicate.allOf)) {
    return predicate.allOf.every(entry => matchesToolbarPredicate(entry, context));
  }
  if (Array.isArray(predicate.noneOf)) {
    return !predicate.noneOf.some(entry => matchesToolbarPredicate(entry, context));
  }
  for (const [key, expected] of Object.entries(predicate)) {
    if (key === "anyOf" || key === "allOf" || key === "noneOf") continue;
    if (!conditionPasses(key, expected, context)) return false;
  }
  return true;
}

function conditionValueMatches(actual, expected, key = "") {
  if (key === "requiresFile") return expected === false ? !actual : Boolean(actual);
  if (typeof expected === "boolean") return Boolean(actual) === expected;
  if (Array.isArray(expected)) return expected.includes(actual);
  return actual === expected;
}

function evaluateLegacyConditions(item, context) {
  if (!item) return true;
  const state = context.state || {};
  const mode = state.currentMode;
  if (item.mode && item.mode !== mode) return false;
  if (item.modes) {
    const modes = Array.isArray(item.modes) ? item.modes : [item.modes];
    if (modes.length && !modes.includes(mode)) return false;
  }
  if (!item.conditions) return true;

  const resolvers = context.conditionResolvers || {};
  if (Array.isArray(item.conditions)) {
    for (const condition of item.conditions) {
      if (typeof condition === "string") {
        const resolver = resolvers[condition];
        if (typeof resolver === "function") {
          if (!resolver(context)) return false;
        } else if (!state[condition]) {
          return false;
        }
      } else if (condition && typeof condition === "object" && !matchesToolbarPredicate(condition, context)) {
        return false;
      }
    }
    return true;
  }

  if (item.conditions && typeof item.conditions === "object") {
    for (const [key, expected] of Object.entries(item.conditions)) {
      const resolver = resolvers[key];
      const actual = typeof resolver === "function" ? resolver(context) : resolveContextValue(key, context);
      if (!conditionValueMatches(actual, expected, key)) return false;
    }
  }

  return true;
}

export function evaluateToolbarItemState(item = {}, context = {}) {
  const settings = context.settings || readEditorAttentionSettings();
  const contextualVisibilityEnabled = settings.editorAttentionContextualToolVisibility === true;
  const legacyVisible = evaluateLegacyConditions(item, context);
  if (!legacyVisible && item.disableWhenConditionsFail !== true) {
    return { visible: false, enabled: false, disabledReason: item.disabledReason || "" };
  }
  let visible = legacyVisible;
  let enabled = legacyVisible;
  let disabledReason = legacyVisible ? "" : (item.disabledReason || "Unavailable in the current context.");

  if (contextualVisibilityEnabled && item.visibleWhen && !matchesToolbarPredicate(item.visibleWhen, context)) {
    return { visible: false, enabled: false, disabledReason: item.hiddenReason || item.disabledReason || "" };
  }
  if (contextualVisibilityEnabled && item.enabledWhen && !matchesToolbarPredicate(item.enabledWhen, context)) {
    visible = true;
    enabled = false;
    disabledReason = item.disabledReason || "Unavailable until the required selection is active.";
  }
  if (contextualVisibilityEnabled && item.disabledWhen && matchesToolbarPredicate(item.disabledWhen, context)) {
    visible = true;
    enabled = false;
    disabledReason = item.disabledReason || "Unavailable in the current context.";
  }

  return { visible, enabled, disabledReason };
}
