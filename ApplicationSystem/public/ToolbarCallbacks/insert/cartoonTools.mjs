// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/cartoonTools.mjs
// This module assembles the shared cartoonTools features and preserves the public application interface.


export { getDefaultCartoonGap } from './cartoonToolsParts/ApplyGapToPanel.mjs';
export { setDefaultCartoonGap } from './cartoonToolsParts/ApplyGapToPanel.mjs';
export { setActiveCartoonFrame } from './cartoonToolsParts/ApplyGapToPanel.mjs';
export { getActiveCartoonFrame } from './cartoonToolsParts/ApplyGapToPanel.mjs';
export { hydrateAllCartoonPanels } from './cartoonToolsParts/ApplyGapToPanel.mjs';
export { insertCartoonPanelAtCaret } from './cartoonToolsParts/ApplyGapToPanel.mjs';
export { insertCartoonFrame } from './cartoonToolsParts/ApplyGapToPanel.mjs';
export { splitSelectedCartoonFrame } from './cartoonToolsParts/ApplyGapToPanel.mjs';
export { deleteSelectedCartoonFrame } from './cartoonToolsParts/DeleteSelectedCartoonFrame.mjs';
export { installCartoonEditingBehavior } from './cartoonToolsParts/DeleteSelectedCartoonFrame.mjs';

// Install the module-level integration hooks.
