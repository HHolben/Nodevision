import { normalizePrim, validatePrim } from "../entities/primSchema.mjs";

export class NvTemplate {
  constructor(templatePrim) {
    validatePrim(templatePrim);
    if (templatePrim.type !== "NvTemplate") {
      throw new Error(`Template prim must be NvTemplate: ${templatePrim.id}`);
    }

    this.id = templatePrim.id;
    this.attributes = { ...(templatePrim.attributes || {}) };
    this.relationships = { ...(templatePrim.relationships || {}) };

    const targetPrim = this.attributes.entityPrim;
    if (!targetPrim || typeof targetPrim !== "object") {
      throw new Error(`NvTemplate ${this.id} is missing attributes.entityPrim`);
    }
    validatePrim(targetPrim);
    this.entityPrim = normalizePrim(targetPrim);
  }

  instantiate({ id, position }) {
    const prim = normalizePrim(this.entityPrim);
    prim.id = String(id);
    prim.attributes = { ...prim.attributes };
    if (Array.isArray(position)) {
      prim.attributes.position = [position[0], position[1], position[2]];
    }
    return prim;
  }
}

export class TemplateRegistry {
  constructor() {
    this.templates = new Map();
  }

  addTemplate(template) {
    this.templates.set(template.id, template);
  }

  get(templateId) {
    return this.templates.get(String(templateId || ""));
  }
}
