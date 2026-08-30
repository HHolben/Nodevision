// Nodevision/ApplicationSystem/Resources/ElectronicsComponentResourceResolver.mjs
// Normalizes and layers circuit component library documents without binding the registry to a single EDA format.

const COMPONENT_ARRAY_FIELDS = Object.freeze([
  "symbols",
  "pins",
  "footprints",
  "packages",
  "models",
  "spiceModels",
  "ibisModels",
  "models3d",
  "datasheets",
  "docs",
  "documentation",
  "alternateParts",
  "substitutes",
  "annotations",
  "materials",
]);

const REFERENCE_ARRAY_FIELDS = new Set([
  "symbols",
  "footprints",
  "packages",
  "models",
  "spiceModels",
  "ibisModels",
  "models3d",
  "datasheets",
  "docs",
  "documentation",
]);

const ARRAY_ALIASES = new Map([
  ["schematicSymbol", "symbols"],
  ["schematicSymbols", "symbols"],
  ["symbol", "symbols"],
  ["pinout", "pins"],
  ["footprint", "footprints"],
  ["package", "packages"],
  ["simulationModel", "models"],
  ["simulationModels", "models"],
  ["spiceModel", "spiceModels"],
  ["ibisModel", "ibisModels"],
  ["model3d", "models3d"],
  ["models3D", "models3d"],
  ["threeDModels", "models3d"],
  ["datasheet", "datasheets"],
  ["document", "docs"],
  ["documents", "docs"],
  ["documentationLinks", "documentation"],
  ["alternates", "alternateParts"],
  ["alternatePart", "alternateParts"],
  ["substituteParts", "substitutes"],
  ["substitute", "substitutes"],
  ["materialRefs", "materials"],
  ["materialReferences", "materials"],
]);

const FIELD_ALIASES = new Map([
  ["id", "componentId"],
  ["display", "displayName"],
  ["label", "displayName"],
  ["partNumber", "manufacturerPartNumber"],
  ["mpn", "manufacturerPartNumber"],
  ["family", "deviceFamily"],
  ["genericFamily", "deviceFamily"],
  ["genericComponent", "genericComponentId"],
  ["electricalProperties", "electrical"],
  ["lifecycleStatus", "status"],
]);

const METADATA_FIELDS = Object.freeze([
  "componentId",
  "displayName",
  "name",
  "category",
  "description",
  "manufacturer",
  "manufacturerPartNumber",
  "deviceFamily",
  "genericComponentId",
  "componentKind",
  "electrical",
  "lifecycle",
  "status",
  "properties",
  "tags",
]);

const FIELD_ID_PREFIX = Object.freeze({
  symbols: "symbol",
  pins: "pin",
  footprints: "footprint",
  packages: "package",
  models: "model",
  spiceModels: "model.spice",
  ibisModels: "model.ibis",
  models3d: "model.3d",
  datasheets: "datasheet",
  docs: "doc",
  documentation: "doc",
  alternateParts: "alternate",
  substitutes: "substitute",
  annotations: "annotation",
  materials: "material",
});

const ASSET_ADAPTERS = Object.freeze({
  ".kicad_sym": { field: "symbols", kind: "schematic-symbol", format: "kicad-symbol", idPrefix: "symbol.kicad" },
  ".lib": { field: "symbols", kind: "schematic-symbol", format: "kicad-legacy-symbol", idPrefix: "symbol.kicad" },
  ".kicad_mod": { field: "footprints", kind: "footprint", format: "kicad-footprint", idPrefix: "footprint.kicad" },
  ".mod": { field: "footprints", kind: "footprint", format: "kicad-legacy-footprint", idPrefix: "footprint.kicad" },
  ".cir": { field: "spiceModels", kind: "spice-model", format: "spice", idPrefix: "model.spice" },
  ".sp": { field: "spiceModels", kind: "spice-model", format: "spice", idPrefix: "model.spice" },
  ".spi": { field: "spiceModels", kind: "spice-model", format: "spice", idPrefix: "model.spice" },
  ".subckt": { field: "spiceModels", kind: "spice-model", format: "spice-subcircuit", idPrefix: "model.spice" },
  ".ibs": { field: "ibisModels", kind: "ibis-model", format: "ibis", idPrefix: "model.ibis" },
  ".pdf": { field: "datasheets", kind: "datasheet", format: "pdf", idPrefix: "datasheet" },
  ".step": { field: "models3d", kind: "3d-model", format: "step", idPrefix: "model.3d" },
  ".stp": { field: "models3d", kind: "3d-model", format: "step", idPrefix: "model.3d" },
  ".stl": { field: "models3d", kind: "3d-model", format: "stl", idPrefix: "model.3d" },
  ".obj": { field: "models3d", kind: "3d-model", format: "obj", idPrefix: "model.3d" },
  ".glb": { field: "models3d", kind: "3d-model", format: "glb", idPrefix: "model.3d" },
  ".gltf": { field: "models3d", kind: "3d-model", format: "gltf", idPrefix: "model.3d" },
});

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function compactString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeIdPart(value) {
  return compactString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "resource";
}

