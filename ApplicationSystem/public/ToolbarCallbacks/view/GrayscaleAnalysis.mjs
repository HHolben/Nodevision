// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/GrayscaleAnalysis.mjs
// This View command opens grayscale controls for the active raster document through the shared analysis registry. It preserves existing region tools and their image-local selections.
import { getActiveAnalysisTools } from '../../RasterAnalysis/AnalysisToolsContext.mjs';
export default function GrayscaleAnalysis() { getActiveAnalysisTools()?.openGrayscale?.(); }
