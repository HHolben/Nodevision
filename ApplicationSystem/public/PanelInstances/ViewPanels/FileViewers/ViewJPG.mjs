// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewJPG.mjs
// JPEG files use the same decoded-image viewport and analysis lifecycle as PNG files. Browser decoding applies EXIF orientation before native dimensions, overlays, and canvas pixel analysis are computed.
import { renderRasterFile } from './ViewPNG.mjs';
export const renderFile = renderRasterFile;