function lastSegment(value) {
  const parts = String(value || "").replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || "";
}

function stripKnownExtension(value) {
  return lastSegment(value)
    .replace(/\.nvcircuit-component\.json$/i, "")
    .replace(/\.component\.json$/i, "")
    .replace(/\.json$/i, "")
    .replace(/\.(kicad_sym|kicad_mod|subckt|step|stp|stl|obj|glb|gltf|cir|sp|spi|ibs|lib|mod|pdf)$/i, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extensionFromPath(value) {
  const name = lastSegment(value).toLowerCase();
  const match = name.match(/(\.kicad_sym|\.kicad_mod|\.subckt|\.step|\.stp|\.stl|\.obj|\.glb|\.gltf|\.cir|\.sp|\.spi|\.ibs|\.lib|\.mod|\.pdf|\.json)$/i);
  return match ? match[1].toLowerCase() : "";
}

function canonicalArrayField(field) {
  return ARRAY_ALIASES.get(field) || field;
}

function canonicalField(field) {
  return FIELD_ALIASES.get(field) || field;
}

function stableComponentId(record = {}, fallback = "") {
  const explicit = compactString(record.componentId || record.id || record.component || record.partId);
  if (explicit) return explicit;
  const manufacturer = compactString(record.manufacturer || "generic");
  const partNumber = compactString(record.manufacturerPartNumber || record.partNumber || record.mpn);
  if (partNumber) return `component.${normalizeIdPart(manufacturer)}.${normalizeIdPart(partNumber)}`;
  const name = compactString(record.displayName || record.name || record.label || fallback);
  return `component.local.${normalizeIdPart(name)}`;
}

function sourceStamp(source = {}, resource = {}) {
  return {
    sourceId: source.id || source.sourceId || resource.sourceId || "",
    sourceName: source.name || source.sourceName || resource.sourceName || "",
    sourceType: source.sourceType || resource.sourceType || "",
    priority: Number(source.priority ?? resource.priority ?? 0),
    path: source.path || source.sourcePath || resource.sourcePath || "",
    resourceId: resource.id || "",
    resourcePath: resource.path || "",
  };
}

function pushUniqueSource(target, source) {
  if (!source || !source.sourceId) return;
  const key = `${source.sourceId}|${source.resourcePath || ""}|${source.priority}`;
  if (!target.some((item) => `${item.sourceId}|${item.resourcePath || ""}|${item.priority}` === key)) target.push(source);
}

function ensureComponent(byId, componentId, record, source) {
  if (!byId.has(componentId)) {
    byId.set(componentId, {
      typeId: "electronics.component",
      kind: "electronics-component",
      componentId,
      id: componentId,
      logicalId: componentId,
      displayName: compactString(record.displayName || record.name || record.label || componentId),
      componentKind: compactString(record.componentKind || record.componentType || (record.manufacturerPartNumber || record.partNumber || record.mpn ? "specific" : "generic")),
      sources: [],
      provenance: { layers: [] },
      fieldProvenance: {},
      diagnostics: [],
      suppressedSubresources: [],
    });
  }
  const component = byId.get(componentId);
  const stamp = sourceStamp(source, source.resource || {});
  pushUniqueSource(component.sources, stamp);
  pushUniqueSource(component.provenance.layers, stamp);
  return component;
}

function addDiagnostic(component, code, message, source, extra = {}) {
  component.diagnostics.push({
    level: extra.level || "warning",
    code,
    message,
    componentId: component.componentId,
    sourceId: source?.id || source?.sourceId || "",
    path: source?.resource?.path || source?.path || "",
    ...extra,
  });
}

function noteFieldProvenance(component, field, source) {
  if (!component.fieldProvenance[field]) component.fieldProvenance[field] = [];
  pushUniqueSource(component.fieldProvenance[field], sourceStamp(source, source.resource || {}));
}

function mergeObjects(base = {}, overlay = {}, mode = "override") {
  const result = { ...(base || {}) };
  for (const [key, value] of Object.entries(overlay || {})) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object" && !Array.isArray(result[key])) {
      result[key] = mergeObjects(result[key], value, mode);
    } else if (mode === "override" || result[key] === undefined || result[key] === null || result[key] === "") {
      result[key] = cloneJson(value);
    }
  }
  return result;
}

