// Nodevision/ApplicationSystem/public/engine/ai/BehaviorTree.mjs
// This file defines browser-side Behavior Tree logic for the Nodevision UI. It renders interface components and handles user interactions.
// Deterministic behavior tree interpreter for Nodevision MetaWorld.

import { BTStatus } from "./BehaviorTree/BTStatus.mjs";
import { createBuiltinBehaviorLibrary } from "./BehaviorTree/builtins.mjs";

export { BTStatus };
export { createBuiltinBehaviorLibrary };

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
