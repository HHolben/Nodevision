// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewNBT.mjs
// This module renders Minecraft NBT-based structures as an interactive 3D block scene.

import * as THREE from '/lib/three/three.module.js';
import { OrbitControls } from '/lib/three/OrbitControls.js';

const viewers = new WeakMap();

/* ============================
   PUBLIC ENTRY POINT
   ============================ */

export async function renderFile(filePath, viewPanel, iframe, serverBase) {
  try {
    let viewer = viewers.get(viewPanel);
    if (!viewer) {
      viewer = new NBTViewer(viewPanel);
      viewers.set(viewPanel, viewer);
    }

    const url = `/Notebook/${encodeURIComponent(filePath)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load NBT file (${response.status})`);

    const blob = await response.blob();
    let buffer;

    try {
      // 1. Attempt GZip decompression (standard for .nbt files)
      const ds = new DecompressionStream('gzip');
      const decompressedStream = blob.stream().pipeThrough(ds);
      buffer = await new Response(decompressedStream).arrayBuffer();
      console.log('[ViewNBT] Decompressed GZip successfully');
    } catch (e) {
      // 2. Fallback to raw buffer if not compressed
      buffer = await blob.arrayBuffer();
      console.warn('[ViewNBT] File not compressed or GZip failed, reading raw');
    }

    const nbt = parseNBT(buffer);
    viewer.loadStructure(nbt);

  } catch (err) {
    console.error('[ViewNBT] Error:', err);
    viewPanel.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}

/* ============================
   VIEWER
   ============================ */

class NBTViewer {
  constructor(container) {
    this.container = container;
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.container.style.height = '400px';
    this.container.style.position = 'relative';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfd1e5);

    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      10000
    );
    this.camera.position.set(20, 20, 20);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(5, 10, 7.5);
    this.scene.add(sun);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    window.addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop(() => this.animate());
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  clear() {
    while (this.group.children.length) {
      this.group.remove(this.group.children[0]);
    }
  }

  loadStructure(nbt) {
    this.clear();

    const blocks = extractBlocks(nbt);
    if (!blocks.length) return;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const materials = {};

    for (const block of blocks) {
      // SKIP AIR BLOCKS
      if (block.id.includes('air')) continue;

      if (!materials[block.id]) {
        materials[block.id] = new THREE.MeshLambertMaterial({
          color: blockColor(block.id)
        });
      }

      const mesh = new THREE.Mesh(geometry, materials[block.id]);
      mesh.position.set(block.x, block.y, block.z);
      this.group.add(mesh);
    }

    centerGroup(this.group);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }
}

/* ============================
   NBT → BLOCK EXTRACTION
   ============================ */

function extractBlocks(nbt) {
  const blocks = [];

  const palette =
    nbt.palette ||
    nbt.Palette ||
    (nbt.value && nbt.value.palette) ||
    [];

  const blockList =
    nbt.blocks ||
    nbt.Blocks ||
    (nbt.value && nbt.value.blocks) ||
    [];

  for (const entry of blockList) {
    const state = entry.state ?? entry.State ?? 0;
    const pos = entry.pos ?? entry.Pos ?? [0, 0, 0];
    const blockData = palette[state];
    const blockId = blockData?.Name || 'minecraft:stone';

    blocks.push({
      id: blockId,
      x: pos[0],
      y: pos[1],
      z: pos[2]
    });
  }

  return blocks;
}

/* ============================
   HELPERS
   ============================ */

function centerGroup(group) {
  const box = new THREE.Box3().setFromObject(group);
  const center = new THREE.Vector3();
  box.getCenter(center);
  group.position.sub(center);
}

function blockColor(id) {
  if (id.includes('smooth_stone')) return 0xaaaaaa;
  if (id.includes('stone')) return 0x888888;
  if (id.includes('grass')) return 0x55aa55;
  if (id.includes('dirt')) return 0x8b5a2b;
  if (id.includes('wood') || id.includes('log')) return 0xa0522d;
  if (id.includes('glass')) return 0xa0c8ff;
  if (id.includes('sand')) return 0xdbd3a0;
  return 0xcccccc;
}

/* ============================
   NBT PARSER
   ============================ */

function parseNBT(buffer) {
  const view = new DataView(buffer);
  let offset = 0;

  function readByte() { return view.getInt8(offset++); }
  function readShort() {
    const v = view.getInt16(offset, false);
    offset += 2;
    return v;
  }
  function readInt() {
    const v = view.getInt32(offset, false);
    offset += 4;
    return v;
  }
  function readString() {
    const len = readShort();
    let s = '';
    for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset++));
    return s;
  }

  function readTag(type) {
    switch (type) {
      case 1: return readByte();                // Byte
      case 2: return readShort();               // Short
      case 3: return readInt();                 // Int
      case 8: return readString();              // String
      case 9: return readList();                // List
      case 10: return readCompound();           // Compound
      default: 
        // Skip unknown tags or simple placeholders
        return null; 
    }
  }

  function readList() {
    const type = readByte();
    const len = readInt();
    const arr = [];
    for (let i = 0; i < len; i++) arr.push(readTag(type));
    return arr;
  }

  function readCompound() {
    const obj = {};
    while (true) {
      const type = readByte();
      if (type === 0) break; // Tag_End
      const name = readString();
      obj[name] = readTag(type);
    }
    return obj;
  }

  const rootType = readByte();
  if (rootType !== 10) throw new Error('Root is not Compound (Check GZip/Buffer)');
  readString(); // Skip root name
  return readCompound();
}