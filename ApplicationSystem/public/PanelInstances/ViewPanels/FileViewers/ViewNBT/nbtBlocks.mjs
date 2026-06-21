// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNBT/nbtBlocks.mjs
// Shared block model and rendering helpers for NBT viewing and graphical editing.

import * as THREE from "/lib/three/three.module.js";

const DEFAULT_BLOCK_ID = "minecraft:stone";

export function normalizeBlockId(id) {
  const raw = String(id || DEFAULT_BLOCK_ID).trim() || DEFAULT_BLOCK_ID;
  const stateStart = raw.indexOf("[");
  const base = (stateStart >= 0 ? raw.slice(0, stateStart) : raw).trim();
  return base.includes(":") ? base : `minecraft:${base}`;
}

export function parseBlockState(input) {
  const raw = String(input || DEFAULT_BLOCK_ID).trim() || DEFAULT_BLOCK_ID;
  const match = raw.match(/^([^\[]+)(?:\[(.*)\])?$/);
  const name = normalizeBlockId(match?.[1] || raw);
  const properties = {};
  const propText = match?.[2] || "";
  for (const chunk of propText.split(",")) {
    const [key, value] = chunk.split("=").map((part) => part?.trim()).filter(Boolean);
    if (key && value) properties[key] = value;
  }
  return { Name: name, Properties: properties };
}

export function stringifyBlockState({ id, properties } = {}) {
  const name = normalizeBlockId(id);
  const entries = Object.entries(properties || {})
    .filter(([key, value]) => key && value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return name;
  return `${name}[${entries.map(([key, value]) => `${key}=${value}`).join(",")}]`;
}

function getStructureRoot(nbt) {
  if (!nbt || typeof nbt !== "object") return null;
  if (Array.isArray(nbt.blocks) || Array.isArray(nbt.Blocks)) return nbt;
  if (nbt.value && typeof nbt.value === "object") return getStructureRoot(nbt.value);
  return nbt;
}

export function getStructureRefs(nbt) {
  const root = getStructureRoot(nbt);
  if (!root) return null;
  const paletteKey = Array.isArray(root.palette) ? "palette" : (Array.isArray(root.Palette) ? "Palette" : "palette");
  const blocksKey = Array.isArray(root.blocks) ? "blocks" : (Array.isArray(root.Blocks) ? "Blocks" : "blocks");
  const sizeKey = Array.isArray(root.size) ? "size" : (Array.isArray(root.Size) ? "Size" : "size");
  root[paletteKey] = Array.isArray(root[paletteKey]) ? root[paletteKey] : [];
  root[blocksKey] = Array.isArray(root[blocksKey]) ? root[blocksKey] : [];
  return { root, paletteKey, blocksKey, sizeKey, palette: root[paletteKey], blockList: root[blocksKey] };
}

function paletteEntryToState(entry) {
  if (typeof entry === "string") return parseBlockState(entry);
  const id = entry?.Name || entry?.name || DEFAULT_BLOCK_ID;
  const properties = entry?.Properties || entry?.properties || {};
  return { Name: normalizeBlockId(id), Properties: { ...properties } };
}

function readPosition(entry) {
  const pos = entry?.pos || entry?.Pos || [0, 0, 0];
  return [Number(pos[0]) || 0, Number(pos[1]) || 0, Number(pos[2]) || 0].map(Math.trunc);
}

export function blockKeyFromPosition(x, y, z) {
  return `${Math.trunc(x)},${Math.trunc(y)},${Math.trunc(z)}`;
}

export function blockStateKey(block) {
  return stringifyBlockState({ id: block.id, properties: block.properties });
}

export function extractBlocks(nbt) {
  const refs = getStructureRefs(nbt);
  if (!refs) return [];
  return refs.blockList.map((entry, index) => {
    const stateIndex = Number(entry?.state ?? entry?.State ?? 0) || 0;
    const blockData = paletteEntryToState(refs.palette[stateIndex]);
    const [x, y, z] = readPosition(entry);
    return { index, entry, stateIndex, id: blockData.Name, properties: blockData.Properties || {}, x, y, z, key: blockKeyFromPosition(x, y, z) };
  });
}

function createPaletteEntry(block) {
  const parsed = parseBlockState(blockStateKey(block));
  const entry = { Name: parsed.Name };
  if (Object.keys(parsed.Properties || {}).length) entry.Properties = { ...parsed.Properties };
  return entry;
}

function createBlockEntry(block, state, template = null) {
  const entry = template && typeof template === "object" ? { ...template } : {};
  const usesUpperCase = "Pos" in entry || "State" in entry;
  entry[usesUpperCase ? "Pos" : "pos"] = [Math.trunc(block.x), Math.trunc(block.y), Math.trunc(block.z)];
  entry[usesUpperCase ? "State" : "state"] = state;
  return entry;
}

export function applyBlocksToNbt(nbt, blocks) {
  const refs = getStructureRefs(nbt);
  if (!refs) throw new Error("NBT structure does not contain editable blocks.");
  const palette = [];
  const stateByKey = new Map();
  const blockList = [];

  for (const block of blocks) {
    const key = blockStateKey(block);
    let state = stateByKey.get(key);
    if (state === undefined) {
      state = palette.length;
      stateByKey.set(key, state);
      palette.push(createPaletteEntry(block));
    }
    blockList.push(createBlockEntry(block, state, block.entry));
  }

  refs.root[refs.paletteKey] = palette;
  refs.root[refs.blocksKey] = blockList;
  if (Array.isArray(refs.root[refs.sizeKey]) && blockList.length) {
    const max = blocks.reduce((acc, block) => [Math.max(acc[0], block.x + 1), Math.max(acc[1], block.y + 1), Math.max(acc[2], block.z + 1)], [1, 1, 1]);
    refs.root[refs.sizeKey] = refs.root[refs.sizeKey].map((value, index) => Math.max(Number(value) || 0, max[index]));
  }
  return nbt;
}

export function cloneBlock(block, overrides = {}) {
  return { id: normalizeBlockId(block?.id || DEFAULT_BLOCK_ID), properties: { ...(block?.properties || {}) }, x: Math.trunc(block?.x || 0), y: Math.trunc(block?.y || 0), z: Math.trunc(block?.z || 0), entry: block?.entry || null, ...overrides };
}

export function isStairBlock(id) {
  return /(^|:)\w+_stairs$/.test(normalizeBlockId(id));
}

export function blockColor(id) {
  const blockId = normalizeBlockId(id);
  if (blockId.includes("smooth_stone")) return 0xaaaaaa;
  if (blockId.includes("stone") || blockId.includes("deepslate")) return 0x888888;
  if (blockId.includes("grass")) return 0x55aa55;
  if (blockId.includes("dirt")) return 0x8b5a2b;
  if (blockId.includes("wood") || blockId.includes("log") || blockId.includes("planks") || blockId.includes("oak")) return 0xa76b37;
  if (blockId.includes("glass")) return 0x9ed8ff;
  if (blockId.includes("sand")) return 0xdbd3a0;
  if (blockId.includes("brick")) return 0xb14d3f;
  return 0xcccccc;
}

function createPart(material, size, position, block) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  mesh.position.set(position.x, position.y, position.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.nbtBlock = block;
  return mesh;
}

function directionVector(direction) {
  switch (direction) {
    case "south": return { x: 0, z: 1 };
    case "east": return { x: 1, z: 0 };
    case "west": return { x: -1, z: 0 };
    case "north":
    default: return { x: 0, z: -1 };
  }
}

function rotateLeft(vec) {
  return { x: vec.z, z: -vec.x };
}

function rotateRight(vec) {
  return { x: -vec.z, z: vec.x };
}

function quadrantFromVectors(a, b) {
  const x = a.x || b.x;
  const z = a.z || b.z;
  return `${x < 0 ? "w" : "e"}${z < 0 ? "n" : "s"}`;
}

function quadrantPosition(key) {
  return { x: key[0] === "w" ? -0.25 : 0.25, z: key[1] === "n" ? -0.25 : 0.25 };
}

function stairTopQuadrants(facing, shape) {
  const forward = directionVector(facing);
  const back = { x: -forward.x, z: -forward.z };
  const left = rotateLeft(forward);
  const right = rotateRight(forward);
  const forwardHalf = new Set([quadrantFromVectors(forward, left), quadrantFromVectors(forward, right)]);
  if (shape === "outer_left") return [quadrantFromVectors(forward, left)];
  if (shape === "outer_right") return [quadrantFromVectors(forward, right)];
  if (shape === "inner_left") return [...forwardHalf, quadrantFromVectors(back, left)];
  if (shape === "inner_right") return [...forwardHalf, quadrantFromVectors(back, right)];
  return [...forwardHalf];
}

export function createBlockObject(block, material) {
  const root = new THREE.Group();
  root.position.set(block.x, block.y, block.z);
  root.userData.nbtBlock = block;
  if (!isStairBlock(block.id)) {
    root.add(createPart(material, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0 }, block));
    return root;
  }
  const props = block.properties || {};
  const half = props.half === "top" ? "top" : "bottom";
  const facing = ["north", "south", "east", "west"].includes(props.facing) ? props.facing : "north";
  const shape = props.shape || "straight";
  const slabY = half === "top" ? 0.25 : -0.25;
  const stepY = half === "top" ? -0.25 : 0.25;
  root.add(createPart(material, { x: 1, y: 0.5, z: 1 }, { x: 0, y: slabY, z: 0 }, block));
  for (const quadrant of stairTopQuadrants(facing, shape)) {
    const pos = quadrantPosition(quadrant);
    root.add(createPart(material, { x: 0.5, y: 0.5, z: 0.5 }, { x: pos.x, y: stepY, z: pos.z }, block));
  }
  return root;
}

export function centerGroup(group) {
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getCenter(center);
  group.position.sub(center);
  return center;
}
