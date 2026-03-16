// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNBT/NBTViewer.mjs
// This file defines the NBTViewer used by the ViewNBT file viewer in Nodevision. It renders NBT-derived block structures as a navigable Three.js scene.

import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";
import { blockColor, centerGroup, extractBlocks } from "./nbtBlocks.mjs";

export class NBTViewer {
  constructor(container) {
    this.container = container;
    this.init();
  }

  init() {
    this.container.innerHTML = "";
    this.container.style.height = "400px";
    this.container.style.position = "relative";

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfd1e5);

    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      10000,
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

    window.addEventListener("resize", () => this.resize());
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
      if (block.id.includes("air")) continue;

      if (!materials[block.id]) {
        materials[block.id] = new THREE.MeshLambertMaterial({
          color: blockColor(block.id),
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

