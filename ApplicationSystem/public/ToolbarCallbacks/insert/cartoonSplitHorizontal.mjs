// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/cartoonSplitHorizontal.mjs
// This toolbar callback splits the selected cartoon frame into horizontal panels.

import { splitSelectedCartoonFrame } from "./cartoonTools.mjs";

export default function cartoonSplitHorizontal() {
  splitSelectedCartoonFrame("horizontal");
}
