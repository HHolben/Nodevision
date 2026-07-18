// Nodevision/ApplicationSystem/public/MetaWorld/MetaWorldScene.mjs
// MetaWorld scene system creates Three.js rooms, cameras, lights, labels, and animation hooks.

// Follows Nodevision's existing vendor mapping used by legacy GameView modules.
import * as THREE from "/lib/three/three.module.js";
import { OrbitControls } from "/lib/three/OrbitControls.js";

const DEFAULT_ENVIRONMENT = {
  skyColor: "#eef2f4",
  floorColor: "",
  dayNightCycle: {
    enabled: false,
    durationSeconds: 120,
    periods: [
      { time: 0, brightness: 1 }
    ]
  }
};

function cloneDefaultDayNightCycle() {
  return {
    enabled: false,
    durationSeconds: 120,
    periods: [
      { time: 0, brightness: 1 }
    ]
  };
}

function clampFiniteNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeDayNightPeriod(period, fallbackTime = 0) {
  const source = period && typeof period === "object" ? period : {};
  return {
    time: clampFiniteNumber(source.time ?? source.timeSeconds ?? source.at ?? source.offset, 0, Number.MAX_SAFE_INTEGER, fallbackTime),
    brightness: clampFiniteNumber(source.brightness ?? source.level ?? source.intensity, 0, 1, 1)
  };
}

function normalizeDayNightCycle(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const durationSeconds = clampFiniteNumber(source.durationSeconds ?? source.duration ?? source.cycleSeconds, 1, 86400, DEFAULT_ENVIRONMENT.dayNightCycle.durationSeconds);
  const sourcePeriods = Array.isArray(source.periods)
    ? source.periods
    : Array.isArray(source.keyframes)
      ? source.keyframes
      : [];
  const periods = sourcePeriods
    .map((period, index) => normalizeDayNightPeriod(period, index === 0 ? 0 : durationSeconds * index / Math.max(sourcePeriods.length, 1)))
    .map((period) => ({
      time: clampFiniteNumber(period.time, 0, durationSeconds, 0),
      brightness: clampFiniteNumber(period.brightness, 0, 1, 1)
    }))
    .sort((a, b) => a.time - b.time);
  return {
    enabled: source.enabled === true,
    durationSeconds,
    periods: periods.length ? periods : cloneDefaultDayNightCycle().periods
  };
}

function normalizeEnvironmentState(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};
  const environment = {
    ...DEFAULT_ENVIRONMENT,
    ...source
  };
  environment.dayNightCycle = normalizeDayNightCycle(source.dayNightCycle ?? source.dayNight ?? source.lightCycle ?? DEFAULT_ENVIRONMENT.dayNightCycle);
  return environment;
}

function moduloPositive(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function smoothStep(value) {
  return value * value * (3 - 2 * value);
}

function sampleDayNightBrightness(cycle, elapsedSeconds = 0) {
  const normalized = normalizeDayNightCycle(cycle);
  if (!normalized.enabled) return 1;
  const periods = normalized.periods;
  if (periods.length <= 1) return periods[0]?.brightness ?? 1;
  const duration = normalized.durationSeconds;
  const t = moduloPositive(Number(elapsedSeconds) || 0, duration);
  let previous = periods[periods.length - 1];
  let next = periods[0];
  for (const period of periods) {
    if (period.time <= t) previous = period;
    if (period.time > t) {
      next = period;
      break;
    }
  }
  const previousTime = previous === periods[periods.length - 1] && t < periods[0].time
    ? previous.time - duration
    : previous.time;
  const nextTime = next.time <= previousTime ? next.time + duration : next.time;
  const span = Math.max(0.001, nextTime - previousTime);
  const amount = smoothStep(clampFiniteNumber((t - previousTime) / span, 0, 1, 0));
  return previous.brightness + (next.brightness - previous.brightness) * amount;
}

export class MetaWorldScene {
  constructor({ container, world }) {
    this.container = container;
    this.world = world;
    this.objects = new Map();
    this.clickableObjects = [];
    this.animationHooks = new Set();
    this.clock = new THREE.Clock();
    this.elapsedSeconds = 0;
    this.environment = normalizeEnvironmentState({
      ...DEFAULT_ENVIRONMENT,
      ...(world.environment || world.metadata?.environment || {})
    });
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.environment.skyColor || DEFAULT_ENVIRONMENT.skyColor);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enabled = world.interactionPermissions.allowCameraOrbit;
    this.lights = [];
    this.setupCamera();
    this.setupLights();
    this.setupRoom();
    this.updateEnvironmentLighting(0);
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
    const fill = new THREE.HemisphereLight("#ffffff", "#b4bec8", 1.8);
    this.scene.add(fill);
    this.lights.push(fill);

    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(5, 8, 4);
    key.castShadow = true;
    this.scene.add(key);
    this.lights.push(key);
  }

  setupRoom() {
    const size = this.world.museum.size;
    const floorColor = this.environment.floorColor || this.world.museum.floorColor;
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, 0.12, size.z),
      new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.85 }),
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

  updateEnvironmentLighting(elapsedSeconds = 0) {
    const brightness = clampFiniteNumber(sampleDayNightBrightness(this.environment.dayNightCycle, elapsedSeconds), 0, 1, 1);
    for (const light of this.lights) {
      light.userData = light.userData || {};
      if (!Number.isFinite(light.userData.nvDayNightBaseIntensity)) {
        const baseIntensity = Number(light.intensity);
        light.userData.nvDayNightBaseIntensity = Number.isFinite(baseIntensity) ? baseIntensity : 1;
      }
      light.intensity = light.userData.nvDayNightBaseIntensity * brightness;
    }
    if (!(this.environment.backgroundMode === "image" && this.environment.backgroundImage)) {
      const skyColor = new THREE.Color(this.environment.skyColor || DEFAULT_ENVIRONMENT.skyColor);
      skyColor.multiplyScalar(brightness);
      this.scene.background = skyColor;
    }
    return brightness;
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
      this.elapsedSeconds += dt;
      this.updateEnvironmentLighting(this.elapsedSeconds);
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
