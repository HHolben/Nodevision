// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/AnalysisTools.mjs
// This callback toggles the active raster analysis subtoolbar through the standard View menu action path. It creates no menu widgets, so repeated clicks cannot append duplicate controls.
import { getActiveAnalysisTools } from '../../RasterAnalysis/AnalysisToolsContext.mjs';
export default function AnalysisTools() {
  getActiveAnalysisTools()?.toggle();
}
