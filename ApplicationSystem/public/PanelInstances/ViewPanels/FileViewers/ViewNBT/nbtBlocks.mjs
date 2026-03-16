// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNBT/nbtBlocks.mjs
// This file defines block extraction helpers for the ViewNBT file viewer in Nodevision. It maps palette entries into block instances and provides simple coloring and centering utilities.

import * as THREE from "/lib/three/three.module.js";

export function extractBlocks(nbt) {
  const blocks = [];

  const palette = nbt.palette || nbt.Palette || (nbt.value && nbt.value.palette) || [];
  const blockList = nbt.blocks || nbt.Blocks || (nbt.value && nbt.value.blocks) || [];

  for (const entry of blockList) {
    const state = entry.state ?? entry.State ?? 0;
    const pos = entry.pos ?? entry.Pos ?? [0, 0, 0];
    const blockData = palette[state];
    const blockId = blockData?.Name || "minecraft:stone";

    blocks.push({
      id: blockId,
      x: pos[0],
      y: pos[1],
      z: pos[2],
    });
  }

  return blocks;
}

export function centerGroup(group) {
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  group.position.sub(center);
}

export function blockColor(id) {
  if (id.includes("smooth_stone")) return 0xaaaaaa;
  if (id.includes("stone")) return 0x888888;
  if (id.includes("grass")) return 0x55aa55;
  if (id.includes("dirt")) return 0x8b5a2b;
  if (id.includes("wood") || id.includes("log")) return 0xa0522d;
  if (id.includes("glass")) return 0xa0c8ff;
  if (id.includes("sand")) return 0xdbd3a0;
  return 0xcccccc;
}

