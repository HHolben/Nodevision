// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditorComponents/assetPlacement.mjs
// Places downloaded images using the raster editor's existing floating selection, transforms and history.
export function createRasterAssetPlacement({ canvas, ctx, state, history, setSelectionRect, drawSelectionTexture, resetSelectionState, updateRasterStatus }) {
  let pending = false;
  return {
    hasPendingAssetPlacement: () => pending,
    async insertImageFromInsertion({ src, credit = '', validate = () => true } = {}) {
      if (pending || state.selectionPhase === 'committed') throw new Error('Commit or cancel the existing raster selection first.');
      const image = new Image(); image.src = src; await image.decode();
      if (!canvas.isConnected || validate() === false) throw new Error('The originating raster editor changed.');
      if (credit && canvas.height < 48) throw new Error('Use project credits or enlarge the canvas before adding a visible credit.');
      const scale = Math.min(1, canvas.width / image.naturalWidth, (canvas.height - (credit ? 32 : 0)) / image.naturalHeight);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const imageHeight = Math.max(1, Math.round(image.naturalHeight * scale));
      const texture = document.createElement('canvas'); texture.width = width; texture.height = imageHeight + (credit ? 32 : 0);
      const textureContext = texture.getContext('2d'); textureContext.drawImage(image, 0, 0, width, imageHeight);
      if (credit) {
        textureContext.fillStyle = '#fff'; textureContext.fillRect(0, imageHeight, width, 32);
        textureContext.fillStyle = '#111'; textureContext.font = '12px sans-serif'; textureContext.fillText(credit, 4, imageHeight + 19, Math.max(1, width - 8));
      }
      history.push(canvas); resetSelectionState();
      state.baseSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      state.selectionTextureCanvas = texture; state.selectionPhase = 'committed';
      setSelectionRect({ x: 0, y: 0, width, height: texture.height });
      window.NodevisionState = window.NodevisionState || {}; window.NodevisionState.drawTool = 'rectselect';
      window.dispatchEvent(new CustomEvent('nv-draw-tool-changed'));
      drawSelectionTexture(); pending = true;
      updateRasterStatus('Position or resize the asset, then commit or cancel placement in Download Assets.');
      return { pendingPlacement: true };
    },
    commitAssetPlacement() { if (!pending) return false; pending = false; resetSelectionState(); updateRasterStatus('Asset placement committed; save to write the raster file.'); return true; },
    cancelAssetPlacement() { if (!pending) return false; pending = false; if (state.baseSnapshot) ctx.putImageData(state.baseSnapshot, 0, 0); resetSelectionState(); updateRasterStatus('Asset placement cancelled'); return true; },
  };
}
