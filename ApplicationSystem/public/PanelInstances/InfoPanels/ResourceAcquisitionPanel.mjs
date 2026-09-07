// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/ResourceAcquisitionPanel.mjs
// Standalone Resource Acquisition panel for finding, referencing, installing, or inlining media resources.

import { acquireResource, listResourceProviders, RESOURCE_PROVIDER_IDS } from "/Resources/ResourceAcquisitionService.mjs";
import { loadResourceItems } from "/Resources/ResourceRegistryClient.mjs";

const STYLE_ID = "nv-resource-acquisition-style";
const MEDIA_TYPES = [
  { id: "image", label: "Image", accept: "image/*" },
  { id: "audio", label: "Audio", accept: "audio/*" },
  { id: "video", label: "Video", accept: "video/*" },
  { id: "model", label: "3D Model", accept: ".3mf,.dae,.fbx,.glb,.gltf,.obj,.ply,.scad,.stl,.usd,.usda,.usdc,.usdz" },
];

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
.nv-resource-acq { display:grid; gap:12px; width:min(680px, calc(100vw - 40px)); color:#1f2832; font:13px Arial, sans-serif; }
.nv-resource-acq__head { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.nv-resource-acq h2 { margin:0; font-size:19px; }
.nv-resource-acq__grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; }
.nv-resource-acq label { display:grid; gap:4px; }
.nv-resource-acq input, .nv-resource-acq select { width:100%; box-sizing:border-box; border:1px solid #aeb8c4; border-radius:5px; padding:7px; font:12px ui-monospace, monospace; }
.nv-resource-acq__full { grid-column:1 / -1; }
.nv-resource-acq__actions { display:flex; justify-content:flex-end; gap:8px; flex-wrap:wrap; }
.nv-resource-acq button { border:1px solid #93a0ae; border-radius:5px; padding:7px 10px; background:#f7f9fb; cursor:pointer; font:12px Arial, sans-serif; }
.nv-resource-acq button[data-primary] { background:#243746; color:white; border-color:#243746; }
.nv-resource-acq button:disabled { opacity:.55; cursor:not-allowed; }
.nv-resource-acq__status { min-height:18px; color:#30475e; font-weight:700; }
.nv-resource-acq__status[data-error="true"] { color:#b02a37; }
.nv-resource-acq__result { min-height:54px; white-space:pre-wrap; overflow:auto; max-height:140px; border:1px solid #d7dde5; border-radius:6px; padding:8px; background:#fbfcfd; font:12px ui-monospace, monospace; }
`;
  document.head.appendChild(style);
}

function el(tag, text = "", className = "") {
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

function setStatus(root, text, error = false) {
  const node = root.querySelector("[data-status]");
  node.textContent = String(text || "");
  node.dataset.error = String(Boolean(error));
}

function defaultDestination(type, name) {
  const clean = String(name || "resource").trim().replace(/[^A-Za-z0-9._-]+/g, "_") || "resource";
  if (type === "image") return `Notebook/Resources/Media/Images/${clean}`;
  if (type === "audio") return `Notebook/Resources/Media/Audio/${clean}`;
  if (type === "video") return `Notebook/Resources/Media/Video/${clean}`;
  if (type === "model") return `Notebook/Resources/Models/${clean}`;
  return `Notebook/Resources/${clean}`;
}

async function refreshRegistry(root) {
  const type = root.querySelector("[data-field=resourceType]").value;
  const provider = root.querySelector("[data-field=provider]").value;
  const picker = root.querySelector("[data-field=resourceId]");
  if (provider !== RESOURCE_PROVIDER_IDS.REGISTRY) return;
  picker.replaceChildren(option("", "Loading..."));
  try {
    const items = await loadResourceItems(type, { raw: true });
    picker.replaceChildren(option("", items.length ? "First installed resource" : "No installed resources"));
    for (const item of items) {
      const id = item.id || item.logicalId || item.path || "";
      picker.append(option(id, item.displayName || item.path || id));
    }
  } catch (err) {
    picker.replaceChildren(option("", "Unable to load resources"));
    setStatus(root, err?.message || String(err), true);
  }
}

function sync(root, selectedFile = null) {
  const type = root.querySelector("[data-field=resourceType]").value;
  const provider = root.querySelector("[data-field=provider]").value;
  const mode = root.querySelector("[data-field=mode]").value;
  const typeDef = MEDIA_TYPES.find((item) => item.id === type) || MEDIA_TYPES[0];
  const fileInput = root.querySelector("[data-field=file]");
  fileInput.accept = typeDef.accept;
  root.querySelector("[data-row=url]").hidden = provider !== RESOURCE_PROVIDER_IDS.DIRECT_URL;
  root.querySelector("[data-row=notebook]").hidden = provider !== RESOURCE_PROVIDER_IDS.NOTEBOOK;
  root.querySelector("[data-row=file]").hidden = provider !== RESOURCE_PROVIDER_IDS.LOCAL_FILE;
  root.querySelector("[data-row=registry]").hidden = provider !== RESOURCE_PROVIDER_IDS.REGISTRY;
  root.querySelector("[data-row=destination]").hidden = mode === "reference" || provider === RESOURCE_PROVIDER_IDS.NOTEBOOK || provider === RESOURCE_PROVIDER_IDS.REGISTRY;
  root.querySelector("[data-file-name]").textContent = selectedFile ? selectedFile.name : "No file selected.";
}

export async function createPanel(content, panelVars = {}) {
  ensureStyles();
  const root = el("section", "", "nv-resource-acq");
  root.innerHTML = `
    <div class="nv-resource-acq__head"><h2>Find / Install Resource</h2><button type="button" data-action="close">Close</button></div>
    <div class="nv-resource-acq__grid">
      <label>Type<select data-field="resourceType"></select></label>
      <label>Provider<select data-field="provider"></select></label>
      <label>Mode<select data-field="mode"><option value="reference">Reference</option><option value="install">Install to Notebook</option><option value="inline">Inline</option></select></label>
      <label>Display Name<input data-field="sourceName" type="text"></label>
      <label class="nv-resource-acq__full" data-row="url">URL<input data-field="url" type="url" placeholder="https://example.com/resource"></label>
      <label class="nv-resource-acq__full" data-row="notebook">Notebook Path<input data-field="notebookPath" type="text" placeholder="Notebook/Resources/Media/Images/example.png"></label>
      <label class="nv-resource-acq__full" data-row="registry">Installed Resource<select data-field="resourceId"></select></label>
      <div class="nv-resource-acq__full" data-row="file"><button type="button" data-action="choose-file">Choose File...</button><span data-file-name style="margin-left:8px;color:#56616f;">No file selected.</span><input data-field="file" type="file" hidden></div>
      <label class="nv-resource-acq__full" data-row="destination">Destination<input data-field="destinationPath" type="text" placeholder="Notebook/Resources/..."></label>
    </div>
    <div class="nv-resource-acq__actions"><button type="button" data-action="cancel">Cancel</button><button type="button" data-primary data-action="acquire">Acquire</button></div>
    <div class="nv-resource-acq__status" data-status></div>
    <pre class="nv-resource-acq__result" data-result></pre>`;
  content.replaceChildren(root);

  const typeSelect = root.querySelector("[data-field=resourceType]");
  for (const type of MEDIA_TYPES) typeSelect.append(option(type.id, type.label, type.id === (panelVars.resourceType || "image")));
  const providerSelect = root.querySelector("[data-field=provider]");
  for (const provider of listResourceProviders({ resourceType: typeSelect.value })) {
    providerSelect.append(option(provider.id, provider.label, provider.id === (panelVars.providerId || RESOURCE_PROVIDER_IDS.NOTEBOOK)));
  }

  let selectedFile = null;
  const fileInput = root.querySelector("[data-field=file]");
  const sourceName = root.querySelector("[data-field=sourceName]");
  const destination = root.querySelector("[data-field=destinationPath]");

  const resync = () => {
    sync(root, selectedFile);
    refreshRegistry(root).catch((err) => setStatus(root, err?.message || String(err), true));
  };

  root.addEventListener("change", (event) => {
    if (event.target === fileInput) {
      selectedFile = fileInput.files?.[0] || null;
      if (selectedFile && !sourceName.value) sourceName.value = selectedFile.name;
      if (selectedFile && !destination.value) destination.value = defaultDestination(typeSelect.value, selectedFile.name);
    }
    if (event.target === typeSelect && selectedFile) destination.value = defaultDestination(typeSelect.value, selectedFile.name);
    resync();
  });

  root.addEventListener("click", async (event) => {
    const action = event.target?.closest?.("[data-action]")?.dataset?.action || "";
    if (!action) return;
    if (action === "close" || action === "cancel") panelVars.onCancel?.();
    if (action === "choose-file") fileInput.click();
    if (action === "acquire") {
      try {
        setStatus(root, "Working...");
        const result = await acquireResource({
          resourceType: typeSelect.value,
          providerId: root.querySelector("[data-field=provider]").value,
          mode: root.querySelector("[data-field=mode]").value,
          sourceName: sourceName.value,
          url: root.querySelector("[data-field=url]").value,
          notebookPath: root.querySelector("[data-field=notebookPath]").value,
          destinationPath: destination.value,
          resourceId: root.querySelector("[data-field=resourceId]").value,
          file: selectedFile,
        });
        root.querySelector("[data-result]").textContent = JSON.stringify(result, null, 2);
        setStatus(root, "Resource ready.");
        panelVars.onResult?.(result);
        if (panelVars.closeOnDone === true) panelVars.onDone?.(result);
      } catch (err) {
        setStatus(root, err?.message || String(err), true);
      }
    }
  });

  resync();
}
