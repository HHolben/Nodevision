// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/NBTEditor.mjs
// Graphical editor mode for Minecraft structure NBT files. Tool actions live in the shared Nodevision sub-toolbar; selected block editing lives in an InfoPanel.

import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { setStatus as setNodevisionStatus } from "/StatusBar.mjs";
import { normalizeNotebookRelativePath, toNotebookAssetUrl } from "/utils/notebookPath.mjs";
import { parseNBT } from "../../ViewPanels/FileViewers/ViewNBT/parseNBT.mjs";
import { serializeNBT } from "../../ViewPanels/FileViewers/ViewNBT/serializeNBT.mjs";
import {
  applyBlocksToNbt,
  blockColor,
  blockKeyFromPosition,
  cloneBlock,
  createBlockObject,
  extractBlocks,
  isStairBlock,
  parseBlockState,
  stringifyBlockState,
} from "../../ViewPanels/FileViewers/ViewNBT/nbtBlocks.mjs";

const COMMON_BLOCKS = [
  "minecraft:stone",
  "minecraft:cobblestone",
  "minecraft:grass_block",
  "minecraft:dirt",
  "minecraft:oak_planks",
  "minecraft:oak_stairs[facing=north,half=bottom,shape=straight]",
  "minecraft:stone_brick_stairs[facing=north,half=bottom,shape=straight]",
  "minecraft:glass",
  "minecraft:sand",
  "minecraft:bricks",
];

function notebookUrl(filePath) {
  return toNotebookAssetUrl(normalizeNotebookRelativePath(filePath));
}

function ensureStyles() {
  if (document.getElementById("nv-nbt-editor-styles")) return;
  const style = document.createElement("style");
  style.id = "nv-nbt-editor-styles";
  style.textContent = `
    .nv-nbt-editor { position:relative; width:100%; height:100%; min-height:0; background:#bfd1e5; color:#f4f7fb; font:13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; overflow:hidden; }
    .nv-nbt-viewport { position:absolute; inset:0; min-width:0; min-height:0; outline:none; background:#bfd1e5; }
    .nv-nbt-viewport canvas { display:block; width:100%; height:100%; }
    .nv-nbt-error { margin:12px; color:#b00020; }
  `;
  document.head.appendChild(style);
}

async function fetchNbt(filePath) {
  const response = await fetch(notebookUrl(filePath));
  if (!response.ok) throw new Error(`Failed to load NBT file (${response.status})`);
  const blob = await response.blob();
  try {
    const ds = new DecompressionStream("gzip");
    const buffer = await new Response(blob.stream().pipeThrough(ds)).arrayBuffer();
    return { buffer, gzip: true };
  } catch {
    return { buffer: await blob.arrayBuffer(), gzip: false };
  }
}

