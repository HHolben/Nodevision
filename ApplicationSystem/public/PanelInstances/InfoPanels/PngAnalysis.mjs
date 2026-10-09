// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/PngAnalysis.mjs
// This information panel presents live PNG selection statistics without owning image data or editing state. The viewer supplies updates and closes the panel when its source document is released.
export function createPanel(content, { analysis, displayName }, panel) {
  content.style.padding = '12px'; content.style.overflow = 'auto';
  const title = panel?.querySelector('.panel-title');
  if (title) title.textContent = displayName;
  const output = document.createElement('div'); output.setAttribute('aria-live', 'polite');
  content.append(output);
  const render = ({ result, message }) => {
    output.replaceChildren();
    const line = text => { const p = document.createElement('p'); p.textContent = text; output.append(p); };
    if (message) { line(message); return; }
    if (!result) { line('Draw a region to analyze.'); return; }
    const { rgb, alpha, original, selected, percentage, overlaps, affected, added, removed } = result;
    line(`Original reference: ${original} pixels. Current selection: ${selected} pixels.`);
    line(rgb ? `Average pixel color: RGB(${rgb.join(', ')}), #${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}. Mean opacity: ${(alpha * 100).toFixed(1)}%.` : 'Average pixel color: no opaque pixels in the selection.');
    if (rgb) { const swatch = document.createElement('div'); swatch.style.cssText = `height:28px;border:1px solid currentColor;background:rgb(${rgb.join(',')})`; output.append(swatch); }
    line(`Combined secondary coverage of original: ${percentage === null ? 'N/A' : percentage.toFixed(2) + '%'}. Overlaps count once.`);
    overlaps.forEach((count, i) => line(`Region ${i + 2} (${analysis.regions[i + 1]?.operation}): ${original ? (100 * count / original).toFixed(2) + '%' : 'N/A'} of original; ${affected[i]} pixels changed when applied.`));
    line(`Net added outside original: ${added} pixels. Net removed from original: ${removed} pixels.`);
    line('Areas count pixel centers, including transparent pixels. RGB is alpha-weighted in sRGB. Add/Subtract apply in drawing order.');
  };
  analysis.render = render;
  content.cleanup = () => { if (analysis.render === render) analysis.render = null; };
  render(analysis.latest || {});
}
