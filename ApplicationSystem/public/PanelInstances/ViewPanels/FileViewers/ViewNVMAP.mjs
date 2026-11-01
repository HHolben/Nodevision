// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNVMAP.mjs
// This module exposes terrain-map documents through the native file-view interface. It reuses the same editor and lifecycle implementation as graphical terrain-map editing.
// A terrain map is an editable data document, using the same native panel lifecycle in File View.
import {renderMapEditor} from '/MetaWorld/TerrainMaps/Editor/Panel.mjs';
export async function renderFile(path,container){return renderMapEditor(path,container);}
