// Nodevision/ApplicationSystem/public/MetaWorld/Exhibits/PendulumExhibit.mjs
// Pendulum exhibit controller simulates angular motion with gravity-derived period readouts.

import { THREE } from "../MetaWorldScene.mjs";

function fmt(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function radians(degrees) {
  return (degrees * Math.PI) / 180;
}

export class PendulumExhibit {
  constructor({ definition, sceneSystem, physics, ui }) {
    this.definition = definition;
    this.sceneSystem = sceneSystem;
    this.physics = physics;
    this.ui = ui;
    this.group = new THREE.Group();
    this.running = false;
    this.angle = radians(definition.parameters.initialAngleDegrees ?? 24);
    this.angularVelocity = 0;
  }

  mount() {
    const { position } = this.definition;
    this.group.position.set(position.x, position.y, position.z);
    this.addFrame();
    this.pivot = new THREE.Vector3(0, this.definition.parameters.pivotHeight ?? 3.1, 0);
    this.rod = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([this.pivot, this.pivot]),
      new THREE.LineBasicMaterial({ color: "#111827" }),
    );
    this.bob = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 32, 16),
      new THREE.MeshStandardMaterial({ color: "#7c3aed", roughness: 0.35 }),
    );
    this.bob.castShadow = true;
    this.group.add(this.rod, this.bob);
    this.updateVisuals();
    this.sceneSystem.addObject(this.definition.id, this.group, { clickable: true, controller: this });
    this.sceneSystem.addLabel(this.definition.title, { x: position.x, y: 3.75, z: position.z });
    this.physics.addUpdateHook((dt) => this.update(dt));
  }

  addFrame() {
    const material = new THREE.MeshStandardMaterial({ color: "#475569", roughness: 0.65 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.08), material);
    top.position.set(0, this.definition.parameters.pivotHeight ?? 3.1, 0);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.1, 0.08), material);
    left.position.set(-1.2, 1.55, 0);
    const right = left.clone();
    right.position.x = 1.2;
    this.group.add(top, left, right);
  }

  start() {
    this.running = true;
  }

  reset() {
    this.running = false;
    this.angle = radians(this.definition.parameters.initialAngleDegrees ?? 24);
    this.angularVelocity = 0;
    this.updateVisuals();
    this.updateReadouts();
  }

  update(dt) {
    if (this.running) {
      const length = this.definition.parameters.length ?? 2.2;
      const gravity = Math.abs(this.physics.gravity.y || 9.81);
      const angularAcceleration = -(gravity / length) * Math.sin(this.angle);
      this.angularVelocity += angularAcceleration * dt;
      this.angularVelocity *= this.definition.parameters.damping ?? 0.998;
      this.angle += this.angularVelocity * dt;
      this.updateVisuals();
    }
    this.updateReadouts();
  }

  updateVisuals() {
    const length = this.definition.parameters.length ?? 2.2;
    const bob = new THREE.Vector3(
      Math.sin(this.angle) * length,
      this.pivot.y - Math.cos(this.angle) * length,
      0,
    );
    this.bob.position.copy(bob);
    this.rod.geometry.dispose();
    this.rod.geometry = new THREE.BufferGeometry().setFromPoints([this.pivot, bob]);
  }

  period() {
    const length = this.definition.parameters.length ?? 2.2;
    const gravity = Math.abs(this.physics.gravity.y || 9.81);
    return 2 * Math.PI * Math.sqrt(length / gravity);
  }

  registerUI(ui) {
    ui.addButton("Start", () => this.start());
    ui.addButton("Reset", () => this.reset());
    ui.addReadout("length", "Length", (value) => `${fmt(value)} m`);
    ui.addReadout("gravity", "Gravity", (value) => `${fmt(value)} m/s^2`);
    ui.addReadout("period", "Approx. period", (value) => `${fmt(value)} s`);
    this.updateReadouts();
  }

  updateReadouts() {
    this.ui.updateReadout("length", this.definition.parameters.length ?? 2.2);
    this.ui.updateReadout("gravity", Math.abs(this.physics.gravity.y || 9.81));
    this.ui.updateReadout("period", this.period());
  }

  onSelect() {}
  onDeselect() {}
}
