// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditorComponents/history.mjs
// This file defines browser-side history logic for the Nodevision UI. It renders interface components and handles user interactions.
//public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditorComponents/history.mjs
//This file is used to manage the user's 'do' and 'undo' operations.

export class History {
  constructor(ctx, limit = 30) {
    this.ctx = ctx;
    this.undoStack = [];
    this.redoStack = [];
    this.limit = limit;
  }

  capture(canvas) {
    return {
      width: canvas.width,
      height: canvas.height,
      data: this.ctx.getImageData(0, 0, canvas.width, canvas.height),
    };
  }

  restore(snapshot, canvas) {
    if (!snapshot || !canvas) return false;
    if (
      canvas.width !== snapshot.width ||
      canvas.height !== snapshot.height
    ) {
      canvas.width = snapshot.width;
      canvas.height = snapshot.height;
      // Width/height reset can invalidate drawing state; re-resolve context.
      this.ctx = canvas.getContext("2d", { alpha: true }) || this.ctx;
    }
    this.ctx.putImageData(snapshot.data, 0, 0);
    return true;
  }

  push(canvas) {
    const snapshot = this.capture(canvas);
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(canvas) {
    if (this.undoStack.length === 0) return null;
    const current = this.capture(canvas);
    this.redoStack.push(current);
    const snapshot = this.undoStack.pop();
    this.restore(snapshot, canvas);
    return snapshot;
  }

  redo(canvas) {
    if (this.redoStack.length === 0) return null;
    const current = this.capture(canvas);
    this.undoStack.push(current);
    const snapshot = this.redoStack.pop();
    this.restore(snapshot, canvas);
    return snapshot;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }
}
