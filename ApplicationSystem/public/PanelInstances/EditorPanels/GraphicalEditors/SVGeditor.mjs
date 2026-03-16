// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditor.mjs
// This module coordinates the Nodevision SVG graphical editor. This module delegates feature logic to imported SVG editor components so the entry point stays small and maintainable. This module exports the render function that Nodevision editor panels call.

import { renderEditor } from "./SVGeditorComponents/SVGeditorImpl.mjs";

export { renderEditor };

