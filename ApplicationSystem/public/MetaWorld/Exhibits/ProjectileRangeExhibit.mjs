// Nodevision/ApplicationSystem/public/MetaWorld/Exhibits/ProjectileRangeExhibit.mjs
// Projectile range exhibit controller launches a body and draws a simple trajectory trace.

import { THREE } from "../MetaWorldScene.mjs";

function radians(degrees) {
  return (degrees * Math.PI) / 180;
}

function fmt(value, digits = 2) {
  return Number(value).toFixed(digits);
}

export class ProjectileRangeExhibit {
  constructor({ definition, sceneSystem, physics, ui }) {
    this.definition = definition;
    this.sceneSystem = sceneSystem;
    this.physics = physics;
    this.ui = ui;
    this.running = false;
    this.elapsed = 0;
    this.samples = [];
    this.group = new THREE.Group();
  }

  mount() {
    const { position, parameters } = this.definition;
    this.group.position.set(position.x, position.y, position.z);
    this.addRangeVisuals();
    const radius = parameters.radius ?? 0.2;
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 16),
      new THREE.MeshStandardMaterial({ color: "#f97316", roughness: 0.35 }),
    );
    sphere.castShadow = true;
    this.sceneSystem.addObject(`${this.definition.id}-projectile`, sphere, { clickable: true, controller: this });
    this.body = this.physics.createBody({
      id: `${this.definition.id}-projectile`,
      radius,
      position: this.startPosition(),
      restitution: parameters.restitution ?? 0.2,
      damping: parameters.damping ?? 0.999,
      mesh: sphere,
    });
    this.body.pinned = true;
    this.sceneSystem.addObject(this.definition.id, this.group, { clickable: true, controller: this });
    this.sceneSystem.addLabel(this.definition.title, { x: position.x, y: 2.2, z: position.z });
    this.physics.addUpdateHook((dt) => this.update(dt));
  }

  addRangeVisuals() {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.04, 1.4),
      new THREE.MeshStandardMaterial({ color: "#d7ecdf", roughness: 0.7 }),
    );
    base.position.set(1.6, 0.02, 0);
    this.group.add(base);
    const launcher = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.5 }),
    );
    launcher.rotation.z = Math.PI / 2 - radians(this.definition.parameters.angleDegrees ?? 38);
    launcher.position.set(-1.5, 0.42, 0);
    this.group.add(launcher);
    this.trace = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([]),
      new THREE.LineBasicMaterial({ color: "#0f766e" }),
    );
    this.group.add(this.trace);
  }

  startPosition() {
    const p = this.definition.position;
    return { x: p.x - 1.6, y: 0.55, z: p.z };
  }

  launch() {
    const speed = this.definition.parameters.speed ?? 6.5;
    const angle = radians(this.definition.parameters.angleDegrees ?? 38);
    this.reset();
    this.body.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed, z: 0 };
    this.body.pinned = false;
    this.running = true;
  }

  reset() {
    this.running = false;
    this.elapsed = 0;
    this.samples = [];
    this.body.position = this.startPosition();
    this.body.velocity = { x: 0, y: 0, z: 0 };
    this.body.pinned = true;
    this.physics.syncMesh(this.body);
    this.updateTrace();
    this.updateReadouts();
  }

  update(dt) {
    if (this.running) {
      this.elapsed += dt;
      this.samples.push(new THREE.Vector3(
        this.body.position.x - this.definition.position.x,
        this.body.position.y,
        this.body.position.z - this.definition.position.z,
      ));
      if (this.samples.length > 160) this.samples.shift();
      this.updateTrace();
    }
    this.updateReadouts();
  }

  updateTrace() {
    this.trace.geometry.dispose();
    this.trace.geometry = new THREE.BufferGeometry().setFromPoints(this.samples);
  }

  registerUI(ui) {
    ui.addButton("Launch", () => this.launch());
    ui.addButton("Reset", () => this.reset());
    ui.addReadout("time", "Flight time", (value) => `${fmt(value)} s`);
    ui.addReadout("range", "Range", (value) => `${fmt(value)} m`);
    ui.addReadout("height", "Height", (value) => `${fmt(value)} m`);
    this.updateReadouts();
  }

  updateReadouts() {
    this.ui.updateReadout("time", this.elapsed);
    this.ui.updateReadout("range", this.body ? this.body.position.x - this.startPosition().x : 0);
    this.ui.updateReadout("height", this.body?.position.y ?? 0);
  }

  onSelect() {}
  onDeselect() {}
}
