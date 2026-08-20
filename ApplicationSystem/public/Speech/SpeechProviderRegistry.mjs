// Nodevision/ApplicationSystem/public/Speech/SpeechProviderRegistry.mjs
// This module registers speech providers and selects a usable provider without exposing implementation-specific engines to Sessions.

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

export class SpeechProviderRegistry {
  constructor(providers = []) {
    this.providers = new Map();
    providers.forEach((provider) => this.register(provider));
  }

  register(provider) {
    if (!provider?.id) throw new Error("Speech providers require an id.");
    if (typeof provider.isAvailable !== "function") throw new Error(`Speech provider ${provider.id} needs isAvailable().`);
    if (typeof provider.speak !== "function") throw new Error(`Speech provider ${provider.id} needs speak().`);
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
    const requirements = options.requirements || {};
    const explicit = String(options.providerId || "").trim();
    if (explicit && explicit !== "automatic") return this.selectExplicit(explicit, requirements);
    const eligible = this.list().filter((provider) => meetsRequirements(provider, requirements));
    const native = eligible.filter((provider) => provider.kind === "native" || provider.kind === "offline");
    const browser = eligible.filter((provider) => provider.kind === "browser");
    for (const provider of [...native, ...browser]) {
      const status = await this.statusFor(provider);
      if (status.available) return { provider, status };
    }
    const need = Object.keys(requirements).length ? " matching the requested capabilities" : "";
    return { provider: null, status: { available: false, reason: `No usable offline speech provider${need} is available.` } };
  }

  async selectExplicit(providerId, requirements = {}) {
    const provider = this.get(providerId);
    if (!provider) return { provider: null, status: { available: false, reason: `Unknown speech provider: ${providerId}.` } };
    if (!meetsRequirements(provider, requirements)) return { provider: null, status: { available: false, reason: `Speech provider ${providerId} does not meet requested capabilities.` } };
    const status = await this.statusFor(provider);
    return status.available ? { provider, status } : { provider: null, status };
  }
}
