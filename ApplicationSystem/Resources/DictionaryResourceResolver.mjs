// Nodevision/ApplicationSystem/Resources/DictionaryResourceResolver.mjs
// Resolves layered dictionary entries without modifying lower-priority source data.

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeTerm(value) {
  const term = String(value || "").replace(/\s+/g, " ").trim();
  if (!term) throw new Error("Dictionary entry term is required.");
  return term;
}

function termKey(value) {
  return normalizeTerm(value).toLocaleLowerCase();
}

function normalizeOperation(value) {
  const op = String(value || "add").trim().toLowerCase();
  if (["add", "override-sense", "override-entry", "annotate", "suppress"].includes(op)) return op;
  throw new Error(`Unsupported dictionary operation: ${op}`);
}

function normalizeSenseId(value, fallback = "default") {
  const id = String(value || fallback || "default").trim();
  return id || "default";
}

function normalizeSpelling(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out = {};
  if (typeof value.accepted === "boolean") out.accepted = value.accepted;
  if (typeof value.preferred === "boolean") out.preferred = value.preferred;
  if (typeof value.caseSensitive === "boolean") out.caseSensitive = value.caseSensitive;
  if (Array.isArray(value.tags)) out.tags = value.tags.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof value.notes === "string" && value.notes.trim()) out.notes = value.notes.trim();
  return Object.keys(out).length ? out : undefined;
}

function provenance(source) {
  if (!source || typeof source !== "object") return { sourceId: "unknown", sourceName: "Unknown source" };
  return {
    sourceId: String(source.id || source.sourceId || "unknown"),
    sourceName: String(source.name || source.sourceName || source.id || source.sourceId || "Unknown source"),
    sourceType: source.sourceType || undefined,
    priority: Number.isFinite(Number(source.priority)) ? Number(source.priority) : undefined,
  };
}

function publicSource(source) {
  return provenance(source);
}

function mergeObject(base = {}, overlay = {}) {
  const next = { ...base };
  for (const [key, value] of Object.entries(overlay || {})) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
      next[key] = mergeObject(base[key], value);
    } else {
      next[key] = cloneJson(value);
    }
  }
  return next;
}

function normalizeSenses(record) {
  const candidates = [];
  if (Array.isArray(record?.senses)) candidates.push(...record.senses);
  if (record?.sense && typeof record.sense === "object") candidates.push(record.sense);
  if (typeof record?.definition === "string" || typeof record?.partOfSpeech === "string") {
    candidates.push({
      senseId: record.senseId || record.id || "default",
      definition: record.definition,
      partOfSpeech: record.partOfSpeech,
      examples: record.examples,
      tags: record.tags,
      spelling: record.senseSpelling,
    });
  }
  return candidates.map((sense, index) => ({
    ...cloneJson(sense || {}),
    senseId: normalizeSenseId(sense?.senseId || sense?.id, index === 0 ? "default" : `sense-${index + 1}`),
    annotations: Array.isArray(sense?.annotations) ? cloneJson(sense.annotations) : [],
    spelling: normalizeSpelling(sense?.spelling) || undefined,
    sources: [],
    suppressed: false,
  }));
}

function ensureEntry(state, term, source) {
  const key = termKey(term);
  let entry = state.get(key);
  if (!entry) {
    entry = {
      term: normalizeTerm(term),
      entryId: key,
      spelling: undefined,
      senses: [],
      annotations: [],
      sources: [],
      suppressed: false,
      suppressedBy: null,
      overrideHistory: [],
    };
    state.set(key, entry);
  }
  if (source) {
    const src = publicSource(source);
    if (!entry.sources.some((item) => item.sourceId === src.sourceId)) entry.sources.push(src);
  }
  return entry;
}

function findSense(entry, senseId) {
  return entry.senses.find((sense) => sense.senseId === senseId);
}

function applyAdd(state, record, source) {
  const entry = ensureEntry(state, record.term, source);
  entry.suppressed = false;
  entry.suppressedBy = null;
  if (record.entryId) entry.entryId = String(record.entryId);
  if (record.spelling) entry.spelling = mergeObject(entry.spelling || {}, normalizeSpelling(record.spelling) || {});
  if (Array.isArray(record.annotations)) entry.annotations.push(...cloneJson(record.annotations));

  const senses = normalizeSenses(record);
  for (const sense of senses) {
    const existing = findSense(entry, sense.senseId);
    const nextSense = {
      ...sense,
      sources: [publicSource(source)],
      source: publicSource(source),
      spelling: sense.spelling || undefined,
    };
    if (existing) {
      Object.assign(existing, mergeObject(existing, nextSense));
      existing.suppressed = false;
      existing.sources = [...(existing.sources || []), publicSource(source)];
    } else {
      entry.senses.push(nextSense);
    }
  }

  if (!entry.senses.length && record.term) {
    entry.senses.push({
      senseId: "default",
      definition: "",
      annotations: [],
      sources: [publicSource(source)],
      source: publicSource(source),
      suppressed: false,
    });
  }
}

