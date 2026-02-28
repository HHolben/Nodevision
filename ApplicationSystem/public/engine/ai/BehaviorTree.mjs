// Deterministic behavior tree interpreter for Nodevision MetaWorld.

export const BTStatus = Object.freeze({
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
  RUNNING: "RUNNING"
});

export class DeterministicRng {
  constructor(seed = 123456789) {
    this.state = (Number(seed) >>> 0) || 123456789;
  }

  nextFloat() {
    // LCG (Numerical Recipes), deterministic across JS runtimes.
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
}

function hasChildren(node) {
  return Array.isArray(node?.children) && node.children.length > 0;
}

export class BehaviorTreeInterpreter {
  constructor({ conditions = {}, actions = {} } = {}) {
    this.conditions = { ...conditions };
    this.actions = { ...actions };
  }

  tick(tree, context) {
    if (!tree || typeof tree !== "object") return BTStatus.FAILURE;
    return this.#tickNode(tree, context);
  }

  #tickNode(node, context) {
    const nodeType = String(node.type || "");

    if (nodeType === "Selector") {
      if (!hasChildren(node)) return BTStatus.FAILURE;
      for (const child of node.children) {
        const status = this.#tickNode(child, context);
        if (status === BTStatus.SUCCESS || status === BTStatus.RUNNING) return status;
      }
      return BTStatus.FAILURE;
    }

    if (nodeType === "Sequence") {
      if (!hasChildren(node)) return BTStatus.FAILURE;
      for (const child of node.children) {
        const status = this.#tickNode(child, context);
        if (status === BTStatus.FAILURE || status === BTStatus.RUNNING) return status;
      }
      return BTStatus.SUCCESS;
    }

    if (nodeType === "Condition") {
      const key = String(node.key || "");
      const conditionFn = this.conditions[key];
      if (typeof conditionFn !== "function") return BTStatus.FAILURE;
      const ok = conditionFn(context, node.params || {});
      return ok ? BTStatus.SUCCESS : BTStatus.FAILURE;
    }

    if (nodeType === "Action") {
      const key = String(node.key || "");
      const actionFn = this.actions[key];
      if (typeof actionFn !== "function") return BTStatus.FAILURE;
      return actionFn(context, node.params || {});
    }

    return BTStatus.FAILURE;
  }
}

function resolveTarget(context) {
  const self = context.self;
  const entities = context.entities;

  const explicit = self.targetId ? entities.get(self.targetId) : null;
  if (explicit?.alive) return explicit;

  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const entity of entities.values()) {
    if (!entity.alive || entity.id === self.id) continue;
    if (!context.factions.areHostile(self.faction, entity.faction)) continue;
    const d = self.distanceTo(entity);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = entity;
    }
  }
  if (nearest) self.targetId = nearest.id;
  return nearest;
}

export function createBuiltinBehaviorLibrary() {
  const conditions = {
    playerInRange(context, params) {
      const range = Number(params.range || context.self.viewRange || 12);
      const target = resolveTarget(context);
      if (!target) return false;
      return context.self.distanceTo(target) <= range;
    },

    healthBelow(context, params) {
      const threshold = Number(params.threshold ?? 30);
      return Number(context.self.health) < threshold;
    },

    targetVisible(context, params) {
      const visibilityRange = Number(params.range || context.self.viewRange || 15);
      const target = resolveTarget(context);
      if (!target) return false;
      return context.self.distanceTo(target) <= visibilityRange;
    }
  };

  const actions = {
    chaseTarget(context, params) {
      const target = resolveTarget(context);
      if (!target) {
        context.self.state = "idle";
        return BTStatus.FAILURE;
      }

      const dt = Math.max(0, Number(context.deltaTime) || 0);
      const speed = Number(params.speed || context.self.moveSpeed || 2);
      const dx = target.position[0] - context.self.position[0];
      const dy = target.position[1] - context.self.position[1];
      const dz = target.position[2] - context.self.position[2];
      const len = Math.hypot(dx, dy, dz) || 1;

      context.self.position[0] += (dx / len) * speed * dt;
      context.self.position[1] += (dy / len) * speed * dt;
      context.self.position[2] += (dz / len) * speed * dt;
      context.self.state = "chasing";
      return BTStatus.RUNNING;
    },

    attackTarget(context, params) {
      const target = resolveTarget(context);
      if (!target) return BTStatus.FAILURE;

      const range = Number(params.range || context.self.attackRange || 1.8);
      const inRange = context.self.distanceTo(target) <= range;
      if (!inRange) return BTStatus.FAILURE;
      if (!context.self.canAttack()) return BTStatus.RUNNING;

      const damage = Number(params.damage || context.self.attackDamage || 6);
      target.applyDamage(damage);
      context.self.markAttackUsed();
      context.self.state = "attacking";
      context.emitEvent?.({
        type: "ai.attack",
        sourceId: context.self.id,
        targetId: target.id,
        damage
      });
      return BTStatus.SUCCESS;
    },

    wander(context, params) {
      const dt = Math.max(0, Number(context.deltaTime) || 0);
      const speed = Number(params.speed || context.self.moveSpeed || 1.5);
      const rng = context.rng;
      const angle = (rng.nextFloat() * Math.PI * 2) - Math.PI;
      context.self.position[0] += Math.cos(angle) * speed * dt;
      context.self.position[2] += Math.sin(angle) * speed * dt;
      context.self.state = "wandering";
      return BTStatus.RUNNING;
    },

    idle(context) {
      context.self.state = "idle";
      return BTStatus.SUCCESS;
    }
  };

  return { conditions, actions };
}

export class AiRuntime {
  constructor({ behaviorTrees = new Map(), interpreter = null, rng = new DeterministicRng(1234) } = {}) {
    this.behaviorTrees = behaviorTrees;
    this.rng = rng;
    this.interpreter = interpreter || (() => {
      const builtins = createBuiltinBehaviorLibrary();
      return new BehaviorTreeInterpreter(builtins);
    })();
    this.blackboardByEntity = new Map();
  }

  tickEntity(entity, context) {
    const tree = this.behaviorTrees.get(entity.aiControllerId);
    if (!tree) return BTStatus.FAILURE;

    const blackboard = this.blackboardByEntity.get(entity.id) || {};
    this.blackboardByEntity.set(entity.id, blackboard);

    return this.interpreter.tick(tree, {
      ...context,
      self: entity,
      blackboard,
      rng: context?.rng || this.rng
    });
  }
}
