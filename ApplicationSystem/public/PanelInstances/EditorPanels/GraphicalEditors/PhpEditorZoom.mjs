// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorZoom.mjs
// This module registers PHP source text sizing and an independently owned HTML preview using the shared zoom capabilities. It scales the input and syntax overlay together without changing PHP source, selection, runtime state, or surrounding tools.
import { registerPanelZoomCapabilities } from '/panels/panelZoomCapabilities.mjs';
import { installHtmlFrameZoom } from '../../ViewPanels/FileViewers/HtmlFrameZoom.mjs';

export function installPhpEditorZoom(owner, input, highlight, previewOwner, iframe) {
  const initial = Number.parseFloat(getComputedStyle(input).fontSize) || 13;
  let fontSize = initial;
  const oldInput = input.style.fontSize, oldHighlight = highlight.style.fontSize;
  const release = registerPanelZoomCapabilities(owner, {
    metadata: { geometric: { actions: ['zoom', 'set', 'reset'], unit: 'text pixels' } },
    semantic: false, fisheye: false,
    getState: mode => mode === 'geometric' ? { fontSize, unit: 'px' } : null,
    geometric(command) {
      const next = command.action === 'reset' ? initial : command.fontSize ?? fontSize + Math.sign((command.factor ?? 1) - 1);
      if (!Number.isFinite(next) || next <= 0) return false;
      fontSize = Math.max(8, Math.min(72, next));
      input.style.fontSize = highlight.style.fontSize = `${fontSize}px`;
      highlight.scrollTop = input.scrollTop; highlight.scrollLeft = input.scrollLeft;
      return true;
    }
  });
  const releasePreview = installHtmlFrameZoom(previewOwner, iframe);
  return () => { releasePreview(); release(); input.style.fontSize = oldInput; highlight.style.fontSize = oldHighlight; };
}
