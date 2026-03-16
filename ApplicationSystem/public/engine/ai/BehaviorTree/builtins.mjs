// Nodevision/ApplicationSystem/public/engine/ai/BehaviorTree/builtins.mjs
// This file defines built-in Behavior Tree actions and conditions for the Nodevision AI runtime. It selects targets and implements default chase, attack, wander, and idle behaviors.

import { BTStatus } from "./BTStatus.mjs";

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
    },
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
        damage,
      });
      return BTStatus.SUCCESS;
    },

    wander(context, params) {
      const dt = Math.max(0, Number(context.deltaTime) || 0);
      const speed = Number(params.speed || context.self.moveSpeed || 1.5);
      const rng = context.rng;
      const angle = rng.nextFloat() * Math.PI * 2 - Math.PI;
      context.self.position[0] += Math.cos(angle) * speed * dt;
      context.self.position[2] += Math.sin(angle) * speed * dt;
      context.self.state = "wandering";
      return BTStatus.RUNNING;
    },

    idle(context) {
      context.self.state = "idle";
      return BTStatus.SUCCESS;
    },
  };

  return { conditions, actions };
}