async function gzipBuffer(buffer) {
  if (typeof CompressionStream === "undefined") return buffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function safeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

class NBTGraphicalEditor {
  constructor(filePath, host, nbt, options = {}) {
    this.filePath = filePath;
    this.host = host;
    this.nbt = nbt;
    this.wasGzip = Boolean(options.gzip);
    this.blocks = extractBlocks(nbt).map((block) => cloneBlock(block, { index: block.index, entry: block.entry }));
    this.blockMap = new Map();
    this.materials = new Map();
    this.keys = new Set();
    this.mode = "select";
    this.placementBlock = COMMON_BLOCKS[0];
    this.selectedBlock = null;
    this.pointerDown = null;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.clock = new THREE.Clock();
    this.dirty = false;
    this.disposed = false;
    this.contextListeners = new Set();
    this.init();
  }

  init() {
    this.host.innerHTML = "";
    this.rootEl = document.createElement("div");
    this.rootEl.className = "nv-nbt-editor";
    this.host.appendChild(this.rootEl);
    this.buildViewport();
    this.initScene();
    this.renderBlocks();
    this.bindEvents();
    this.installContext();
    this.animate();
    this.setMode("select");
    this.setStatus(`${this.blocks.length} blocks`);
  }

  buildViewport() {
    this.viewport = document.createElement("div");
    this.viewport.className = "nv-nbt-viewport";
    this.viewport.tabIndex = 0;
    this.rootEl.appendChild(this.viewport);
  }

  installContext() {
    const editor = this;
    const actionHandler = (actionKey) => editor.handleToolbarAction(actionKey);
    this.actionHandler = actionHandler;
    this.context = {
      id: "nbt",
      title: "NBT Block Properties",
      commonBlocks: [...COMMON_BLOCKS],
      getState() {
        return editor.contextSnapshot();
      },
      getSelectedBlock() {
        return editor.selectedBlockSnapshot();
      },
      getPlacementBlock() {
        return editor.placementBlock;
      },
      setPlacementBlock(value) {
        editor.setPlacementBlock(value);
      },
      getMode() {
        return editor.mode;
      },
      setMode(mode) {
        editor.setMode(mode);
      },
      updateSelectedBlock(patch) {
        return editor.updateSelectedBlock(patch);
      },
      addNearSelection() {
        editor.addNearSelection();
      },
      deleteSelectedBlock() {
        editor.deleteSelectedBlock();
      },
      save(path = editor.filePath) {
        return editor.save(path);
      },
      handleToolbarAction(actionKey) {
        return editor.handleToolbarAction(actionKey);
      },
      subscribe(listener) {
        if (typeof listener !== "function") return () => {};
        editor.contextListeners.add(listener);
        listener(editor.contextSnapshot());
        return () => editor.contextListeners.delete(listener);
      },
    };

    window.NBTEditorContext = this.context;
    window.dispatchEvent(new CustomEvent("nv-nbt-context-ready", {
      detail: this.contextSnapshot(),
    }));

    updateToolbarState({
      currentMode: "NBTediting",
      activePanelType: "GraphicalEditor",
      selectedFile: this.filePath,
      activeEditorFilePath: this.filePath,
      activeActionHandler: actionHandler,
      fileIsDirty: false,
      nbtToolMode: this.mode,
      nbtHasSelection: Boolean(this.selectedBlock),
      nbtPlacementBlock: this.placementBlock,
    });

    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: { heading: "NBT Blocks", force: true, toggle: false },
    }));
  }

  contextSnapshot() {
    return {
      id: "nbt",
      filePath: this.filePath,
      mode: this.mode,
      placementBlock: this.placementBlock,
      selectedBlock: this.selectedBlockSnapshot(),
      hasSelection: Boolean(this.selectedBlock),
      blockCount: this.blocks.length,
      dirty: this.dirty,
    };
  }

  selectedBlockSnapshot() {
    if (!this.selectedBlock) return null;
    return {
      id: this.selectedBlock.id,
      properties: { ...(this.selectedBlock.properties || {}) },
      stateText: stringifyBlockState(this.selectedBlock),
      x: this.selectedBlock.x,
      y: this.selectedBlock.y,
      z: this.selectedBlock.z,
    };
  }

  notifyContext(reason = "change") {
    const snapshot = this.contextSnapshot();
    updateToolbarState({
      currentMode: "NBTediting",
      activePanelType: "GraphicalEditor",
      selectedFile: this.filePath,
      activeEditorFilePath: this.filePath,
      activeActionHandler: this.actionHandler,
      fileIsDirty: this.dirty,
      nbtToolMode: this.mode,
      nbtHasSelection: snapshot.hasSelection,
      nbtPlacementBlock: this.placementBlock,
    });
    for (const listener of this.contextListeners) listener(snapshot);
    window.dispatchEvent(new CustomEvent("nv-nbt-context-changed", {
      detail: { ...snapshot, reason },
    }));
  }

  handleToolbarAction(actionKey) {
    const actions = {
      nbtModeSelect: () => this.setMode("select"),
      nbtModePlace: () => this.setMode("place"),
      nbtModeDelete: () => this.setMode("delete"),
      nbtAddBlock: () => this.addNearSelection(),
      nbtDeleteBlock: () => this.deleteSelectedBlock(),
      nbtSave: () => this.save(),
    };
    if (typeof actions[actionKey] === "function") {
      actions[actionKey]();
      return true;
    }
    return false;
  }

  setPlacementBlock(value) {
    const parsed = parseBlockState(value || COMMON_BLOCKS[0]);
    this.placementBlock = stringifyBlockState({ id: parsed.Name, properties: parsed.Properties });
    this.notifyContext("placement-block");
    this.setStatus("Placement block: " + this.placementBlock);
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfd1e5);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 10000);
    this.camera.position.set(20, 18, 20);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.viewport.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7280, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 10, 8);
    sun.castShadow = true;
    this.scene.add(sun);
    this.grid = new THREE.GridHelper(64, 64, 0x5f6b7a, 0x9aa7b5);
    this.scene.add(this.grid);
    this.blockRoot = new THREE.Group();
    this.scene.add(this.blockRoot);
    this.selectionBox = new THREE.Box3Helper(new THREE.Box3(), 0xffd166);
    this.selectionBox.visible = false;
    this.scene.add(this.selectionBox);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.viewport);
    } else {
      this.onResize = () => this.resize();
      window.addEventListener("resize", this.onResize);
    }
    this.resize();
  }

  bindEvents() {
    this.onPointerDown = (event) => {
      this.viewport.focus();
      this.pointerDown = { x: event.clientX, y: event.clientY };
    };
    this.onPointerUp = (event) => {
      if (!this.pointerDown) return;
      const moved = Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y);
      this.pointerDown = null;
      if (moved <= 4) this.handlePick(event);
    };
    this.onKeyDown = (event) => {
      if (event.target?.closest?.("input, select, textarea")) return;
      this.keys.add(event.key.toLowerCase());
    };
    this.onKeyUp = (event) => this.keys.delete(event.key.toLowerCase());
    this.viewport.addEventListener("pointerdown", this.onPointerDown);
    this.viewport.addEventListener("pointerup", this.onPointerUp);
    this.viewport.addEventListener("keydown", this.onKeyDown);
    this.viewport.addEventListener("keyup", this.onKeyUp);
  }

  setMode(mode) {
    const normalized = ["select", "place", "delete"].includes(mode) ? mode : "select";
    this.mode = normalized;
    this.notifyContext("mode");
    this.setStatus(normalized[0].toUpperCase() + normalized.slice(1) + " tool active");
  }

  setStatus(message) {
    setNodevisionStatus("NBT", message || "Ready");
  }

  materialFor(block) {
    const key = block.id;
    if (!this.materials.has(key)) {
      this.materials.set(key, new THREE.MeshLambertMaterial({
        color: blockColor(key),
        transparent: key.includes("glass"),
        opacity: key.includes("glass") ? 0.55 : 1,
      }));
    }
    return this.materials.get(key);
  }

  renderBlocks({ keepCamera = true } = {}) {
    while (this.blockRoot.children.length) this.blockRoot.remove(this.blockRoot.children[0]);
    this.blockRoot.position.set(0, 0, 0);
    this.blockMap.clear();
    for (const block of this.blocks) {
      block.key = blockKeyFromPosition(block.x, block.y, block.z);
      this.blockMap.set(block.key, block);
      if (block.id.includes("air")) continue;
      this.blockRoot.add(createBlockObject(block, this.materialFor(block)));
    }
    this.center = this.centerBlockRoot();
    if (!keepCamera) {
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(20, 18, 20);
    }
    this.refreshSelectionBox();
  }

  centerBlockRoot() {
    const box = new THREE.Box3().setFromObject(this.blockRoot);
    if (box.isEmpty()) return new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getCenter(center);
    this.blockRoot.position.sub(center);
    return center;
  }

  refreshSelectionBox() {
    if (!this.selectedBlock) {
      this.selectionBox.visible = false;
      return;
    }
    const min = new THREE.Vector3(this.selectedBlock.x - 0.52, this.selectedBlock.y - 0.52, this.selectedBlock.z - 0.52).add(this.blockRoot.position);
    const max = new THREE.Vector3(this.selectedBlock.x + 0.52, this.selectedBlock.y + 0.52, this.selectedBlock.z + 0.52).add(this.blockRoot.position);
    this.selectionBox.box.set(min, max);
    this.selectionBox.visible = true;
  }

  handlePick(event) {
    const hit = this.pick(event);
    if (!hit) {
      if (this.mode === "select") this.selectBlock(null);
      return;
    }
    const block = hit.object.userData.nbtBlock;
    if (!block) return;
    if (this.mode === "delete") {
      this.deleteBlock(block);
      return;
    }
    if (this.mode === "place") {
      const normal = this.normalFromHit(hit);
      this.placeBlock(block.x + normal.x, block.y + normal.y, block.z + normal.z);
      return;
    }
    this.selectBlock(block);
  }

  pick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.blockRoot.children, true)[0] || null;
  }

  normalFromHit(hit) {
    const normal = hit.face?.normal?.clone?.() || new THREE.Vector3(0, 1, 0);
    normal.transformDirection(hit.object.matrixWorld);
    const abs = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
    if (abs[0] >= abs[1] && abs[0] >= abs[2]) return { x: Math.sign(normal.x), y: 0, z: 0 };
    if (abs[1] >= abs[0] && abs[1] >= abs[2]) return { x: 0, y: Math.sign(normal.y), z: 0 };
    return { x: 0, y: 0, z: Math.sign(normal.z) };
  }

  selectBlock(block) {
    this.selectedBlock = block || null;
    this.refreshSelectionBox();
    this.notifyContext("selection");
    if (block) this.setStatus("Selected " + stringifyBlockState(block) + " at " + block.x + ", " + block.y + ", " + block.z);
  }

  updateSelectedBlock(patch = {}) {
    if (!this.selectedBlock) return { ok: false, reason: "No block selected" };
    const current = this.selectedBlockSnapshot();
    const parsed = parseBlockState(patch.stateText || current.stateText || this.selectedBlock.id);
    const properties = { ...parsed.Properties, ...(patch.properties || {}) };
    if (!isStairBlock(parsed.Name)) {
      delete properties.facing;
      delete properties.half;
      delete properties.shape;
    } else {
      properties.facing = properties.facing || "north";
      properties.half = properties.half || "bottom";
      properties.shape = properties.shape || "straight";
    }

    const next = {
      x: safeInteger(patch.x, this.selectedBlock.x),
      y: safeInteger(patch.y, this.selectedBlock.y),
      z: safeInteger(patch.z, this.selectedBlock.z),
    };
    const key = blockKeyFromPosition(next.x, next.y, next.z);
    if (this.blockMap.has(key) && this.blockMap.get(key) !== this.selectedBlock) {
      this.setStatus("Position occupied");
      return { ok: false, reason: "Position occupied" };
    }

    this.selectedBlock.id = parsed.Name;
    this.selectedBlock.properties = properties;
    Object.assign(this.selectedBlock, next);
    this.markDirty("Block updated");
    this.renderBlocks();
    this.notifyContext("block-updated");
    return { ok: true };
  }

  addNearSelection() {
    const base = this.selectedBlock || { x: 0, y: 0, z: 0 };
    this.placeBlock(base.x, base.y + 1, base.z);
  }

  placeBlock(x, y, z) {
    const key = blockKeyFromPosition(x, y, z);
    if (this.blockMap.has(key)) {
      this.selectBlock(this.blockMap.get(key));
      this.setStatus("Position occupied");
      return;
    }
    const parsed = parseBlockState(this.placementBlock || COMMON_BLOCKS[0]);
    const block = cloneBlock(null, { id: parsed.Name, properties: parsed.Properties, x, y, z });
    this.blocks.push(block);
    this.selectBlock(block);
    this.markDirty("Block placed");
    this.renderBlocks();
    this.notifyContext("block-placed");
  }

  deleteSelectedBlock() {
    if (this.selectedBlock) this.deleteBlock(this.selectedBlock);
  }

  deleteBlock(block) {
    this.blocks = this.blocks.filter((candidate) => candidate !== block);
    if (this.selectedBlock === block) this.selectedBlock = null;
    this.markDirty("Block deleted");
    this.renderBlocks();
    this.notifyContext("block-deleted");
  }

  markDirty(message) {
    this.dirty = true;
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.fileIsDirty = true;
    updateToolbarState({ fileIsDirty: true });
    this.setStatus(message);
  }

  async save(path = this.filePath) {
    applyBlocksToNbt(this.nbt, this.blocks);
    let buffer = serializeNBT(this.nbt);
    if (this.wasGzip) buffer = await gzipBuffer(buffer);
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        path,
        content: arrayBufferToBase64(buffer),
        encoding: "base64",
        mimeType: "application/x-nbt",
      }),
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok || !data?.success) {
      const detail = data?.error || data?.message || "Failed to save NBT file (" + response.status + ")";
      throw new Error(detail);
    }
    this.dirty = false;
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.fileIsDirty = false;
    updateToolbarState({ fileIsDirty: false });
    this.setStatus("Saved");
    this.notifyContext("saved");
    return true;
  }

  updateMovement(dt) {
    const speed = (this.keys.has("shift") ? 16 : 7) * dt;
    if (!speed) return;
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0) forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, this.camera.up).normalize();
    const delta = new THREE.Vector3();
    if (this.keys.has("w")) delta.add(forward);
    if (this.keys.has("s")) delta.sub(forward);
    if (this.keys.has("d")) delta.add(right);
    if (this.keys.has("a")) delta.sub(right);
    if (this.keys.has("e")) delta.y += 1;
    if (this.keys.has("q")) delta.y -= 1;
    if (delta.lengthSq() === 0) return;
    delta.normalize().multiplyScalar(speed);
    this.camera.position.add(delta);
    this.controls.target.add(delta);
  }

  animate() {
    if (this.disposed) return;
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.updateMovement(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const width = this.viewport.clientWidth || 1;
    const height = this.viewport.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    this.disposed = true;
    this.resizeObserver?.disconnect();
    if (this.onResize) window.removeEventListener("resize", this.onResize);
    this.viewport?.removeEventListener("pointerdown", this.onPointerDown);
    this.viewport?.removeEventListener("pointerup", this.onPointerUp);
    this.viewport?.removeEventListener("keydown", this.onKeyDown);
    this.viewport?.removeEventListener("keyup", this.onKeyUp);
    this.controls?.dispose?.();
    this.renderer?.dispose?.();
    this.materials.forEach((material) => material.dispose?.());
    this.contextListeners.clear();
    if (window.__nvActiveNBTEditor === this) {
      window.__nvActiveNBTEditor = null;
      if (window.NBTEditorContext === this.context) delete window.NBTEditorContext;
      if (window.NodevisionState?.activeActionHandler === this.actionHandler) updateToolbarState({ activeActionHandler: null });
      window.saveMDFile = null;
      window.saveWYSIWYGFile = null;
    }
    window.dispatchEvent(new CustomEvent("nv-nbt-context-cleared", { detail: { filePath: this.filePath } }));
  }
}

export async function renderEditor(filePath, editorDiv) {
  ensureStyles();
  editorDiv.innerHTML = "";
  try {
    const { buffer, gzip } = await fetchNbt(filePath);
    const nbt = parseNBT(buffer);
    const editor = new NBTGraphicalEditor(filePath, editorDiv, nbt, { gzip });
    window.__nvActiveNBTEditor = editor;
    window.saveMDFile = (path = filePath) => editor.save(path);
    window.saveWYSIWYGFile = (path = filePath) => editor.save(path);
    editorDiv.__nvActiveEditorCleanup = () => editor.dispose();
  } catch (err) {
    console.error("[NBTEditor] Error:", err);
    const message = document.createElement("p");
    message.className = "nv-nbt-error";
    message.textContent = "Error: " + (err?.message || "Unable to open NBT editor");
    editorDiv.appendChild(message);
  }
}
