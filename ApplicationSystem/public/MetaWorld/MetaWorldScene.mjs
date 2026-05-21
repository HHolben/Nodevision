// Nodevision/ApplicationSystem/public/MetaWorld/MetaWorldScene.mjs
// MetaWorld scene system creates Three.js rooms, cameras, lights, labels, and animation hooks.

import * as THREE from "/vendor/three/build/three.module.js";
import { OrbitControls } from "/vendor/three/examples/jsm/controls/OrbitControls.js";

export class MetaWorldScene {
  constructor({ container, world }) {
    this.container = container;
    this.world = world;
    this.objects = new Map();
    this.clickableObjects = [];
    this.animationHooks = new Set();
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#eef2f4");
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enabled = world.interactionPermissions.allowCameraOrbit;
    this.setupCamera();
    this.setupLights();
    this.setupRoom();
    this.resize();
    this.resizeHandler = () => this.resize();
    this.running = false;
    this.animationFrameId = null;
    window.addEventListener("resize", this.resizeHandler);
  }

  setupCamera() {
    const spawn = this.world.spawnPosition;
    this.camera.position.set(spawn.x, spawn.y, spawn.z);
    this.controls.target.set(0, 1.2, 0);
  }

  setupLights() {
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#b4bec8", 1.8));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(5, 8, 4);
    key.castShadow = true;
    this.scene.add(key);
  }

  setupRoom() {
    const size = this.world.museum.size;
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, 0.12, size.z),
      new THREE.MeshStandardMaterial({ color: this.world.museum.floorColor, roughness: 0.85 }),
    );
    floor.position.y = -0.06;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wallMaterial = new THREE.MeshStandardMaterial({ color: this.world.museum.wallColor, roughness: 0.9 });
    this.addWall("back-wall", [size.x, size.y, 0.12], [0, size.y / 2, -size.z / 2], wallMaterial);
    this.addWall("left-wall", [0.12, size.y, size.z], [-size.x / 2, size.y / 2, 0], wallMaterial);
    this.addWall("right-wall", [0.12, size.y, size.z], [size.x / 2, size.y / 2, 0], wallMaterial);
  }

  addWall(name, geometrySize, position, material) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(...geometrySize), material);
    wall.position.set(...position);
    wall.receiveShadow = true;
    this.objects.set(name, wall);
    this.scene.add(wall);
  }

  addObject(id, object, { clickable = false, controller = null } = {}) {
    object.userData.metaWorld = { id, controller };
    this.objects.set(id, object);
    this.scene.add(object);
    if (clickable) this.clickableObjects.push(object);
    return object;
  }

  addLabel(text, position) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    context.fillStyle = "rgba(255,255,255,0.92)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#172033";
    context.font = "30px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    sprite.position.set(position.x, position.y, position.z);
    sprite.scale.set(2.8, 0.7, 1);
    this.scene.add(sprite);
    return sprite;
  }

  addAnimationHook(callback) {
    this.animationHooks.add(callback);
    return () => this.animationHooks.delete(callback);
  }

  start() {
    if (this.running) return;
    this.running = true;
    const animate = () => {
      if (!this.running) return;
      this.animationFrameId = requestAnimationFrame(animate);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      for (const hook of this.animationHooks) hook(dt, this);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  dispose() {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener("resize", this.resizeHandler);
    this.controls.dispose?.();
    this.renderer.setAnimationLoop?.(null);
    this.renderer.dispose?.();
    this.renderer.domElement?.parentNode?.removeChild(this.renderer.domElement);
  }

  resize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
}

export { THREE };
