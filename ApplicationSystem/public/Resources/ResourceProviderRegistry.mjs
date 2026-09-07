// Nodevision/ApplicationSystem/public/Resources/ResourceProviderRegistry.mjs
// Lightweight provider registry for Resource Acquisition. Providers describe source capabilities; acquisition lives in ResourceAcquisitionService.

export const RESOURCE_PROVIDER_IDS = Object.freeze({
  NOTEBOOK: "notebook",
  LOCAL_FILE: "local-file",
  DIRECT_URL: "direct-url",
  REGISTRY: "registry",
});

const providers = new Map();

export function registerResourceProvider(provider = {}) {
  const id = String(provider.id || "").trim();
  if (!id) throw new Error("Resource providers need an id.");
  providers.set(id, Object.freeze({
    id,
    label: String(provider.label || id).trim() || id,
    description: String(provider.description || "").trim(),
    supportsInstall: provider.supportsInstall !== false,
    supportsReference: provider.supportsReference !== false,
    supportsInline: Boolean(provider.supportsInline),
    sourceKind: String(provider.sourceKind || id).trim() || id,
    resourceTypes: Array.isArray(provider.resourceTypes) ? provider.resourceTypes.map((type) => String(type || "").trim()).filter(Boolean) : [],
  }));
}

export function getResourceProvider(id) {
  return providers.get(String(id || "").trim()) || null;
}

export function listResourceProviders({ resourceType = "" } = {}) {
  const type = String(resourceType || "").trim().toLowerCase();
  return [...providers.values()].filter((provider) => !type || !provider.resourceTypes.length || provider.resourceTypes.includes(type));
}

registerResourceProvider({
  id: RESOURCE_PROVIDER_IDS.NOTEBOOK,
  label: "Notebook Path",
  description: "Reference a file that already lives in the current Notebook.",
  supportsInstall: false,
  sourceKind: "notebook",
});

registerResourceProvider({
  id: RESOURCE_PROVIDER_IDS.LOCAL_FILE,
  label: "Local File",
  description: "Choose a file from this device, then install or inline it.",
  supportsInline: true,
  sourceKind: "local-file",
});

registerResourceProvider({
  id: RESOURCE_PROVIDER_IDS.DIRECT_URL,
  label: "Direct URL",
  description: "Reference or install a known URL directly.",
  supportsInline: true,
  sourceKind: "url",
});

registerResourceProvider({
  id: RESOURCE_PROVIDER_IDS.REGISTRY,
  label: "Installed Resource",
  description: "Pick from configured Resource Registry locations.",
  supportsInstall: false,
  sourceKind: "registry",
});
