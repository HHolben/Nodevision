// Nodevision/ApplicationSystem/public/MetaWorld/Exhibits/GravityDropExhibit.mjs
// Gravity drop exhibit controller demonstrates falling bodies and retained motion readouts.

import { THREE } from "../MetaWorldScene.mjs";

function fmt(value, digits = 2) {
  return Number(value).toFixed(digits);
}

export class GravityDropExhibit {
  constructor({ definition, sceneSystem, physics, ui }) {
    this.definition = definition;
    this.sceneSystem = sceneSystem;
    this.physics = physics;
    this.ui = ui;
    this.elapsed = 0;
    this.running = false;
    this.bodies = [];
    this.group = new THREE.Group();
  }

  mount() {
    const { position, parameters } = this.definition;
    this.group.position.set(position.x, position.y, position.z);
    this.addStand(parameters);
    const count = parameters.spheres ?? 2;
    for (let i = 0; i < count; i += 1) this.addSphere(i, count, parameters);
    this.sceneSystem.addObject(this.definition.id, this.group, { clickable: true, controller: this });
    this.sceneSystem.addLabel(this.definition.title, { x: position.x, y: 2.8, z: position.z });
    this.physics.addUpdateHook((dt) => this.update(dt));
  }

  addStand(parameters) {
    const height = parameters.dropHeight ?? 3.2;
    const material = new THREE.MeshStandardMaterial({ color: "#384252", roughness: 0.6 });
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, height, 0.1), material);
    post.position.set(-1.1, height / 2, 0);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), material);
    bar.position.set(0, height, 0);
    this.group.add(post, bar);
  }

  addSphere(index, count, parameters) {
    const radius = parameters.radius ?? 0.22;
    const height = parameters.dropHeight ?? 3.2;
    const x = count === 1 ? 0 : -0.45 + index * 0.9;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 16),
      new THREE.MeshStandardMaterial({ color: index % 2 ? "#2563eb" : "#e11d48", roughness: 0.35 }),
    );
    mesh.castShadow = true;
    this.sceneSystem.addObject(`${this.definition.id}-sphere-${index}`, mesh, { clickable: true, controller: this });
    const body = this.physics.createBody({
      id: `${this.definition.id}-sphere-${index}`,
      radius,
      mass: parameters.mass ?? 1,
      position: { x: this.group.position.x + x, y: height, z: this.group.position.z },
      restitution: parameters.restitution ?? 0.32,
      damping: parameters.damping ?? 0.998,
      mesh,
      pinned: true,
    });
    body.localOffset = { x, z: 0 };
    this.resetBodyToLocal(body, height);
    this.bodies.push(body);
  }

  resetBodyToLocal(body, height = this.definition.parameters.dropHeight ?? 3.2) {
    body.position = { x: this.group.position.x + body.localOffset.x, y: height, z: this.group.position.z + body.localOffset.z };
    body.velocity = { x: 0, y: 0, z: 0 };
    body.pinned = true;
    this.physics.syncMesh(body);
  }

  start() {
    this.running = true;
    for (const body of this.bodies) body.pinned = false;
  }

  reset() {
    this.elapsed = 0;
    this.running = false;
    for (const body of this.bodies) this.resetBodyToLocal(body);
    this.updateReadouts();
  }

  update(dt) {
    for (const body of this.bodies) body.pinned = !this.running;
    if (this.running) this.elapsed += dt;
    this.updateReadouts();
  }

  registerUI(ui) {
    ui.addButton("Start", () => this.start());
    ui.addButton("Reset", () => this.reset());
    ui.addReadout("elapsed", "Elapsed", (value) => `${fmt(value)} s`);
    ui.addReadout("velocity", "Velocity", (value) => `${fmt(value)} m/s`);
    this.updateReadouts();
  }

  updateReadouts() {
    const primary = this.bodies[0];
    this.ui.updateReadout("elapsed", this.elapsed);
    this.ui.updateReadout("velocity", Math.abs(primary?.velocity.y ?? 0));
  }

  onSelect() {}
  onDeselect() {}
}
