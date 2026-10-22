// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/GOXeditor.mjs
// Opens native GOX documents with voxel editing and ordinary panel lifecycle support.
import { renderGox } from '/Voxels/GoxPanel.mjs';
export async function renderEditor(filePath,container){return renderGox(filePath,container,true);}
