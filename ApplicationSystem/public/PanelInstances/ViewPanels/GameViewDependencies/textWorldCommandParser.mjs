// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/textWorldCommandParser.mjs
// This file maps text-based MetaWorld console instructions onto existing player abilities and inspection helpers.

import {
  collectTextWorldPeriphery,
  describeTextWorldObject,
  findTextWorldObject,
  formatTextWorldObjectList
} from "./textWorldObjectDescriptions.mjs";

function normalizeCommand(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function lowerWords(command) {
  return normalizeCommand(command).toLowerCase().split(" ").filter(Boolean);
}

function isCreative(movementState) {
  return String(movementState?.playerMode || "survival").toLowerCase() === "creative";
}

function abilityEnabled(movementState, key) {
  return isCreative(movementState) || movementState?.worldRules?.[key] === true;
}

function action(output, input = null, frames = 1) {
  return { output, input, frames: Math.max(1, Number(frames) || 1) };
}

function directionInput(words, fallback = "forward") {
  const text = words.join(" ");
  if (/\b(back|backward|behind|reverse)\b/.test(text)) return { moveBackward: true, label: "backward" };
  if (/\b(left|port)\b/.test(text)) return { moveLeft: true, label: "left" };
  if (/\b(right|starboard)\b/.test(text)) return { moveRight: true, label: "right" };
  return fallback === "none" ? { label: "" } : { moveForward: true, label: "forward" };
}

function movementAction(verb, words, extra = {}) {
  const dir = directionInput(words);
  return action(`You ${verb} ${dir.label}.`, { ...dir, label: undefined, ...extra }, 10);
}

function currentPositionLine(context) {
  const pos = context.controls?.getObject?.()?.position;
  if (!pos) return "Your position is unknown.";
  return `You are at ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}.`;
}

export function textWorldAbilityInstructions(movementState) {
  const locked = (enabled) => enabled ? "" : " (locked in this world)";
  return [
    "Walk: Walk forward, Walk back, Walk left, Walk right.",
    "Run: Run forward, Run back, Run left, Run right.",
    "Jump: Jump, High jump, Hop.",
    "Crouch: Crouch. Crawl: Crawl forward, Crawl back, Crawl left, Crawl right.",
    `Use or place: Use, Place.${locked(abilityEnabled(movementState, "allowPlace"))}`,
    `Break or attack: Attack, Break.${locked(abilityEnabled(movementState, "allowBreak"))}`,
    `Fly: Fly.${locked(abilityEnabled(movementState, "allowFly"))}`,
    `Roll: Roll left, Roll right.${locked(abilityEnabled(movementState, "allowRoll"))}`,
    `Pitch: Pitch up, Pitch down. Stand up.${locked(abilityEnabled(movementState, "allowPitch") || abilityEnabled(movementState, "allowRoll"))}`,
    "Look: Look left, Look right, Look up, Look down.",
    "Inspect: Inspect, Inspect <object name>.",
    "Inventory: Inventory. View: Visual."
  ].join("\n");
}

function inspectCommand(command, context) {
  const selector = normalizeCommand(command.slice("inspect".length)).replace(/^(the|a|an)\s+/i, "");
  if (!selector) {
    return action(formatTextWorldObjectList(collectTextWorldPeriphery(context)));
  }
  if (selector.toLowerCase() === "object") {
    return action(describeTextWorldObject(collectTextWorldPeriphery(context)[0] || null));
  }
  const match = findTextWorldObject(context, selector);
  return action(describeTextWorldObject(match));
}

function lookAction(words) {
  const text = words.join(" ");
  if (/\b(up|above)\b/.test(text)) return action("You look up.", { lookPitch: -1 }, 6);
  if (/\b(down|below)\b/.test(text)) return action("You look down.", { lookPitch: 1 }, 6);
  if (/\b(left)\b/.test(text)) return action("You look left.", { lookYaw: -1 }, 8);
  if (/\b(right)\b/.test(text)) return action("You look right.", { lookYaw: 1 }, 8);
  return action("Look where? Try Look left, Look right, Look up, or Look down.");
}

function visualModeAction(context) {
  if (context.movementState) {
    context.movementState.viewMode = "first";
    context.movementState.cameraModeInitialized = false;
  }
  return action("Visual view restored.");
}

export function runTextWorldCommand(command, context) {
  const normalized = normalizeCommand(command);
  const words = lowerWords(normalized);
  const verb = words[0] || "";
  if (!verb) return action("");
  if (verb === "help" || verb === "abilities" || verb === "instructions") {
    return action(textWorldAbilityInstructions(context.movementState));
  }
  if (verb === "inspect") return inspectCommand(normalized, context);
  if (verb === "status" || verb === "where") return action(currentPositionLine(context));
  if (verb === "visual" || verb === "graphics" || verb === "graphical") return visualModeAction(context);
  if (verb === "walk" || verb === "go" || verb === "move") return movementAction("walk", words);
  if (verb === "run") return movementAction("run", words, { run: true });
  if (verb === "crawl") return movementAction("crawl", words, { crawl: true });
  if (verb === "crouch") return action("You crouch.", { crouch: true }, 24);
  if (verb === "jump") return action("You jump.", { jump: true, jumpMode: "normal", jumpForceMultiplier: 1 }, 2);
  if (verb === "hop") return action("You hop.", { jump: true, jumpMode: "hop", jumpForceMultiplier: 0.5 }, 2);
  if (verb === "high" && words[1] === "jump") {
    return action("You high jump.", { jump: true, crouch: true, jumpMode: "high", jumpForceMultiplier: 1.5 }, 2);
  }
  if (verb === "use" || verb === "place") return action(`You ${verb}.`, { use: true }, 2);
  if (verb === "attack" || verb === "break") return action(`You ${verb}.`, { attack: true }, 2);
  if (verb === "fly") return action("You toggle flying.", { fly: true }, 2);
  if (verb === "roll") {
    if (!abilityEnabled(context.movementState, "allowRoll")) return action("Roll is not available in this world.");
    if (words.includes("right")) return action("You roll right.", { rollRight: true }, 8);
    return action("You roll left.", { rollLeft: true }, 8);
  }
  if (verb === "pitch") {
    if (!abilityEnabled(context.movementState, "allowPitch")) return action("Pitch is not available in this world.");
    if (words.includes("down")) return action("You pitch down.", { pitchDown: true }, 8);
    return action("You pitch up.", { pitchUp: true }, 8);
  }
  if (verb === "stand") return action("You stand up.", { standUp: true }, 2);
  if (verb === "look" || verb === "turn") return lookAction(words);
  if (verb === "inventory") return action("You open the inventory.", { openInventory: true }, 2);
  if (verb === "wait") return action("You wait.");
  return action(`Unknown instruction: ${normalized}\nType Abilities to list available instructions.`);
}
