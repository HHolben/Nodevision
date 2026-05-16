// Nodevision/ApplicationSystem/public/ToolbarCallbacks/draw/DrawPencilSketching.mjs
// Legacy alias callback kept for compatibility; delegates to PencilSketching callback.

import PencilSketching from "./PencilSketching.mjs";

export default function DrawPencilSketching() {
  return PencilSketching();
}
