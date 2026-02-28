//public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditorComponents/history.mjs
//This file is used to manage the user's 'do' and 'undo' operations.

export class History {
  constructor(ctx, limit = 30) {
    this.ctx = ctx;
    this.undoStack = [];
    this.redoStack = [];
    this.limit = limit;
  }

  push(canvas) {
    const data = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.undoStack.push(data);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(canvas) {
    if (this.undoStack.length === 0) return;
    const current = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.redoStack.push(current);
    this.ctx.putImageData(this.undoStack.pop(), 0, 0);
  }

  redo(canvas) {
    if (this.redoStack.length === 0) return;
    const current = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.undoStack.push(current);
    this.ctx.putImageData(this.redoStack.pop(), 0, 0);
  }
}