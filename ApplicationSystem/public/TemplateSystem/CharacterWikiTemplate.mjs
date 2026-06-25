// Nodevision/ApplicationSystem/public/TemplateSystem/CharacterWikiTemplate.mjs
// Browser-side helper for the CharacterWiki form template.

const LEVEL_FORMULA = "(sum(anatomy.hitpoints.max) + sum(attributes.level) + sum(skills.level)) / 100";
const SEX_VALUES = new Set(["Female", "Male", "Not Applicable"]);

const DEFAULT_ANATOMY = [
  "Head",
  "Torso",
  "Left Arm",
  "Right Arm",
  "Left Hand",
  "Right Hand",
  "Left Leg",
  "Right Leg",
  "Left Foot",
  "Right Foot",
].map((name) => ({ name, current: 10, max: 10 }));

const DEFAULT_ATTRIBUTES = [
  { name: "Strength", level: 1 },
  { name: "Agility", level: 1 },
  { name: "Endurance", level: 1 },
];

const DEFAULT_SKILLS = [
  {
    name: "Walking",
    type: "active",
    level: 1,
    requiresAnatomy: "Left Leg, Right Leg",
    description: "Move across walkable terrain.",
    equations: "baseSpeed * averageHealthRatio(['left-leg','right-leg']) * (1 + skillLevel('walking') / 10)",
  },
  {
    name: "Standing",
    type: "passive",
    level: 1,
    requiresAnatomy: "Left Leg, Right Leg, Left Foot, Right Foot",
    description: "Maintain upright posture while idle or waiting.",
    equations: "",
  },
];

const DEFAULT_BEHAVIORS = [
  { name: "Idle", enabled: true, description: "Wait in place until another behavior is selected." },
];

