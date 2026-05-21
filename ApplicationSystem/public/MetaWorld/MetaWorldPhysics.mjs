// Nodevision/ApplicationSystem/public/MetaWorld/MetaWorldPhysics.mjs
// MetaWorld physics engine updates simple resettable bodies with gravity and floor collisions.

function cloneVector(value = {}) {
  return { x: value.x ?? 0, y: value.y ?? 0, z: value.z ?? 0 };
}

function addScaled(target, source, scale) {
  target.x += source.x * scale;
  target.y += source.y * scale;
  target.z += source.z * scale;
}

export class MetaWorldPhysics {
  constructor({ gravity = { x: 0, y: -9.81, z: 0 }, timestep = 1 / 60, floorY = 0 } = {}) {
    this.gravity = cloneVector(gravity);
    this.timestep = timestep;
    this.floorY = floorY;
    this.bodies = new Set();
    this.updateHooks = new Set();
    this.running = true;
  }

  createBody(options = {}) {
    const body = {
      id: options.id ?? `body-${this.bodies.size + 1}`,
      mass: options.mass ?? 1,
      radius: options.radius ?? 0.25,
      position: cloneVector(options.position),
      velocity: cloneVector(options.velocity),
      acceleration: cloneVector(options.acceleration),
      restitution: options.restitution ?? 0.45,
      damping: options.damping ?? 0.995,
      useGravity: options.useGravity !== false,
      pinned: options.pinned === true,
      mesh: options.mesh ?? null,
      initial: {
        position: cloneVector(options.position),
        velocity: cloneVector(options.velocity),
        acceleration: cloneVector(options.acceleration),
      },
    };
    this.bodies.add(body);
    this.syncMesh(body);
    return body;
  }

  addUpdateHook(callback) {
    this.updateHooks.add(callback);
    return () => this.updateHooks.delete(callback);
  }

  step(dt = this.timestep) {
    if (!this.running) return;
    for (const body of this.bodies) this.integrateBody(body, dt);
    for (const hook of this.updateHooks) hook(dt, this);
  }

  integrateBody(body, dt) {
    if (body.pinned) return;
    const totalAcceleration = cloneVector(body.acceleration);
    if (body.useGravity) addScaled(totalAcceleration, this.gravity, 1);
    addScaled(body.velocity, totalAcceleration, dt);
    body.velocity.x *= body.damping;
    body.velocity.y *= body.damping;
    body.velocity.z *= body.damping;
    addScaled(body.position, body.velocity, dt);
    this.collideFloor(body);
    this.syncMesh(body);
  }

  collideFloor(body) {
    const minY = this.floorY + body.radius;
    if (body.position.y >= minY) return;
    body.position.y = minY;
    if (body.velocity.y < 0) body.velocity.y = -body.velocity.y * body.restitution;
    body.velocity.x *= 0.92;
    body.velocity.z *= 0.92;
  }

  resetBody(body) {
    body.position = cloneVector(body.initial.position);
    body.velocity = cloneVector(body.initial.velocity);
    body.acceleration = cloneVector(body.initial.acceleration);
    this.syncMesh(body);
  }

  resetAll() {
    for (const body of this.bodies) this.resetBody(body);
  }

  syncMesh(body) {
    if (!body.mesh) return;
    body.mesh.position.set(body.position.x, body.position.y, body.position.z);
  }
}