function applyOverrideSense(state, record, source) {
  const entry = ensureEntry(state, record.term, source);
  const senseId = normalizeSenseId(record.senseId || record.targetSenseId || record.target?.senseId);
  let sense = findSense(entry, senseId);
  if (!sense) {
    sense = { senseId, annotations: [], sources: [], suppressed: false };
    entry.senses.push(sense);
  }
  const patch = { ...cloneJson(record) };
  delete patch.operation;
  delete patch.op;
  delete patch.term;
  delete patch.target;
  delete patch.targetSenseId;
  if (patch.spelling) patch.spelling = normalizeSpelling(patch.spelling);
  Object.assign(sense, mergeObject(sense, patch));
  sense.senseId = senseId;
  sense.suppressed = false;
  sense.modifiedBy = publicSource(source);
  sense.sources = [...(sense.sources || []), publicSource(source)];
}

function applyOverrideEntry(state, record, source) {
  const entry = ensureEntry(state, record.term, source);
  entry.overrideHistory.push({ source: publicSource(source), previousSenses: cloneJson(entry.senses) });
  entry.senses = [];
  entry.suppressed = false;
  entry.suppressedBy = null;
  if (record.spelling) entry.spelling = mergeObject(entry.spelling || {}, normalizeSpelling(record.spelling) || {});
  const senses = normalizeSenses(record);
  for (const sense of senses) {
    entry.senses.push({ ...sense, source: publicSource(source), sources: [publicSource(source)], suppressed: false });
  }
  if (!entry.senses.length) {
    entry.senses.push({ senseId: "default", definition: "", annotations: [], source: publicSource(source), sources: [publicSource(source)], suppressed: false });
  }
  entry.modifiedBy = publicSource(source);
}

function applyAnnotate(state, record, source) {
  const entry = ensureEntry(state, record.term, source);
  const annotation = {
    note: record.note || record.annotation || undefined,
    tags: Array.isArray(record.tags) ? cloneJson(record.tags) : undefined,
    links: Array.isArray(record.links) ? cloneJson(record.links) : undefined,
    source: publicSource(source),
  };
  const senseId = record.senseId || record.targetSenseId || record.target?.senseId;
  if (senseId) {
    let sense = findSense(entry, normalizeSenseId(senseId));
    if (!sense) {
      sense = { senseId: normalizeSenseId(senseId), annotations: [], sources: [], suppressed: false };
      entry.senses.push(sense);
    }
    sense.annotations = [...(sense.annotations || []), annotation];
  } else {
    entry.annotations.push(annotation);
  }
}

function applySuppress(state, record, source) {
  const entry = ensureEntry(state, record.term, source);
  const senseId = record.senseId || record.targetSenseId || record.target?.senseId;
  if (senseId) {
    const sense = findSense(entry, normalizeSenseId(senseId));
    if (sense) {
      sense.suppressed = true;
      sense.suppressedBy = publicSource(source);
    }
    return;
  }
  entry.suppressed = true;
  entry.suppressedBy = publicSource(source);
}

function normalizeDictionaryRecords(document = {}) {
  if (Array.isArray(document)) return document;
  if (Array.isArray(document?.operations)) return document.operations;
  if (Array.isArray(document?.entries)) return document.entries;
  if (document && typeof document === "object" && document.term) return [document];
  return [];
}

export function resolveDictionaryLayers(layers = []) {
  const state = new Map();
  const orderedLayers = [...(layers || [])].sort((a, b) => Number(a?.source?.priority || 0) - Number(b?.source?.priority || 0));

  for (const layer of orderedLayers) {
    if (layer?.enabled === false || layer?.source?.enabled === false) continue;
    const source = provenance(layer?.source || {});
    for (const rawRecord of normalizeDictionaryRecords(layer?.document || layer?.entries || layer)) {
      const record = cloneJson(rawRecord || {});
      const operation = normalizeOperation(record.operation || record.op || (record.overrideEntry ? "override-entry" : "add"));
      if (operation === "add") applyAdd(state, record, source);
      if (operation === "override-sense") applyOverrideSense(state, record, source);
      if (operation === "override-entry") applyOverrideEntry(state, record, source);
      if (operation === "annotate") applyAnnotate(state, record, source);
      if (operation === "suppress") applySuppress(state, record, source);
    }
  }

  return [...state.values()]
    .map((entry) => ({
      ...entry,
      senses: (entry.senses || []).filter((sense) => !sense.suppressed),
    }))
    .filter((entry) => !entry.suppressed && entry.senses.length > 0)
    .sort((a, b) => a.term.localeCompare(b.term));
}

export function parseDictionaryText(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((term) => ({ operation: "add", term, spelling: { accepted: true }, senses: [{ senseId: "spelling", definition: "" }] }));
}
