// Nodevision/ApplicationSystem/public/SolderAnalysis/Report.mjs
// This module generates portable HTML reports with embedded original images, annotated outlines, measurement tables, and explicit warnings for incomplete analyses.
import { labelsFor, regionPath, contoursFor } from './Measurement.mjs';
import { colors } from './Document.mjs';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const number = value => Number.isFinite(value) ? value.toFixed(2) : '—';
export function svgImage(state, voidOnly = false) {
  const labels = labelsFor(state.regions);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${state.width} ${state.height}" width="${state.width}" height="${state.height}" role="img" aria-label="${voidOnly ? 'Void outlines only' : 'Annotated image'}"><image href="${escapeHtml(state.source.dataUrl)}" width="${state.width}" height="${state.height}"/>` + state.regions.filter(r => !voidOnly || r.type === 'void').map(r => {
    let point;
    try { point = contoursFor(r)[0]?.points[0]; } catch { return ''; }
    if (!point) return '';
    const [x, y] = point;
    return `<path d="${escapeHtml(regionPath(r))}" fill="none" stroke="${colors[r.type]}" stroke-width="1" vector-effect="non-scaling-stroke"/>` + (voidOnly ? '' : `<text x="${x}" y="${y}" fill="${colors[r.type]}" font-size="${Math.max(10, state.width / 100)}" stroke="#111" stroke-width="3" paint-order="stroke" font-family="sans-serif">${escapeHtml(labels[r.id])}</text>`);
  }).join('') + '</svg>';
}
export function measurementTable(result) {
  const row = (label, parent, type, area, rgba, percent) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(parent)}</td><td>${type}</td><td>${Number.isFinite(area) ? area : '—'}</td>${[0, 1, 2, 3].map(i => `<td>${number(rgba?.[i])}</td>`).join('')}<td>${number(percent)}</td></tr>`;
  let rows = '';
  for (const r of result.regions.filter(r => r.type === 'total')) {
    rows += row(r.label, '—', 'Total Area', r.area, r.rgba, r.voidPercentage);
    for (const c of result.regions.filter(c => c.parentId === r.id)) rows += row(c.label, r.label, 'Void Area', c.area, c.rgba, null);
    rows += row(`${r.label} void union`, r.label, 'Combined void area', r.voidArea, null, r.voidPercentage);
  }
  for (const r of result.regions.filter(r => r.type === 'void' && !result.regions.some(p => p.type === 'total' && p.id === r.parentId))) rows += row(r.label, 'Unassigned / unavailable', 'Void Area', r.area, r.rgba, null);
  rows += row('Grand total', '—', 'Total Area', result.totalArea, null, result.overallPercentage) + row('Grand void union', '—', 'Void Area', result.voidArea, null, result.overallPercentage);
  return `<table><thead><tr>${['Region ID', 'Parent', 'Region Type', 'Area (px²)', 'Mean R', 'Mean G', 'Mean B', 'Mean A', 'Void %'].map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
}
export function generateReport(state, result, date = new Date(), notes = []) {
  const labels = labelsFor(state.regions);
  const reportWarnings = [...notes, ...(result?.warnings || ['Measurements are pending or unavailable. Areas and percentages are not yet available.'])];
  if (!state.regions.length) reportWarnings.push('No regions have been drawn yet.');
  const measured = new Map((result?.regions || []).map(r => [r.id, r]));
  result = { ...result, regions: state.regions.map(r => measured.get(r.id) || { id: r.id, type: r.type, parentId: r.parentId, label: labels[r.id] }) };
  const warningSection = reportWarnings.length ? `<section id="validation"><h2>Report status: incomplete or needs review</h2><p>Available measurements are provisional. Missing values are shown as —. Invalid outlines may be omitted from images.</p><ul>${reportWarnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}</ul></section>` : '';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(state.source.name)} — Solder Joint Area Analysis</title><style>
body{font:14px system-ui,sans-serif;color:#18212b;background:white;margin:2em auto;max-width:1200px;padding:0 1em}h1{font-size:1.7em}figure{margin:1em 0}img,svg{display:block;max-width:100%;height:auto}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:.55em;border:1px solid #bbb;text-align:right}th:first-child,td:nth-child(3){text-align:left}thead{background:#e9edf1}figcaption{margin:.5em 0;color:#43505c}@media print{body{margin:0;max-width:none;font-size:10pt}figure{break-inside:avoid}h2{break-after:avoid}thead{display:table-header-group}tr{break-inside:avoid}img,svg{max-height:230mm;object-fit:contain}section{margin-bottom:1em}}
</style><header><h1>Solder Joint Area Analysis</h1><p>Source: ${escapeHtml(state.source.name)} · ${state.width} × ${state.height} pixels · ${state.regions.filter(r => r.type === 'total').length} solder joints · ${state.regions.filter(r => r.type === 'void').length} voids</p><p>Overall void percentage: <strong>${number(result.overallPercentage)}%</strong> · Generated <time>${escapeHtml(date.toISOString())}</time></p></header>${warningSection}
<section id="original"><h2>1. Original Image</h2><figure><img src="${escapeHtml(state.source.dataUrl)}" width="${state.width}" height="${state.height}" alt="Unaltered source JPEG"><figcaption>Original embedded JPEG, without annotations or recompression.</figcaption></figure></section>
<section id="annotated"><h2>2. Annotated Image</h2><figure>${svgImage(state)}<figcaption>Red: Total Area. Light blue: Void Area. Labels identify parent and child regions.</figcaption></figure></section>
<section id="measurements"><h2>3. Measurement Summary</h2>${measurementTable(result)}<p>Areas count native pixel centers using even-odd fill (left/top inclusive, right/bottom exclusive). Curves use adaptive subdivision with 0.001 px tolerance. RGBA channels use the decoded source values on the 0–255 scale; JPEG alpha is 255. Overlapping voids count once in union rows. Overall percentage is area weighted.</p></section>
<section id="void-only"><h2>4. Void Outlines Only</h2><figure>${svgImage(state, true)}<figcaption>All marked void outlines, without labels or filled annotations.</figcaption></figure></section></html>`;
}
