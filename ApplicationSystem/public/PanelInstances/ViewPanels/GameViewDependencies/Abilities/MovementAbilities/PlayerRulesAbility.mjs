// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/MovementAbilities/PlayerRulesAbility.mjs
// This file defines player-mode and character-skill rules for Game View movement abilities. It centralizes survival versus creative permissions, run speed, and jump strength so character abilities are not hard-coded inside the update loop.

import { installMovementApi } from "../movementContext.mjs";

export function installPlayerRulesAbility(ctx) {
  const { movementState } = ctx;

  function playerMode() {
    const mode = String(movementState?.playerMode || "survival").toLowerCase();
    return mode === "creative" ? "creative" : "survival";
  }

  function canUseAbility(abilityKey) {
    if (playerMode() === "creative") return true;
    return movementState?.worldRules?.[abilityKey] === true;
  }

  function normalizeSkillKey(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function readSkillLevelValue(value) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    if (value && typeof value === "object") {
      const direct = [value.level, value.value, value.rank, value.skillLevel].map(Number).find(Number.isFinite);
      if (Number.isFinite(direct)) return direct;
      return 1;
    }
    return 0;
  }

  function skillNameMatches(entry, skillKeys) {
    const keys = Array.isArray(skillKeys) ? skillKeys.map(normalizeSkillKey) : [normalizeSkillKey(skillKeys)];
    const names = [entry?.id, entry?.name, entry?.skill, entry?.label, entry?.type].map(normalizeSkillKey);
    return names.some((name) => name && keys.includes(name));
  }

  function readSkillLevelFromSource(source, skillKeys) {
    if (!source) return 0;
    const keys = Array.isArray(skillKeys) ? skillKeys.map(normalizeSkillKey) : [normalizeSkillKey(skillKeys)];
    if (Array.isArray(source)) {
      for (const entry of source) {
        if (skillNameMatches(entry, keys)) return readSkillLevelValue(entry);
      }
      return 0;
    }
    if (typeof source !== "object") return 0;
    for (const key of keys) {
      const level = readSkillLevelValue(source[key] ?? source[key.toLowerCase()]);
      if (level > 0) return level;
    }
    for (const [name, entry] of Object.entries(source)) {
      if (keys.includes(normalizeSkillKey(name))) return readSkillLevelValue(entry);
      if (entry && typeof entry === "object" && skillNameMatches(entry, keys)) return readSkillLevelValue(entry);
    }
    return 0;
  }

  function collectPlayerSkillSources() {
    const worldContext = window.VRWorldContext || {};
    const worldDef = worldContext.currentWorldDefinition || {};
    const metadata = worldDef.metadata || {};
    const playerCharacter = movementState.playerCharacter
      || worldContext.playerCharacter
      || worldContext.currentCharacter
      || metadata.playerCharacter
      || worldDef.playerCharacter
      || worldDef.character
      || {};
    return [
      movementState.playerSkills,
      movementState.skills,
      worldContext.playerSkills,
      worldContext.skills,
      playerCharacter.skills,
      playerCharacter.character?.skills,
      metadata.playerSkills,
      worldDef.playerSkills
    ];
  }

  function readPlayerSkillLevel(skillKeys) {
    for (const source of collectPlayerSkillSources()) {
      const level = readSkillLevelFromSource(source, skillKeys);
      if (level > 0) return level;
    }
    return 0;
  }

  function readRunSkillLevel() {
    if (playerMode() === "creative") {
      const editorLevel = Number(movementState.editorRunSkillLevel);
      return Number.isFinite(editorLevel) ? Math.max(1, editorLevel) : 5;
    }
    return readPlayerSkillLevel(["run", "running"]);
  }

  function clampJumpForce(value, fallback = ctx.jumpSpeed) {
    const force = Number(value);
    if (!Number.isFinite(force) || force <= 0) return fallback;
    return Math.max(0.01, Math.min(4, force));
  }

  function readJumpForce() {
    if (playerMode() === "creative") return clampJumpForce(movementState.editorJumpForce, ctx.jumpSpeed);
    const skillForce = readPlayerSkillLevel(["jump", "jumping"]);
    return skillForce > 0 ? clampJumpForce(skillForce, ctx.jumpSpeed) : ctx.jumpSpeed;
  }

  function clearRunState() {
    movementState.isRunning = false;
    movementState.activeRunSkillLevel = 0;
    movementState.activeRunSpeedMultiplier = 1;
  }

  function runSpeedMultiplier(inputState, { crouching = false, crawling = false, walkingAllowed = true } = {}) {
    const moving = inputState?.moveForward || inputState?.moveBackward || inputState?.moveLeft || inputState?.moveRight;
    if (!walkingAllowed || !inputState?.run || !moving || crouching || crawling) {
      clearRunState();
      return 1;
    }
    const level = readRunSkillLevel();
    if (level <= 0) {
      clearRunState();
      return 1;
    }
    const multiplier = Math.max(1, Math.min(4, 1 + level / 10));
    movementState.isRunning = true;
    movementState.activeRunSkillLevel = level;
    movementState.activeRunSpeedMultiplier = multiplier;
    return multiplier;
  }

  return installMovementApi(ctx, {
    playerMode,
    canUseAbility,
    normalizeSkillKey,
    readSkillLevelValue,
    skillNameMatches,
    readSkillLevelFromSource,
    collectPlayerSkillSources,
    readPlayerSkillLevel,
    readRunSkillLevel,
    clampJumpForce,
    readJumpForce,
    clearRunState,
    runSpeedMultiplier
  });
}