function normalizeComponentRecord(record = {}) {
  const normalized = { ...record };
  for (const [from, to] of FIELD_ALIASES.entries()) {
    if (normalized[to] === undefined && normalized[from] !== undefined) normalized[to] = normalized[from];
  }
  if (!normalized.componentKind && !normalized.operation && !normalized.op) {
    normalized.componentKind = normalized.manufacturerPartNumber || normalized.partNumber || normalized.mpn ? "specific" : "generic";
  }
  return normalized;
}

function singularKey(field) {
  return String(field || "").replace(/s$/i, "");
}

function normalizeSubresourceItem(item, field, fallbackIndex = 0) {
  if (typeof item === "string") {
    const base = stripKnownExtension(item) || item;
    return { id: `${FIELD_ID_PREFIX[field] || singularKey(field)}.${normalizeIdPart(base)}`, name: base, path: item };
  }
  const value = cloneJson(item || {});
  const explicit = compactString(value.id || value[`${singularKey(field)}Id`] || value.resourceId || value.modelId || value.partId || value.name || value.label || value.path || value.href || value.file || value.src || `${field}-${fallbackIndex + 1}`);
  value.id = compactString(value.id) || explicit;
  if (!value.name && value.label) value.name = value.label;
  value.kind = value.kind || singularKey(field);
  value.sources = Array.isArray(value.sources) ? value.sources : [];
  value.provenance = value.provenance && typeof value.provenance === "object" ? value.provenance : { layers: [] };
  return value;
}

function arrayValues(record = {}) {
  const out = new Map();
  for (const field of COMPONENT_ARRAY_FIELDS) {
    if (record[field] !== undefined) out.set(field, record[field]);
  }
  for (const [alias, field] of ARRAY_ALIASES.entries()) {
    if (record[alias] === undefined) continue;
    const previous = out.get(field);
    const next = Array.isArray(previous) ? previous.slice() : previous === undefined ? [] : [previous];
    const incoming = Array.isArray(record[alias]) ? record[alias] : [record[alias]];
    out.set(field, next.concat(incoming));
  }
  return out;
}

function normalizeArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function mergeSubresources(component, field, values, source) {
  if (!Array.isArray(component[field])) component[field] = [];
  const existingById = new Map(component[field].map((item, index) => [compactString(item.id) || `${field}-${index}`, item]));
  normalizeArray(values).forEach((rawItem, index) => {
    const item = normalizeSubresourceItem(rawItem, field, index);
    const id = compactString(item.id) || `${FIELD_ID_PREFIX[field] || field}.${index + 1}`;
    const stamp = sourceStamp(source, source.resource || {});
    pushUniqueSource(item.sources, stamp);
    if (!item.provenance || typeof item.provenance !== "object") item.provenance = { layers: [] };
    if (!Array.isArray(item.provenance.layers)) item.provenance.layers = [];
    pushUniqueSource(item.provenance.layers, stamp);
    const existing = existingById.get(id);
    if (existing) {
      addDiagnostic(component, "duplicate-subresource-id", `Duplicate ${field} subresource ${id} was deterministically merged by source priority.`, source, { field, resourceId: id });
      const merged = mergeObjects(existing, item, "override");
      merged.sources = Array.isArray(existing.sources) ? existing.sources.slice() : [];
      for (const itemSource of item.sources || []) pushUniqueSource(merged.sources, itemSource);
      merged.provenance = { layers: Array.isArray(existing.provenance?.layers) ? existing.provenance.layers.slice() : [] };
      for (const itemSource of item.provenance?.layers || []) pushUniqueSource(merged.provenance.layers, itemSource);
      const existingIndex = component[field].findIndex((entry) => entry.id === id);
      if (existingIndex >= 0) component[field][existingIndex] = merged;
      existingById.set(id, merged);
      return;
    }
    component[field].push(item);
    existingById.set(id, item);
  });
  noteFieldProvenance(component, field, source);
}

