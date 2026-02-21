// Faction model with hostility matrix resolution.

export class NvFaction {
  constructor({ name, hostility = {} } = {}) {
    this.name = String(name || "neutral");
    this.hostility = new Map();

    for (const [other, isHostile] of Object.entries(hostility || {})) {
      this.hostility.set(String(other), Boolean(isHostile));
    }
  }

  setHostility(otherFactionName, isHostile) {
    this.hostility.set(String(otherFactionName), Boolean(isHostile));
  }

  isHostileTo(otherFactionName) {
    return Boolean(this.hostility.get(String(otherFactionName)));
  }
}

export class FactionRegistry {
  constructor() {
    this.factions = new Map();
  }

  addFaction(faction) {
    this.factions.set(faction.name, faction);
  }

  get(name) {
    return this.factions.get(String(name || ""));
  }

  areHostile(aName, bName) {
    const a = this.get(aName);
    if (!a) return false;
    return a.isHostileTo(bName);
  }
}

export function factionFromPrim(prim) {
  return new NvFaction({
    name: prim.id,
    hostility: prim.attributes?.hostility || {}
  });
}
