// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/htmlScriptAssociations.mjs
// This module locates and edits ordinary JavaScript event-handler functions connected to HTML elements through standard document.getElementById event listeners.

import { findFunctionSource, parseFunctionName } from "./HtmlFunctionParser.mjs";
import { buildHandlerScript, defaultEventForElement, generatedFunctionNameForElement } from "./htmlFormEventTools.mjs";

function escapeRegExp(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addUniqueHost(hosts, seen, element, type) {
  if (!element || seen.has(element)) return;
  seen.add(element);
  hosts.push({ element, type });
}

function hiddenScriptHolder(root) {
  return root?.closest?.("#editor-root")?.querySelector?.("#hidden-elements") ||
    root?.parentElement?.querySelector?.("#hidden-elements") ||
    root?.ownerDocument?.getElementById?.("hidden-elements") ||
    null;
}

export function findScriptHosts(root) {
  const hosts = [];
  const seen = new Set();
  root?.querySelectorAll?.("script").forEach((script) => addUniqueHost(hosts, seen, script, "script"));
  Array.from(hiddenScriptHolder(root)?.children || []).forEach((holder) => {
    if (Object.prototype.hasOwnProperty.call(holder.dataset || {}, "script")) {
      addUniqueHost(hosts, seen, holder, "hidden");
    }
  });
  return hosts;
}

export function getHostScriptText(host) {
  if (!host?.element) return "";
  return host.type === "hidden" ? String(host.element.dataset.script || "") : String(host.element.textContent || "");
}

export function setHostScriptText(host, text) {
  if (!host?.element) return false;
  if (host.type === "hidden") host.element.dataset.script = String(text || "");
  else host.element.textContent = String(text || "");
  return true;
}

function listenerRegex(elementId) {
  const id = escapeRegExp(elementId);
  return new RegExp(
    "document\\s*\\.\\s*getElementById\\s*\\(\\s*(['\\\"])" + id + "\\1\\s*\\)\\s*(?:\\?\\.|\\.)\\s*addEventListener\\s*\\(\\s*(['\\\"])([^'\\\"]+)\\2\\s*,\\s*([A-Za-z_$][\\w$]*)",
    "g"
  );
}

function collectListenerMatches(scriptText, elementId) {
  const matches = [];
  const re = listenerRegex(elementId);
  let match = re.exec(String(scriptText || ""));
  while (match) {
    matches.push({ eventName: match[3], functionName: match[4] });
    match = re.exec(scriptText);
  }
  return matches;
}

export function collectFunctionNames(root) {
  const names = new Set();
  findScriptHosts(root).forEach((host) => {
    const script = getHostScriptText(host);
    const re = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
    let match = re.exec(script);
    while (match) {
      names.add(match[1]);
      match = re.exec(script);
    }
  });
  return Array.from(names);
}

export function findElementScriptAssociation(root, element) {
  const elementId = String(element?.id || "").trim();
  if (!root || !elementId) return null;
  for (const host of findScriptHosts(root)) {
    const scriptText = getHostScriptText(host);
    const listeners = collectListenerMatches(scriptText, elementId);
    for (const listener of listeners) {
      const functionRange = findFunctionSource(scriptText, listener.functionName);
      if (functionRange) {
        return {
          root,
          host,
          elementId,
          eventName: listener.eventName,
          functionName: listener.functionName,
          functionRange,
          functionSource: functionRange.source,
        };
      }
    }
  }
  return null;
}

function replaceMatchingListener(script, elementId, predicate, replaceMatch) {
  let replaced = false;
  return String(script || "").replace(listenerRegex(elementId), (full, idQuote, eventQuote, eventName, functionName) => {
    if (replaced || !predicate(eventName, functionName)) return full;
    replaced = true;
    return replaceMatch(full, eventQuote, eventName, functionName);
  });
}

function replaceListenerFunctionName(script, elementId, eventName, oldName, newName) {
  return replaceMatchingListener(script, elementId, (evt, fn) => evt === eventName && fn === oldName, (full, quote, evt, fn) => {
    return full.slice(0, full.lastIndexOf(fn)) + newName;
  });
}

function replaceListenerEventName(script, elementId, oldEvent, functionName, nextEvent) {
  return replaceMatchingListener(script, elementId, (evt, fn) => evt === oldEvent && fn === functionName, (full, quote, evt) => {
    return full.replace(quote + evt + quote, quote + nextEvent + quote);
  });
}

function normalizeFunctionSource(nextSource, fallbackName) {
  const source = String(nextSource || "").trim();
  if (parseFunctionName(source)) return source;
  return "function " + fallbackName + "(event) {\n" + String(nextSource || "") + "\n}";
}

export function replaceFunctionSource(association, nextSource) {
  if (!association?.host) return null;
  const script = getHostScriptText(association.host);
  const range = findFunctionSource(script, association.functionName);
  if (!range) return null;
  const replacement = normalizeFunctionSource(nextSource, association.functionName);
  const nextName = parseFunctionName(replacement) || association.functionName;
  let nextScript = script.slice(0, range.start) + replacement + script.slice(range.end);
  if (nextName !== association.functionName) {
    nextScript = replaceListenerFunctionName(nextScript, association.elementId, association.eventName, association.functionName, nextName);
  }
  setHostScriptText(association.host, nextScript);
  return findElementScriptAssociation(association.root, { id: association.elementId }) || {
    ...association,
    functionName: nextName,
    functionSource: replacement,
  };
}

export function updateAssociationEvent(association, nextEvent) {
  const eventName = String(nextEvent || "").trim();
  if (!association?.host || !eventName || eventName === association.eventName) return association || null;
  const script = getHostScriptText(association.host);
  const nextScript = replaceListenerEventName(script, association.elementId, association.eventName, association.functionName, eventName);
  setHostScriptText(association.host, nextScript);
  return findElementScriptAssociation(association.root, { id: association.elementId }) || { ...association, eventName };
}

export function createElementHandler(root, element, eventName = "") {
  if (!root || !element?.id || !root.contains?.(element)) return null;
  const selectedEvent = eventName || defaultEventForElement(element);
  if (!selectedEvent) return null;
  const existingNames = collectFunctionNames(root);
  const functionName = generatedFunctionNameForElement(element, selectedEvent, existingNames);
  const script = root.ownerDocument.createElement("script");
  script.textContent = buildHandlerScript({ elementId: element.id, eventName: selectedEvent, functionName });
  const labelHost = element.closest?.("label");
  const insertionHost = labelHost && root.contains(labelHost) ? labelHost : element;
  insertionHost.after(script);
  return findElementScriptAssociation(root, element);
}
