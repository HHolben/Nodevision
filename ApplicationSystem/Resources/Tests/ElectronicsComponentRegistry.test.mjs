// Nodevision/ApplicationSystem/Resources/Tests/ElectronicsComponentRegistry.test.mjs
// Verifies layered circuit component resources, provenance, diagnostics, and reference safety.

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getResources } from "../ResourceRegistry.mjs";
import { saveResourceTypeSources } from "../ResourceSettingsStore.mjs";

async function makeContext(prefix = "nodevision-electronics-resources-") {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const ctx = {
    runtimeRoot: root,
    applicationSystemRoot: path.join(root, "ApplicationSystem"),
    publicDir: path.join(root, "ApplicationSystem", "public"),
    notebookDir: path.join(root, "Notebook"),
    userSettingsDir: path.join(root, "UserSettings"),
    userDataDir: path.join(root, "UserData"),
  };
  await fs.mkdir(ctx.publicDir, { recursive: true });
  await fs.mkdir(ctx.notebookDir, { recursive: true });
  await fs.mkdir(ctx.userSettingsDir, { recursive: true });
  await fs.mkdir(ctx.userDataDir, { recursive: true });
  return ctx;
}

async function writeFile(filePath, contents = "x") {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

function electronicsSources(personalEnabled = true) {
  return [
    { id: "electronics.component.application", sourceType: "application", name: "Application Circuit Components", path: "Electronics/Components", enabled: true, priority: 0, protected: true, editable: false },
    { id: "electronics.component.managed", sourceType: "managed", name: "Managed Circuit Components", path: "Resources/Electronics/Components", enabled: true, priority: 100, protected: true, editable: false },
    { id: "electronics.component.notebook.library", sourceType: "notebook", name: "Notebook Circuit Library", path: "Library/Electronics/Components", enabled: true, priority: 200, protected: true, editable: true, legacyPath: true },
    { id: "electronics.component.notebook.personal", sourceType: "notebook", name: "Personal Notebook Components", path: "PersonalNotebook/Electronics/Components", enabled: personalEnabled, priority: 300, protected: true, editable: true },
  ];
}

async function seedFixture(ctx) {
  await writeFile(path.join(ctx.publicDir, "Electronics", "Components", "symbols", "resistor.svg"), "<svg></svg>");
  await writeFile(path.join(ctx.publicDir, "Electronics", "Components", "footprints", "lm358_soic8.kicad_mod"), "(footprint lm358_soic8)");
  await writeJson(path.join(ctx.publicDir, "Electronics", "Components", "application-library.component.json"), {
    name: "Application component library",
    components: [
      {
        componentId: "component.generic.resistor",
        name: "Resistor",
        category: "passive",
        componentKind: "generic",
        description: "Generic two-terminal resistor.",
        pins: [{ id: "pin.1", name: "1" }, { id: "pin.2", name: "2" }],
        symbols: [{ id: "symbol.resistor.nodevision", path: "symbols/resistor.svg" }],
      },
      {
        componentId: "component.ti.lm358",
        name: "LM358",
        category: "opamp",
        componentKind: "specific",
        manufacturer: "Texas Instruments",
        manufacturerPartNumber: "LM358",
        deviceFamily: "LM358",
        genericComponentId: "component.generic.opamp",
        electrical: { supply: { max: "32V" } },
        pins: [{ id: "pin.1", name: "OUT A" }, { id: "pin.2", name: "IN A-" }],
        footprints: [{ id: "footprint.soic8", path: "footprints/lm358_soic8.kicad_mod", packageName: "SOIC-8" }],
        datasheets: [{ id: "datasheet.ti.lm358.missing", path: "missing/lm358.pdf" }],
      },
    ],
  });

  await writeFile(path.join(ctx.userDataDir, "Resources", "Electronics", "Components", "Models", "LM358.subckt"), ".SUBCKT LM358 1 2 3 4 5\n.ENDS");
  await writeJson(path.join(ctx.userDataDir, "Resources", "Electronics", "Components", "managed-models.component.json"), {
    operations: [
      {
        operation: "add",
        componentId: "component.ti.lm358",
        spiceModels: [{ id: "model.spice.lm358", path: "Models/LM358.subckt", format: "spice" }],
      },
    ],
  });

  await writeFile(path.join(ctx.notebookDir, "Library", "Electronics", "Datasheets", "TI", "LM358.pdf"), "%PDF-1.4");
  await writeFile(path.join(ctx.notebookDir, "Library", "Electronics", "Components", "Adapters", "LocalOpamp.cir"), "* local model\nXU1 1 2 3 LM358\n.END");
  await writeJson(path.join(ctx.notebookDir, "Library", "Electronics", "Components", "library-notes.component.json"), {
    components: [
      { componentId: "component.local.notebook-header", name: "Notebook Header", category: "connector", componentKind: "generic" },
    ],
    operations: [
      {
        operation: "annotate",
        componentId: "component.ti.lm358",
        datasheets: [{ id: "datasheet.ti.lm358", path: "Library/Electronics/Datasheets/TI/LM358.pdf", title: "TI LM358 datasheet" }],
      },
    ],
  });

  await writeFile(path.join(ctx.notebookDir, "PersonalNotebook", "Electronics", "Components", "footprints", "lm358_dip8.kicad_mod"), "(footprint lm358_dip8)");
  await writeJson(path.join(ctx.notebookDir, "PersonalNotebook", "Electronics", "Components", "personal-overrides.component.json"), {
    components: [
      { componentId: "component.local.personal-jig", name: "Personal Test Jig", category: "fixture", componentKind: "generic" },
    ],
    operations: [
      { operation: "override", componentId: "component.ti.lm358", displayName: "LM358 Personal", electrical: { supply: { max: "30V" }, inputOffsetVoltage: "2mV" }, status: "preferred" },
      { operation: "suppress", componentId: "component.ti.lm358", field: "footprints", subresourceId: "footprint.soic8" },
      { operation: "add", componentId: "component.ti.lm358", footprints: [{ id: "footprint.dip8", path: "PersonalNotebook/Electronics/Components/footprints/lm358_dip8.kicad_mod", packageName: "DIP-8" }], alternateParts: [{ id: "alternate.lm2904", manufacturerPartNumber: "LM2904" }], materials: [{ id: "material.fr4", materialId: "FR4" }] },
      { operation: "annotate", componentId: "component.ti.lm358", datasheets: [{ id: "datasheet.ti.lm358", note: "Use the Notebook copy for offline work." }], docs: [{ id: "doc.bad", path: "../escape.pdf" }] },
    ],
  });
}

function codes(payload) {
  return payload.diagnostics.map((diagnostic) => diagnostic.code);
}

function component(payload, componentId) {
  return payload.resources.find((item) => item.componentId === componentId)?.data || null;
}

async function testCollectionAugmentationAndDiagnostics() {
  const ctx = await makeContext();
  await seedFixture(ctx);
  await saveResourceTypeSources(ctx, "electronics.component", electronicsSources(true));

  const payload = await getResources(ctx, "electronics.component");
  const ids = payload.resources.map((item) => item.componentId).sort();
  assert(ids.includes("component.generic.resistor"));
  assert(ids.includes("component.local.localopamp"));
  assert(ids.includes("component.local.notebook-header"));
  assert(ids.includes("component.local.personal-jig"));
  assert(ids.includes("component.ti.lm358"));

  const lm358 = component(payload, "component.ti.lm358");
  assert(lm358);
  assert.equal(lm358.displayName, "LM358 Personal");
  assert.equal(lm358.componentKind, "specific");
  assert.equal(lm358.genericComponentId, "component.generic.opamp");
  assert.equal(lm358.electrical.supply.max, "30V");
  assert.equal(lm358.electrical.inputOffsetVoltage, "2mV");
  assert.equal(lm358.status, "preferred");
  assert(lm358.spiceModels.some((item) => item.id === "model.spice.lm358"));
  assert.equal(lm358.spiceModels.find((item) => item.id === "model.spice.lm358").sources[0].sourceId, "electronics.component.managed");
  assert(!lm358.footprints.some((item) => item.id === "footprint.soic8"));
  assert(lm358.footprints.some((item) => item.id === "footprint.dip8"));
  assert.equal(lm358.datasheets.find((item) => item.id === "datasheet.ti.lm358").note, "Use the Notebook copy for offline work.");
  assert.equal(lm358.datasheets.find((item) => item.id === "datasheet.ti.lm358").sources.length, 2);
  assert.equal(lm358.materials.find((item) => item.id === "material.fr4").materialId, "FR4");
  assert(!lm358.materials.find((item) => item.id === "material.fr4").rendering);
  assert(lm358.sources.some((source) => source.sourceId === "electronics.component.application"));
  assert(lm358.sources.some((source) => source.sourceId === "electronics.component.managed"));
  assert(lm358.sources.some((source) => source.sourceId === "electronics.component.notebook.library"));
  assert(lm358.sources.some((source) => source.sourceId === "electronics.component.notebook.personal"));
  assert(lm358.provenance.layers.length >= 4);
  assert(lm358.fieldProvenance.electrical.some((source) => source.sourceId === "electronics.component.notebook.personal"));

  const localOpamp = component(payload, "component.local.localopamp");
  assert(localOpamp.spiceModels.some((item) => item.format === "spice"));
  assert.equal(component(payload, "component.local.personal-jig").sources[0].sourceType, "notebook");

  assert(codes(payload).includes("component-reference-missing"));
  assert(codes(payload).includes("component-reference-invalid"));
  assert(codes(payload).includes("duplicate-component-id"));
  assert(codes(payload).includes("duplicate-subresource-id"));
  assert(codes(payload).includes("subresource-suppressed"));
  const badDoc = lm358.docs.find((item) => item.id === "doc.bad");
  assert.equal(badDoc.invalidReference, true);
  assert.equal(badDoc.path, undefined);
}

async function testDisabledPersonalSourceRestoresLowerLayers() {
  const ctx = await makeContext();
  await seedFixture(ctx);
  await saveResourceTypeSources(ctx, "electronics.component", electronicsSources(false));

  const payload = await getResources(ctx, "electronics.component");
  const lm358 = component(payload, "component.ti.lm358");
  assert.equal(lm358.displayName, "LM358");
  assert.equal(lm358.electrical.supply.max, "32V");
  assert(lm358.footprints.some((item) => item.id === "footprint.soic8"));
  assert(!lm358.footprints.some((item) => item.id === "footprint.dip8"));
  assert(!payload.resources.some((item) => item.componentId === "component.local.personal-jig"));
  assert(codes(payload).includes("source-disabled"));
}

await testCollectionAugmentationAndDiagnostics();
await testDisabledPersonalSourceRestoresLowerLayers();
console.log("Electronics Component Registry tests passed.");
