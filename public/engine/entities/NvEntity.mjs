// Base entity types for Nodevision MetaWorld.

function toVec3(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value) || value.length < 3) return [...fallback];
  return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
}

export class NvEntity {
  constructor({ id, type = "NvEntity", position, rotation, health = 100, faction = "neutral", primId = null } = {}) {
    this.id = String(id || "");
    this.type = type;
    this.position = toVec3(position);
    this.rotation = toVec3(rotation);
    this.health = Number.isFinite(health) ? Number(health) : 100;
    this.faction = String(faction || "neutral");
    this.primId = primId || this.id;
    this.state = "idle";
    this.alive = this.health > 0;
  }

  update(_deltaTime, _context) {
    if (this.health <= 0) {
      this.alive = false;
      this.state = "dead";
    }
  }

  distanceTo(other) {
    const dx = this.position[0] - other.position[0];
    const dy = this.position[1] - other.position[1];
    const dz = this.position[2] - other.position[2];
    return Math.hypot(dx, dy, dz);
  }

  applyDamage(amount) {
    const delta = Math.max(0, Number(amount) || 0);
    this.health = Math.max(0, this.health - delta);
    if (this.health <= 0) {
      this.alive = false;
      this.state = "dead";
    }
  }
}

export class NvPlayer extends NvEntity {
  constructor(data = {}) {
    super({ ...data, type: "NvPlayer" });
    this.inputState = {
      move: [0, 0, 0]
    };
    this.moveSpeed = Number(data.moveSpeed || 3.5);
  }

  setInput(inputState = {}) {
    if (Array.isArray(inputState.move)) {
      this.inputState.move = [
        Number(inputState.move[0]) || 0,
        Number(inputState.move[1]) || 0,
        Number(inputState.move[2]) || 0
      ];
    }
  }

  update(deltaTime, context) {
    super.update(deltaTime, context);
    if (!this.alive) return;
    const dt = Math.max(0, Number(deltaTime) || 0);
    this.position[0] += this.inputState.move[0] * this.moveSpeed * dt;
    this.position[1] += this.inputState.move[1] * this.moveSpeed * dt;
    this.position[2] += this.inputState.move[2] * this.moveSpeed * dt;
  }
}

export class NvNPC extends NvEntity {
  constructor(data = {}) {
    super({ ...data, type: "NvNPC" });
    this.aiControllerId = data.aiControllerId || null;
    this.targetId = data.targetId || null;
    this.moveSpeed = Number(data.moveSpeed || 2.2);
    this.attackRange = Number(data.attackRange || 1.75);
    this.viewRange = Number(data.viewRange || 15);
    this.attackDamage = Number(data.attackDamage || 8);
    this.attackCooldownSec = Number(data.attackCooldownSec || 1.0);
    this._attackTimer = 0;
  }

  update(deltaTime, context) {
    super.update(deltaTime, context);
    if (!this.alive) return;
    this._attackTimer = Math.max(0, this._attackTimer - Math.max(0, Number(deltaTime) || 0));

    const aiRuntime = context?.aiRuntime;
    if (!aiRuntime || !this.aiControllerId) return;

    aiRuntime.tickEntity(this, context);
  }

  canAttack() {
    return this._attackTimer <= 0;
  }

  markAttackUsed() {
    this._attackTimer = this.attackCooldownSec;
  }
}

export class NvMob extends NvNPC {
  constructor(data = {}) {
    super({ ...data, type: "NvMob" });
    this.aggressive = data.aggressive !== false;
    this.moveSpeed = Number(data.moveSpeed || 2.8);
    this.attackDamage = Number(data.attackDamage || 12);
  }
}
