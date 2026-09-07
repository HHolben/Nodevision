// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/WebResourceBrowserPanel.mjs
// Docked Web Resource Browser shell backed by the existing Resource Acquisition service.

import { acquireResource, listResourceProviders, RESOURCE_PROVIDER_IDS } from "/Resources/ResourceAcquisitionService.mjs";
import { loadResourceItems } from "/Resources/ResourceRegistryClient.mjs";
import {
  isInsertMediaInvocation,
  normalizeWebResourceBrowserInvocation,
  resourceReferenceToSourceValue,
  resourceTypeMatchesInvocation,
} from "/Resources/WebResourceBrowserContext.mjs";
import { scheduleWebResourceVisibilityDiagnostics } from "/Resources/WebResourceBrowserVisibilityDiagnostics.mjs";

const STYLE_ID = "nv-web-resource-browser-style";
const RESOURCE_TYPES = [
  { id: "image", label: "Image", accept: "image/*" },
  { id: "model", label: "3D Model", accept: ".3mf,.dae,.fbx,.glb,.gltf,.obj,.ply,.scad,.stl,.usd,.usda,.usdc,.usdz" },
  { id: "audio", label: "Audio", accept: "audio/*" },
  { id: "video", label: "Video", accept: "video/*" },
  { id: "font", label: "Font", accept: ".ttf,.otf,.woff,.woff2" },
];

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-web-resource-browser { box-sizing:border-box; display:flex; flex-direction:column; gap:10px; height:100%; min-height:0; padding:10px; color:#1f2832; font:13px Arial, sans-serif; background:#f8fafb; }
.nv-web-resource-browser h2 { margin:0; font-size:18px; }
.nv-web-resource-browser__context { display:grid; gap:3px; padding:8px; border:1px solid #d6dde5; border-radius:6px; background:#fff; color:#435160; }
.nv-web-resource-browser__grid { display:grid; gap:8px; }
.nv-web-resource-browser label { display:grid; gap:4px; font-weight:600; }
.nv-web-resource-browser input, .nv-web-resource-browser select { box-sizing:border-box; width:100%; min-height:30px; border:1px solid #aeb8c4; border-radius:5px; padding:6px 7px; font:12px ui-monospace, monospace; background:#fff; }
.nv-web-resource-browser button { border:1px solid #93a0ae; border-radius:5px; padding:7px 10px; background:#f7f9fb; cursor:pointer; font:12px Arial, sans-serif; }
.nv-web-resource-browser button[data-primary] { background:#243746; color:#fff; border-color:#243746; }
.nv-web-resource-browser button:disabled { opacity:.55; cursor:not-allowed; }
.nv-web-resource-browser__row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.nv-web-resource-browser__section { display:grid; gap:8px; padding:8px; border:1px solid #d6dde5; border-radius:6px; background:#fff; }
.nv-web-resource-browser__section-title { font-weight:700; color:#283642; }
.nv-web-resource-browser__results { min-height:74px; max-height:180px; overflow:auto; display:grid; gap:6px; }
.nv-web-resource-browser__result { text-align:left; display:grid; gap:2px; }
.nv-web-resource-browser__result[aria-selected="true"] { outline:2px solid #2f6fad; background:#eef6ff; }
.nv-web-resource-browser__preview { min-height:72px; max-height:190px; overflow:auto; white-space:pre-wrap; font:12px ui-monospace, monospace; color:#23303b; }
.nv-web-resource-browser__thumb { max-width:100%; max-height:130px; object-fit:contain; border:1px solid #d8dee4; background:#fff; }
.nv-web-resource-browser__status { min-height:18px; color:#30475e; font-weight:700; }
.nv-web-resource-browser__status[data-error="true"] { color:#b02a37; }
`;
  document.head.appendChild(style);
}

function make(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function option(value, label, selected = false) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  node.selected = selected;
  return node;
}

function resourceLabel(typeId) {
  return RESOURCE_TYPES.find((type) => type.id === typeId)?.label || typeId || "Resource";
}

function setStatus(root, text, error = false) {
  const status = root.querySelector("[data-status]");
  if (!status) return;
  status.textContent = String(text || "");
  status.dataset.error = String(Boolean(error));
}

function defaultDestination(type, name) {
  const clean = String(name || "resource").trim().replace(/[^A-Za-z0-9._-]+/g, "_") || "resource";
  if (type === "image") return `Notebook/Resources/Media/Images/${clean}`;
  if (type === "audio") return `Notebook/Resources/Media/Audio/${clean}`;
  if (type === "video") return `Notebook/Resources/Media/Video/${clean}`;
  if (type === "model") return `Notebook/Resources/Models/${clean}`;
  if (type === "font") return `Notebook/Resources/Fonts/${clean}`;
  return `Notebook/Resources/${clean}`;
}

function selectedProvider(root) {
  return root.querySelector("[data-field=provider]")?.value || RESOURCE_PROVIDER_IDS.DIRECT_URL;
}

function selectedType(root) {
  return root.querySelector("[data-field=resourceType]")?.value || "image";
}

function selectedMode(root) {
  return root.querySelector("[data-field=mode]")?.value || "reference";
}

async function refreshRegistry(root) {
  const picker = root.querySelector("[data-field=resourceId]");
  if (!picker || selectedProvider(root) !== RESOURCE_PROVIDER_IDS.REGISTRY) return;
  picker.replaceChildren(option("", "Loading installed resources..."));
  try {
    const items = await loadResourceItems(selectedType(root), { raw: true });
    picker.replaceChildren(option("", items.length ? "Choose installed resource" : "No installed resources"));
    for (const item of items) {
      const id = item.id || item.logicalId || item.path || "";
      const label = item.displayName || item.path || id;
      picker.append(option(id, label));
    }
  } catch (err) {
    picker.replaceChildren(option("", "Unable to load installed resources"));
    setStatus(root, err?.message || String(err), true);
  }
}

function sync(root, selectedFile) {
  const provider = selectedProvider(root);
  const type = selectedType(root);
  const mode = selectedMode(root);
  const typeDef = RESOURCE_TYPES.find((item) => item.id === type) || RESOURCE_TYPES[0];
  const fileInput = root.querySelector("[data-field=file]");
  if (fileInput) fileInput.accept = typeDef.accept;
  root.querySelector("[data-row=url]").hidden = provider !== RESOURCE_PROVIDER_IDS.DIRECT_URL;
  root.querySelector("[data-row=notebook]").hidden = provider !== RESOURCE_PROVIDER_IDS.NOTEBOOK;
  root.querySelector("[data-row=file]").hidden = provider !== RESOURCE_PROVIDER_IDS.LOCAL_FILE;
  root.querySelector("[data-row=registry]").hidden = provider !== RESOURCE_PROVIDER_IDS.REGISTRY;
  root.querySelector("[data-row=destination]").hidden = mode === "reference" || provider === RESOURCE_PROVIDER_IDS.NOTEBOOK || provider === RESOURCE_PROVIDER_IDS.REGISTRY;
  root.querySelector("[data-file-name]").textContent = selectedFile ? selectedFile.name : "No file selected.";
}

function describeResource(resource = {}) {
  const lines = [
    `Type: ${resource.resourceType || ""}`,
    `Source: ${resource.source?.kind || ""}`,
    `Value: ${resourceReferenceToSourceValue(resource)}`,
  ];
  if (resource.notebookPath) lines.push(`Notebook: ${resource.notebookPath}`);
  if (resource.metadata?.title) lines.push(`Title: ${resource.metadata.title}`);
  if (resource.metadata?.license) lines.push(`License: ${resource.metadata.license}`);
  if (resource.source?.providerId) lines.push(`Provider: ${resource.source.providerId}`);
  return lines.filter((line) => !line.endsWith(": ")).join("\n");
}

function renderPreview(root, resource) {
  const preview = root.querySelector("[data-preview]");
  if (!preview) return;
  preview.textContent = "";
  if (!resource) {
    preview.textContent = "No resource selected.";
    return;
  }
  if (resource.resourceType === "image" && resource.src && !resource.src.startsWith("data:text")) {
    const img = document.createElement("img");
    img.className = "nv-web-resource-browser__thumb";
    img.alt = resource.metadata?.title || "Selected image";
    img.src = resource.src;
    img.onerror = () => { preview.textContent = describeResource(resource); };
    preview.appendChild(img);
    const meta = make("pre", "", describeResource(resource));
    preview.appendChild(meta);
    return;
  }
  preview.textContent = describeResource(resource);
}

function renderContext(root, invocation) {
  const box = root.querySelector("[data-context]");
  box.textContent = "";
  if (isInsertMediaInvocation(invocation)) {
    box.append(make("div", "", `For: Insert ${invocation.mediaFamily || resourceLabel(invocation.resourceType)}`));
    if (invocation.targetMode || invocation.originEditorPath) {
      const target = [invocation.targetMode, invocation.originEditorPath].filter(Boolean).join(": ");
      box.append(make("div", "", `Into: ${target}`));
    }
    return;
  }
  box.append(make("div", "", "For: Acquire resource"));
}

async function acquireFromFields(root, selectedFile, modeOverride = "") {
  return acquireResource({
    resourceType: selectedType(root),
    providerId: selectedProvider(root),
    mode: modeOverride || selectedMode(root),
    sourceName: root.querySelector("[data-field=sourceName]")?.value || "",
    url: root.querySelector("[data-field=url]")?.value || "",
    notebookPath: root.querySelector("[data-field=notebookPath]")?.value || "",
    destinationPath: root.querySelector("[data-field=destinationPath]")?.value || "",
    resourceId: root.querySelector("[data-field=resourceId]")?.value || "",
    file: selectedFile,
  });
}

export async function setupPanel(panel, panelVars = {}) {
  console.info("[NV-WEB-RESOURCE] setupPanel start", { resourceType: panelVars?.resourceType || panelVars?.invocation?.resourceType || "" });
  ensureStyles();
  const invocation = normalizeWebResourceBrowserInvocation(panelVars.invocation || panelVars);
  let selectedFile = null;
  let selectedResource = null;
  let completed = false;

  const root = make("section", "nv-web-resource-browser");
  root.dataset.webResourceBrowserPanel = "true";
  root.innerHTML = `
    <div class="nv-web-resource-browser__row"><h2>Find Resource</h2><button type="button" data-action="cancel">Cancel</button></div>
    <div class="nv-web-resource-browser__context" data-context></div>
    <div class="nv-web-resource-browser__section">
      <div class="nv-web-resource-browser__section-title">Source</div>
      <div class="nv-web-resource-browser__grid">
        <label>Resource Type<select data-field="resourceType"></select></label>
        <label>Provider<select data-field="provider"></select></label>
        <label>Mode<select data-field="mode"><option value="reference">Reference</option><option value="install">Download to Notebook</option><option value="inline">Inline</option></select></label>
        <label>Display Name<input data-field="sourceName" type="text"></label>
        <label data-row="url">URL<input data-field="url" type="url" placeholder="https://example.com/resource"></label>
        <label data-row="notebook">Notebook Path<input data-field="notebookPath" type="text" placeholder="Notebook/Resources/..."></label>
        <label data-row="registry">Installed Resource<select data-field="resourceId"></select></label>
        <div data-row="file"><button type="button" data-action="choose-file">Choose File...</button><span data-file-name style="margin-left:8px;color:#56616f;">No file selected.</span><input data-field="file" type="file" hidden></div>
        <label data-row="destination">Destination<input data-field="destinationPath" type="text" placeholder="Notebook/Resources/..."></label>
      </div>
      <div data-provider-controls></div>
    </div>
    <div class="nv-web-resource-browser__section">
      <div class="nv-web-resource-browser__section-title">Selected Resource</div>
      <div class="nv-web-resource-browser__preview" data-preview>No resource selected.</div>
      <div class="nv-web-resource-browser__row"><button type="button" data-action="reference">Reference</button><button type="button" data-action="download">Download</button><button type="button" data-primary data-action="use">Use this resource</button></div>
    </div>
    <div class="nv-web-resource-browser__status" data-status></div>`;
  panel.replaceChildren(root);
  panel.style.minHeight = "0";
  panel.style.overflow = "hidden";

  renderContext(root, invocation);
  console.info("[NV-WEB-RESOURCE] setupPanel complete", {
    resourceType: invocation.resourceType,
    mediaFamily: invocation.mediaFamily || "",
    childCount: root.children.length,
  });
  scheduleWebResourceVisibilityDiagnostics("setupPanel root visibility", {
    destinationCell: panel.closest?.(".panel-cell") || null,
    browserRoot: root,
    workspaceRoot: panel.closest?.("#workspace") || document.getElementById?.("workspace"),
    destinationParent: panel.closest?.(".panel-cell")?.parentElement || null,
    invocation,
    placement: { source: "WebResourceBrowserPanel.setupPanel", childCount: root.children.length },
  });

  const typeSelect = root.querySelector("[data-field=resourceType]");
  const allowedTypes = panelVars.lockedResourceType ? RESOURCE_TYPES.filter((type) => type.id === invocation.resourceType) : RESOURCE_TYPES;
  for (const type of allowedTypes.length ? allowedTypes : RESOURCE_TYPES) typeSelect.append(option(type.id, type.label, type.id === invocation.resourceType));
  typeSelect.disabled = panelVars.lockedResourceType === true;

  const providerSelect = root.querySelector("[data-field=provider]");
  const fillProviders = () => {
    providerSelect.textContent = "";
    const providers = listResourceProviders({ resourceType: selectedType(root) });
    for (const provider of providers) providerSelect.append(option(provider.id, provider.label, provider.id === (panelVars.providerId || RESOURCE_PROVIDER_IDS.DIRECT_URL)));
    if (!providerSelect.value && providers[0]) providerSelect.value = providers[0].id;
  };
  fillProviders();

  const fileInput = root.querySelector("[data-field=file]");
  const sourceName = root.querySelector("[data-field=sourceName]");
  const destination = root.querySelector("[data-field=destinationPath]");
  const resync = () => {
    sync(root, selectedFile);
    refreshRegistry(root).catch((err) => setStatus(root, err?.message || String(err), true));
  };
  const clearSelected = () => {
    selectedResource = null;
    renderPreview(root, null);
  };

  root.addEventListener("input", (event) => {
    if (event.target?.matches?.("input,select")) clearSelected();
  });

  root.addEventListener("change", (event) => {
    if (event.target?.matches?.("input,select")) clearSelected();
    if (event.target === typeSelect) fillProviders();
    if (event.target === fileInput) {
      selectedFile = fileInput.files?.[0] || null;
      if (selectedFile && !sourceName.value) sourceName.value = selectedFile.name;
      if (selectedFile && !destination.value) destination.value = defaultDestination(selectedType(root), selectedFile.name);
    }
    resync();
  });

  root.addEventListener("click", async (event) => {
    const action = event.target?.closest?.("[data-action]")?.dataset?.action || "";
    if (!action) return;
    if (action === "cancel") {
      completed = true;
      setStatus(root, "Returning to Insert Media...");
      await panelVars.onCancel?.();
      return;
    }
    if (action === "choose-file") {
      fileInput.click();
      return;
    }
    if (!["reference", "download", "use"].includes(action)) return;
    try {
      setStatus(root, "Working...");
      const mode = action === "reference" ? "reference" : (action === "download" ? "install" : selectedMode(root));
      const resource = action === "use" && selectedResource ? selectedResource : await acquireFromFields(root, selectedFile, mode);
      if (!resourceTypeMatchesInvocation(resource, invocation)) {
        throw new Error(`${resourceLabel(invocation.resourceType)} workflow cannot use a ${resource.resourceType || "different"} resource.`);
      }
      selectedResource = resource;
      renderPreview(root, selectedResource);
      setStatus(root, action === "use" ? "Returning resource..." : "Resource ready.");
      if (action === "use") {
        completed = true;
        const accepted = await panelVars.onResourceSelected?.(resource);
        if (accepted === false) completed = false;
      }
    } catch (err) {
      setStatus(root, err?.message || String(err), true);
    }
  });

  resync();

  return () => {
    if (!completed && isInsertMediaInvocation(invocation)) panelVars.onCancel?.();
  };
}

export async function createPanel(content, panelVars = {}) {
  return setupPanel(content, panelVars);
}
