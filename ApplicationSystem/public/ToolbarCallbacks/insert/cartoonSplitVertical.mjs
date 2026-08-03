// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/cartoonSplitVertical.mjs
// This toolbar callback splits the selected cartoon frame into vertical panels.

import { splitSelectedCartoonFrame } from "./cartoonTools.mjs";

export default function cartoonSplitVertical() {
  splitSelectedCartoonFrame("vertical");
}