function slugify(value, fallback = "item") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function titleFromFilename(filename) {
  const base = String(filename || "")
    .split(/[\\/]/)
    .pop()
    .replace(/\.html?$/i, "")
    .replace(/\.character$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!base) return "New Character";
  return base.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

function numberFromInput(input, fallback = 0) {
  const value = numberValue(input?.value, fallback);
  if (input && Number(input.value) < 0) input.value = String(value);
  return value;
}

function splitList(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toEquationList(value) {
  return String(value || "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function calculateCharacterLevel(anatomy, attributes, skills) {
  const hitpointMax = anatomy.reduce((sum, part) => sum + numberValue(part?.hitpoints?.max ?? part?.max), 0);
  const attributeLevels = attributes.reduce((sum, attribute) => sum + numberValue(attribute?.level), 0);
  const skillLevels = skills.reduce((sum, skill) => sum + numberValue(skill?.level), 0);
  return Number(((hitpointMax + attributeLevels + skillLevels) / 100).toFixed(4));
}

function ensureStyle() {
  if (document.getElementById("nodevision-character-template-style")) return;
  const style = document.createElement("style");
  style.id = "nodevision-character-template-style";
  style.textContent = `
.nodevision-character-template-builder {
  display: grid;
  gap: 14px;
}
.nodevision-character-template-toolbar {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  color: #f5f7fa;
  background: #18202a;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
}
.nodevision-character-template-level {
  font-weight: 700;
}
.nodevision-character-template-section {
  display: grid;
  gap: 8px;
  padding: 10px;
  background: rgba(255,255,255,0.045);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
}
.nodevision-character-template-section h3 {
  margin: 0;
  font-size: 0.96rem;
}
.nodevision-character-template-rows {
  display: grid;
  gap: 8px;
}
.nodevision-character-template-row {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)) auto;
  align-items: end;
}
.nodevision-character-template-row label {
  display: grid;
  gap: 4px;
  color: #dce2eb;
  font-size: 0.78rem;
  font-weight: 600;
}
.nodevision-character-template-row input,
.nodevision-character-template-row select,
.nodevision-character-template-row textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 7px 8px;
  color: #f7f7f7;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.18);
  border-radius: 6px;
  font: inherit;
}
.nodevision-character-template-row textarea {
  min-height: 64px;
  resize: vertical;
}
.nodevision-character-template-button {
  border: 0;
  border-radius: 6px;
  padding: 8px 10px;
  color: #f7f7f7;
  background: rgba(255,255,255,0.12);
  font: inherit;
  cursor: pointer;
}
.nodevision-character-template-remove {
  min-width: 34px;
  color: #ffd9d9;
}
.nodevision-character-generated-field {
  display: none !important;
}
`;
  document.head.appendChild(style);
}

function createInput(labelText, value, options = {}) {
  const label = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = labelText;
  const input = options.multiline ? document.createElement("textarea") : document.createElement("input");
  if (!options.multiline) input.type = options.type || "text";
  if (options.min !== undefined) input.min = String(options.min);
  input.value = value ?? "";
  if (options.placeholder) input.placeholder = options.placeholder;
  label.append(span, input);
  return { label, input };
}

function createSelect(labelText, value, choices) {
  const label = document.createElement("label");
  const span = document.createElement("span");
  span.textContent = labelText;
  const select = document.createElement("select");
  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice;
    option.textContent = choice;
    option.selected = choice === value;
    select.appendChild(option);
  }
  label.append(span, select);
  return { label, input: select };
}

function createRowsSection(title, addLabel, rows, createRow) {
  const section = document.createElement("section");
  section.className = "nodevision-character-template-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const rowList = document.createElement("div");
  rowList.className = "nodevision-character-template-rows";
  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "nodevision-character-template-button";
  addButton.textContent = addLabel;

  function renderRow(rowData = {}) {
    const row = createRow(rowData);
    rowList.appendChild(row.element);
    return row;
  }

  for (const row of rows) renderRow(row);
  addButton.addEventListener("click", () => renderRow({}));
  section.append(heading, rowList, addButton);
  return { section, rowList };
}

function getField(form, name) {
  return form.querySelector(`[name="${CSS.escape(name)}"]`);
}

function hideField(form, name) {
  getField(form, name)?.closest(".nodevision-template-field")?.classList.add("nodevision-character-generated-field");
}

function makeRemoveButton(row) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nodevision-character-template-button nodevision-character-template-remove";
  button.textContent = "Remove";
  button.addEventListener("click", () => {
    const ownerForm = row.closest("form");
    row.remove();
    ownerForm?.dispatchEvent(new CustomEvent("nodevision-character-row-change", { bubbles: true }));
  });
  return button;
}

function readBasicValues(form) {
  const sex = getField(form, "sex")?.value || "Not Applicable";
  return {
    name: getField(form, "characterName")?.value?.trim() || "New Character",
    id: getField(form, "characterId")?.value?.trim() || slugify(getField(form, "characterName")?.value, "character"),
    sex: SEX_VALUES.has(sex) ? sex : "Not Applicable",
    backgroundSource: getField(form, "backgroundCharacterSource")?.value?.trim() || "",
    avatar3D: getField(form, "avatar3D")?.value?.trim() || "",
    spriteTopDown: getField(form, "spriteTopDown")?.value?.trim() || "",
    spriteSideScroll: getField(form, "spriteSideScroll")?.value?.trim() || "",
    cloudLocation: getField(form, "cloudLocation")?.value?.trim() || "",
    notes: getField(form, "notes")?.value || "",
  };
}

function rowInputs(row) {
  return Array.from(row.querySelectorAll("input, select, textarea"));
}

function sanitizeJsonForScript(json) {
  return json.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
}

export function enhanceTemplateForm({ form, values, options }) {
  ensureStyle();

  const nameInput = getField(form, "characterName");
  const idInput = getField(form, "characterId");
  const jsonField = getField(form, "characterJson");
  hideField(form, "characterJson");

  const inferredName = titleFromFilename(options?.description || options?.defaultFilename || "");
  if (nameInput && (!nameInput.value || nameInput.value === "New Character")) {
    nameInput.value = inferredName;
    values.characterName = inferredName;
  }
  if (idInput && (!idInput.value || idInput.value === "new-character")) {
    idInput.value = slugify(nameInput?.value, "character");
    values.characterId = idInput.value;
  }

  let idWasEdited = false;
  idInput?.addEventListener("input", () => {
    idWasEdited = true;
  });
  nameInput?.addEventListener("input", () => {
    values.characterName = nameInput.value;
    if (!idWasEdited && idInput) {
      idInput.value = slugify(nameInput.value, "character");
      values.characterId = idInput.value;
    }
    updatePayload();
  });

  const builder = document.createElement("div");
  builder.className = "nodevision-character-template-builder";

  const toolbar = document.createElement("div");
  toolbar.className = "nodevision-character-template-toolbar";
  const toolbarLabel = document.createElement("span");
  toolbarLabel.textContent = "Character value";
  const levelValue = document.createElement("span");
  levelValue.className = "nodevision-character-template-level";
  levelValue.textContent = "Level 0";
  toolbar.append(toolbarLabel, levelValue);

  const anatomy = createRowsSection("Anatomy", "Add Body Part", DEFAULT_ANATOMY, (part) => {
    const row = document.createElement("div");
    row.className = "nodevision-character-template-row";
    const name = createInput("Body part", part.name || "");
    const current = createInput("Current HP", part.current ?? 0, { type: "number", min: 0 });
    const max = createInput("Max HP", part.max ?? 0, { type: "number", min: 0 });
    row.append(name.label, current.label, max.label, makeRemoveButton(row));
    return { element: row };
  });

  const attributes = createRowsSection("Attributes", "Add Attribute", DEFAULT_ATTRIBUTES, (attribute) => {
    const row = document.createElement("div");
    row.className = "nodevision-character-template-row";
    const name = createInput("Attribute", attribute.name || "");
    const level = createInput("Level", attribute.level ?? 0, { type: "number", min: 0 });
    row.append(name.label, level.label, makeRemoveButton(row));
    return { element: row };
  });

  const skills = createRowsSection("Skills", "Add Skill", DEFAULT_SKILLS, (skill) => {
    const row = document.createElement("div");
    row.className = "nodevision-character-template-row";
    const name = createInput("Skill", skill.name || "");
    const type = createSelect("Type", skill.type || "active", ["active", "passive"]);
    const level = createInput("Level", skill.level ?? 0, { type: "number", min: 0 });
    const required = createInput("Required anatomy", skill.requiresAnatomy || "", { placeholder: "Left Leg, Right Leg" });
    const description = createInput("Description", skill.description || "", { multiline: true });
    const equations = createInput("Equations", skill.equations || "", { multiline: true });
    row.append(name.label, type.label, level.label, required.label, description.label, equations.label, makeRemoveButton(row));
    return { element: row };
  });

  const behaviors = createRowsSection("Behaviors", "Add Behavior", DEFAULT_BEHAVIORS, (behavior) => {
    const row = document.createElement("div");
    row.className = "nodevision-character-template-row";
    const name = createInput("Behavior", behavior.name || "");
    const enabled = createSelect("State", behavior.enabled === false ? "disabled" : "enabled", ["enabled", "disabled"]);
    const description = createInput("Description", behavior.description || "", { multiline: true });
    row.append(name.label, enabled.label, description.label, makeRemoveButton(row));
    return { element: row };
  });

  builder.append(toolbar, anatomy.section, attributes.section, skills.section, behaviors.section);
  form.insertBefore(builder, form.querySelector(".nodevision-template-error"));

  function readAnatomy() {
    return Array.from(anatomy.rowList.children).map((row, index) => {
      const [nameInput, currentInput, maxInput] = rowInputs(row);
      const max = numberFromInput(maxInput, 0);
      let current = numberFromInput(currentInput, 0);
      if (current > max) {
        current = max;
        if (currentInput) currentInput.value = String(current);
      }
      const name = nameInput?.value?.trim() || `Body Part ${index + 1}`;
      return {
        id: slugify(name, `body-part-${index + 1}`),
        name,
        hitpoints: { current, max },
      };
    });
  }

  function readAttributes() {
    return Array.from(attributes.rowList.children).map((row, index) => {
      const [nameInput, levelInput] = rowInputs(row);
      const name = nameInput?.value?.trim() || `Attribute ${index + 1}`;
      return {
        id: slugify(name, `attribute-${index + 1}`),
        name,
        level: numberFromInput(levelInput, 0),
      };
    });
  }

  function readSkills() {
    return Array.from(skills.rowList.children).map((row, index) => {
      const [nameInput, typeInput, levelInput, requiredInput, descriptionInput, equationsInput] = rowInputs(row);
      const name = nameInput?.value?.trim() || `Skill ${index + 1}`;
      const type = typeInput?.value === "passive" ? "passive" : "active";
      return {
        id: slugify(name, `skill-${index + 1}`),
        name,
        type,
        level: numberFromInput(levelInput, 0),
        requiresAnatomy: splitList(requiredInput?.value).map((item) => slugify(item, item)),
        description: descriptionInput?.value || "",
        equations: toEquationList(equationsInput?.value),
      };
    });
  }

  function readBehaviors() {
    return Array.from(behaviors.rowList.children).map((row, index) => {
      const [nameInput, enabledInput, descriptionInput] = rowInputs(row);
      const name = nameInput?.value?.trim() || `Behavior ${index + 1}`;
      return {
        id: slugify(name, `behavior-${index + 1}`),
        name,
        enabled: enabledInput?.value !== "disabled",
        description: descriptionInput?.value || "",
      };
    });
  }

  function buildPayload() {
    const basic = readBasicValues(form);
    const anatomyData = readAnatomy();
    const attributeData = readAttributes();
    const skillData = readSkills();
    const behaviorData = readBehaviors();
    const level = calculateCharacterLevel(anatomyData, attributeData, skillData);
    return {
      level: {
        value: level,
        formula: LEVEL_FORMULA,
      },
      schemaVersion: 1,
      kind: "NodevisionCharacter",
      id: basic.id,
      name: basic.name,
      sex: basic.sex,
      assets: {
        avatar3D: basic.avatar3D,
        spriteTopDown: basic.spriteTopDown,
        spriteSideScroll: basic.spriteSideScroll,
      },
      cloudLocation: basic.cloudLocation,
      backgroundCharacter: basic.backgroundSource ? { mode: "preset", source: basic.backgroundSource } : null,
      anatomy: anatomyData,
      attributes: attributeData,
      skills: skillData,
      behaviors: behaviorData,
      notes: basic.notes,
    };
  }

  function updatePayload() {
    const payload = buildPayload();
    const json = sanitizeJsonForScript(JSON.stringify(payload, null, 2));
    if (jsonField) jsonField.value = json;
    values.characterJson = json;
    values.characterName = payload.name;
    values.characterId = payload.id;
    levelValue.textContent = `Level ${payload.level.value}`;
    return payload;
  }

  form.addEventListener("input", updatePayload);
  form.addEventListener("change", updatePayload);
  form.addEventListener("nodevision-character-row-change", updatePayload);
  updatePayload();

  return {
    beforeSubmit() {
      updatePayload();
      return true;
    },
  };
}

export { calculateCharacterLevel };