function assignMetadata(component, record, source, mode) {
  for (const rawField of METADATA_FIELDS) {
    const field = canonicalField(rawField);
    if (field === "componentId") continue;
    if (record[field] === undefined) continue;
    const value = record[field];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      component[field] = mergeObjects(component[field] || {}, value, mode);
    } else if (mode === "override" || component[field] === undefined || component[field] === null || component[field] === "") {
      component[field] = cloneJson(value);
    }
    if (field === "name" && !component.displayName && value) component.displayName = compactString(value);
    if (field === "displayName" && value) component.displayName = compactString(value);
    noteFieldProvenance(component, field, source);
  }
}

function mergeComponentRecord(component, rawRecord, source, mode = "add") {
  const record = normalizeComponentRecord(rawRecord);
  assignMetadata(component, record, source, mode === "override" ? "override" : "fill");
  for (const [field, values] of arrayValues(record).entries()) mergeSubresources(component, field, values, source);
  if (!component.displayName) component.displayName = compactString(record.displayName || record.name || component.componentId);
}

function operationFor(record = {}) {
  const value = compactString(record.operation || record.op || "add").toLowerCase();
  if (["override-metadata", "metadata-override", "replace-metadata", "patch"].includes(value)) return "override";
  if (["add-component", "append", "augment"].includes(value)) return "add";
  if (["note", "annotation"].includes(value)) return "annotate";
  if (["hide", "remove", "suppress-component"].includes(value)) return "suppress";
  return value;
}

function suppressTarget(record = {}) {
  const target = record.target && typeof record.target === "object" ? record.target : {};
  const field = canonicalArrayField(compactString(record.field || record.collection || record.targetField || target.field || target.collection));
  const subresourceId = compactString(record.subresourceId || record.resourceId || record.targetId || target.id || target.resourceId || target.subresourceId);
  return { field, subresourceId };
}

function applySuppress(component, record, source) {
  const { field, subresourceId } = suppressTarget(record);
  if (!subresourceId) {
    component.suppressed = true;
    addDiagnostic(component, "component-suppressed", "Component was suppressed by a higher-priority layer.", source, { level: "info" });
    return;
  }
  component.suppressedSubresources.push({ field: field || "*", id: subresourceId, source: sourceStamp(source, source.resource || {}) });
  addDiagnostic(component, "subresource-suppressed", `Subresource ${subresourceId} was suppressed.`, source, { level: "info", field: field || "*", resourceId: subresourceId });
}

function applyAnnotate(component, record, source) {
  const annotation = record.annotation || record.note || record.notes || null;
  if (annotation !== null && annotation !== undefined) mergeSubresources(component, "annotations", [typeof annotation === "string" ? { note: annotation } : annotation], source);
  for (const field of ["datasheets", "docs", "documentation", "annotations"]) {
    if (record[field] !== undefined) mergeSubresources(component, field, record[field], source);
  }
  assignMetadata(component, normalizeComponentRecord(record), source, "override");
}

function entryRecords(document = {}) {
  if (Array.isArray(document)) return document;
  const records = [];
  if (document.component && typeof document.component === "object") records.push(document.component);
  if (Array.isArray(document.components)) records.push(...document.components);
  if (Array.isArray(document.operations)) records.push(...document.operations);
  if (records.length) return records;
  if (document.componentId || document.id || document.manufacturerPartNumber || document.mpn) return [document];
  return [];
}

