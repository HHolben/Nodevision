// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNBT.mjs
// This module renders Minecraft NBT-based structures as an interactive 3D block scene.

import { NBTViewer } from "./ViewNBT/NBTViewer.mjs";
import { parseNBT } from "./ViewNBT/parseNBT.mjs";

const viewers = new WeakMap();

/* ============================
   PUBLIC ENTRY POINT
   ============================ */

export async function renderFile(filePath, viewPanel, iframe, serverBase) {
  try {
    let viewer = viewers.get(viewPanel);
    if (!viewer) {
      viewer = new NBTViewer(viewPanel);
      viewers.set(viewPanel, viewer);
    }

    const url = `/Notebook/${encodeURIComponent(filePath)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load NBT file (${response.status})`);

    const blob = await response.blob();
    let buffer;

    try {
      // 1. Attempt GZip decompression (standard for .nbt files)
      const ds = new DecompressionStream('gzip');
      const decompressedStream = blob.stream().pipeThrough(ds);
      buffer = await new Response(decompressedStream).arrayBuffer();
      console.log('[ViewNBT] Decompressed GZip successfully');
    } catch (e) {
      // 2. Fallback to raw buffer if not compressed
      buffer = await blob.arrayBuffer();
      console.warn('[ViewNBT] File not compressed or GZip failed, reading raw');
    }

    const nbt = parseNBT(buffer);
    viewer.loadStructure(nbt);

  } catch (err) {
    console.error('[ViewNBT] Error:', err);
    viewPanel.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
  }
}
