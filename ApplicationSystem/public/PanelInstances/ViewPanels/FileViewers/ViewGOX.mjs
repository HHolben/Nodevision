// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewGOX.mjs
// Opens native GOX documents in the shared interactive voxel viewport.
import { renderGox } from '/Voxels/GoxPanel.mjs';
export async function renderFile(filename,viewPanel){return renderGox(filename,viewPanel,false);}