function isUnsafeLocalReference(value) {
  const text = String(value || "").replace(/\\/g, "/").trim();
  if (!text || /^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return false;
  if (text.startsWith("/api/")) return false;
  if (text.startsWith("/") || /^[A-Za-z]:\//.test(text)) return true;
  return text.split("/").filter(Boolean).some((part) => part === "." || part === "..");
}

function scrubUnsafeReferences(component) {
  for (const field of COMPONENT_ARRAY_FIELDS) {
    if (!REFERENCE_ARRAY_FIELDS.has(field) || !Array.isArray(component[field])) continue;
    for (const item of component[field]) {
      for (const key of ["path", "file", "src", "href"]) {
        if (typeof item[key] !== "string") continue;
        if (key === "href" && item[key].trim().startsWith("/")) continue;
        if (!isUnsafeLocalReference(item[key])) continue;
        delete item[key];
        item.invalidReference = true;
      }
    }
  }
}

function finalizeComponent(component) {
  const suppressed = component.suppressedSubresources || [];
  for (const field of COMPONENT_ARRAY_FIELDS) {
    if (!Array.isArray(component[field])) continue;
    component[field] = component[field].filter((item) => {
      const id = compactString(item.id);
      return !suppressed.some((target) => target.id === id && (target.field === "*" || target.field === field));
    });
  }
  scrubUnsafeReferences(component);
  component.displayName = component.displayName || component.name || component.componentId;
  component.provenance = { layers: component.sources.slice() };
  return component;
}

function maxPriority(component) {
  return Math.max(0, ...(component.sources || []).map((source) => Number(source.priority || 0)));
}

export function resolveElectronicsComponentLayers(layers = []) {
  const sortedLayers = [...layers].sort((a, b) => Number(a.source?.priority ?? 0) - Number(b.source?.priority ?? 0) || String(a.source?.id || "").localeCompare(String(b.source?.id || "")) || String(a.resource?.path || "").localeCompare(String(b.resource?.path || "")));
  const byId = new Map();
  for (const layer of sortedLayers) {
    const records = entryRecords(layer.document || layer.entries || layer.components || []);
    records.forEach((rawRecord, index) => {
      if (!rawRecord || typeof rawRecord !== "object") return;
      const record = normalizeComponentRecord(rawRecord);
      const componentId = stableComponentId(record, `${layer.resource?.path || "component"}-${index}`);
      const source = { ...(layer.source || {}), resource: layer.resource || {} };
      const exists = byId.has(componentId);
      const component = ensureComponent(byId, componentId, record, source);
      if (exists) addDiagnostic(component, "duplicate-component-id", `Component ${componentId} received another layer and was merged deterministically.`, source, { level: "info" });
      const operation = operationFor(record);
      if (operation === "suppress") applySuppress(component, record, source);
      else if (operation === "override") mergeComponentRecord(component, record, source, "override");
      else if (operation === "annotate") applyAnnotate(component, record, source);
      else mergeComponentRecord(component, record, source, "add");
    });
  }
  return [...byId.values()]
    .filter((component) => !component.suppressed)
    .map(finalizeComponent)
    .sort((a, b) => maxPriority(b) - maxPriority(a) || a.displayName.localeCompare(b.displayName) || a.componentId.localeCompare(b.componentId));
}

export function componentDocumentFromAsset(resource = {}) {
  const extension = String(resource.extension || extensionFromPath(resource.path || resource.relativeFile || "")).toLowerCase();
  const adapter = ASSET_ADAPTERS[extension];
  if (!adapter) return null;
  const baseName = stripKnownExtension(resource.path || resource.relativeFile || resource.displayName || "component") || "component";
  const componentId = resource.componentId || `component.local.${normalizeIdPart(baseName)}`;
  const subresource = {
    id: `${adapter.idPrefix}.${normalizeIdPart(baseName)}`,
    kind: adapter.kind,
    name: resource.displayName || baseName,
    format: adapter.format,
    path: resource.path || resource.relativeFile || "",
    href: resource.url || "",
  };
  return {
    components: [{
      operation: "add",
      componentId,
      name: resource.displayName || baseName,
      componentKind: "generic",
      [adapter.field]: [subresource],
    }],
  };
}

function referenceValues(item) {
  if (typeof item === "string") return [item];
  if (!item || typeof item !== "object") return [];
  const values = [];
  for (const key of ["path", "href", "file", "src"]) {
    if (typeof item[key] !== "string") continue;
    const candidate = item[key].trim();
    if (key === "href" && (candidate.startsWith("/") || candidate.includes("://"))) continue;
    values.push(candidate);
  }
  if (Array.isArray(item.files)) {
    for (const entry of item.files) values.push(...referenceValues(entry));
  }
  return values;
}

export function collectElectronicsComponentReferencePaths(document = {}) {
  const refs = [];
  const records = entryRecords(document);
  records.forEach((rawRecord, recordIndex) => {
    const record = normalizeComponentRecord(rawRecord || {});
    const componentId = stableComponentId(record, `component-${recordIndex + 1}`);
    for (const [field, values] of arrayValues(record).entries()) {
      if (!REFERENCE_ARRAY_FIELDS.has(field)) continue;
      normalizeArray(values).forEach((rawItem, itemIndex) => {
        const item = normalizeSubresourceItem(rawItem, field, itemIndex);
        for (const refPath of referenceValues(rawItem)) {
          refs.push({ componentId, field, resourceId: item.id, path: refPath });
        }
      });
    }
  });
  return refs;
}
