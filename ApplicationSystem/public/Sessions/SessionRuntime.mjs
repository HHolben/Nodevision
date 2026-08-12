// Nodevision/ApplicationSystem/public/Sessions/SessionRuntime.mjs
// This module interprets parsed Nodevision Sessions by mutating Session-local state and invoking shared Nodevision commands.

import { evaluateSessionExpression } from "./SessionExpression.mjs";
import { parseSessionScript } from "./SessionScriptParser.mjs";

export class SessionRuntime {
  constructor(source, context, options = {}) {
    this.source = String(source || "");
    this.context = context;
    this.state = {};
    this.maxLoopIterations = options.maxLoopIterations || 1000;
    this.aborted = false;
    this.paused = false;
    this.resumeWaiter = null;
  }

  async start() {
    const program = parseSessionScript(this.source);
    await this.executeBlock(program.body);
    return { ok: true, state: { ...this.state } };
  }

  abort() {
    this.aborted = true;
    this.context?.cleanup?.();
    this.resume();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.resumeWaiter?.();
    this.resumeWaiter = null;
  }

  async checkpoint() {
    if (this.aborted) throw Object.assign(new Error("Session stopped."), { code: "SESSION_STOPPED" });
    if (!this.paused) return;
    await new Promise((resolve) => { this.resumeWaiter = resolve; });
    if (this.aborted) throw Object.assign(new Error("Session stopped."), { code: "SESSION_STOPPED" });
  }

  value(expr) {
    return evaluateSessionExpression(expr, this.state);
  }

  async statementValue(expr) {
    if (!expr || expr.kind !== "call") return this.value(expr?.source ?? expr);
    return this.executeCall(expr.name, expr.args);
  }

  async executeCall(name, args = []) {
    if (name === "run") {
      const [commandExpr, ...argExprs] = args;
      const commandId = this.value(commandExpr);
      return this.context.run(commandId, argExprs.map((expr) => this.value(expr)), this);
    }
    if (name === "wait") {
      const [eventExpr] = args;
      return this.context.wait(this.value(eventExpr));
    }
    throw new Error(`Unsupported Session call: ${name}.`);
  }

  async executeBlock(body = []) {
    for (const statement of body) {
      await this.checkpoint();
      await this.executeStatement(statement);
    }
  }

  async executeStatement(statement) {
    try {
      if (statement.type === "set") {
        this.state[statement.name] = await this.statementValue(statement.expr);
      } else if (statement.type === "assign") {
        const next = await this.statementValue(statement.expr);
        if (statement.op === "=") this.state[statement.name] = next;
        else if (statement.op === "+=") this.state[statement.name] = (this.state[statement.name] ?? 0) + next;
        else this.state[statement.name] = Number(this.state[statement.name] ?? 0) - Number(next);
      } else if (statement.type === "run") {
        await this.executeCall("run", statement.args);
      } else if (statement.type === "wait") {
        await this.executeCall("wait", statement.args);
      } else if (statement.type === "if") {
        await this.executeBlock(this.value(statement.condition) ? statement.consequent : statement.alternate);
      } else if (statement.type === "while") {
        let count = 0;
        while (this.value(statement.condition)) {
          count += 1;
          if (count > this.maxLoopIterations) throw new Error("Session loop limit exceeded.");
          await this.executeBlock(statement.body);
          await this.checkpoint();
        }
      } else if (statement.type === "pause") {
        this.pause();
        await this.checkpoint();
      } else if (statement.type === "quit") {
        this.abort();
      }
    } catch (err) {
      err.line = err.line || statement.line;
      throw err;
    }
  }
}
