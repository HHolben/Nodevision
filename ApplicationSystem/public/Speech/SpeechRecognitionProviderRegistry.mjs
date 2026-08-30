// Nodevision/ApplicationSystem/public/Speech/SpeechRecognitionProviderRegistry.mjs
// This module registers recognition providers and selects an available provider without silently choosing online browser recognition.

function availabilityPayload(provider, available, reason = "") {
  return {
    id: provider.id,
    label: provider.label || provider.id,
    kind: provider.kind || "unknown",
    available: Boolean(available),
    reason,
    capabilities: { ...(provider.capabilities || {}) },
  };
}

function meetsRequirements(provider, requirements = {}) {
  return Object.entries(requirements || {}).every(([key, value]) => provider.capabilities?.[key] === value);
}

function allowsProvider(provider, options = {}) {
  if (provider.capabilities?.offline === true) return true;
  return options.allowOnline === true;
}

export class SpeechRecognitionProviderRegistry {
  constructor(providers = []) {
    this.providers = new Map();
    providers.forEach((provider) => this.register(provider));
  }

  register(provider) {
    if (!provider?.id) throw new Error("Speech recognition providers require an id.");
    if (typeof provider.isAvailable !== "function") throw new Error(`Recognition provider ${provider.id} needs isAvailable().`);
    if (typeof provider.startRecognition !== "function") throw new Error(`Recognition provider ${provider.id} needs startRecognition().`);
    this.providers.set(provider.id, provider);
    return provider;
  }

  get(providerId) {
    return this.providers.get(String(providerId || ""));
  }

  list() {
    return [...this.providers.values()];
  }

  async statusFor(provider) {
    try {
      const result = await provider.isAvailable();
      if (typeof result === "object") return availabilityPayload(provider, result.available, result.reason || "");
      return availabilityPayload(provider, result);
    } catch (err) {
      return availabilityPayload(provider, false, err?.message || "Availability check failed.");
    }
  }

  async statuses() {
    return Promise.all(this.list().map((provider) => this.statusFor(provider)));
  }

  async select(options = {}) {
    const explicit = String(options.providerId || "").trim();
    const requirements = options.requirements || {};
    if (explicit && explicit !== "automatic") return this.selectExplicit(explicit, requirements, options);
    const eligible = this.list().filter((provider) => meetsRequirements(provider, requirements) && allowsProvider(provider, options));
    const offline = eligible.filter((provider) => provider.capabilities?.offline === true || provider.kind === "offline" || provider.kind === "native");
    const other = eligible.filter((provider) => !offline.includes(provider));
    for (const provider of [...offline, ...other]) {
      const status = await this.statusFor(provider);
      if (status.available) return { provider, status };
    }
    return { provider: null, status: { available: false, reason: "No usable offline speech-recognition provider is available." } };
  }

  async selectExplicit(providerId, requirements = {}, options = {}) {
    const provider = this.get(providerId);
    if (!provider) return { provider: null, status: { available: false, reason: `Unknown recognition provider: ${providerId}.` } };
    if (!allowsProvider(provider, options)) {
      return { provider: null, status: { available: false, reason: `Recognition provider ${providerId} requires explicit online opt-in.` } };
    }
    if (!meetsRequirements(provider, requirements)) return { provider: null, status: { available: false, reason: `Recognition provider ${providerId} does not meet requested capabilities.` } };
    const status = await this.statusFor(provider);
    return status.available ? { provider, status } : { provider: null, status };
  }
}
