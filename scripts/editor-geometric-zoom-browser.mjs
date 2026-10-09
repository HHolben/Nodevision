// Nodevision/scripts/editor-geometric-zoom-browser.mjs
// These checks compare measured editor geometry and layout under Ctrl, Ctrl-Alt, and exposed Fn gestures in retained-tab ownership structures. They detect reflow masquerading as geometric magnification rather than only inspecting zoom state.
import { executePanelZoom, getPanelZoomState } from '/panels/panelZoomCapabilities.mjs';

export function tabbedEditor(panel) {
  const cell = document.createElement('div'); cell.className = 'panel-cell';
  panel.replaceWith(cell); cell.append(panel);
  const tab = document.createElement('div'); tab.className = 'nv-panel-tab-content';
  tab.style.cssText = 'width:100%;height:100%;min-height:0';
  panel.append(tab);
  cell.__nvPanelTabs = { activeTabId: 'editor', tabs: [{ tabId: 'editor', contentElement: tab }] };
  window.activeCell = cell;
  return { cell, tab };
}

export function checkHtmlGeometricZoom({ owner, content, wheel, ok }) {
  const para = content.querySelector('p');
  para.textContent = 'A sentence that wraps across the document. '.repeat(14);
  const source = content.outerHTML;
  const layoutWidth = content.offsetWidth, lineHeight = para.offsetHeight;
  const before = para.getBoundingClientRect();
  const event = wheel(para, { altKey: true });
  const factor = getPanelZoomState(owner).zoom;
  const after = para.getBoundingClientRect();
  ok(event.defaultPrevented && factor > 1, 'HTML Ctrl-Alt is handled by the active tab');
  ok(content.offsetWidth === layoutWidth && para.offsetHeight === lineHeight, 'HTML geometric magnification preserves line wrapping and layout width');
  ok(Math.abs(after.width / before.width - factor) < .01 && Math.abs(after.height / before.height - factor) < .01, 'HTML geometric zoom scales both rendered dimensions');
  ok(content.outerHTML === source, 'HTML geometric zoom preserves authored styles and text');
  wheel(para, { altKey: false });
  ok(getPanelZoomState(owner).zoom === factor && content.offsetWidth < layoutWidth, 'HTML Ctrl alone reflows reading width independently of magnification');
  const semantic = getPanelZoomState(owner, 'semantic').zoom;
  const reflowWidth = content.offsetWidth;
  wheel(para, { altKey: false, fn: true });
  ok(getPanelZoomState(owner).zoom > factor && content.offsetWidth === reflowWidth && getPanelZoomState(owner, 'semantic').zoom === semantic, 'HTML exposed Fn magnifies without semantic reflow');
  executePanelZoom(owner, 'geometric', { action: 'reset' });
  executePanelZoom(owner, 'semantic', { action: 'reset' });
}

export function checkSvgGeometricZoom({ owner, svg, wheel, ok }) {
  executePanelZoom(owner, 'geometric', { action: 'reset' });
  const shape = svg.querySelector('rect');
  const before = shape.getBoundingClientRect();
  const layoutWidth = svg.clientWidth, viewBox = svg.getAttribute('viewBox');
  const event = wheel(shape, { altKey: true });
  const zoom = getPanelZoomState(owner).zoom;
  const after = shape.getBoundingClientRect();
  ok(event.defaultPrevented && zoom > 1, 'SVG Ctrl-Alt is handled by the active tab');
  ok(svg.clientWidth === layoutWidth && svg.getAttribute('viewBox') === viewBox, 'SVG magnification preserves SVG layout viewport and viewBox');
  ok(Math.abs(after.width / before.width - zoom) < .01 && Math.abs(after.height / before.height - zoom) < .01, 'SVG artwork magnifies uniformly');
  const point = svg.createSVGPoint(); point.x = 2; point.y = 2;
  const screen = point.matrixTransform(svg.getScreenCTM());
  const restored = screen.matrixTransform(svg.getScreenCTM().inverse());
  ok(Math.abs(restored.x - 2) < .01 && Math.abs(restored.y - 2) < .01, 'SVG editing coordinates survive presentation transform');
  wheel(shape, { altKey: false });
  ok(getPanelZoomState(owner).zoom === zoom, 'SVG Ctrl semantic gesture does not magnify artwork');
  wheel(shape, { altKey: false, fn: true });
  ok(getPanelZoomState(owner).zoom > zoom && svg.clientWidth === layoutWidth, 'SVG exposed Fn uses geometric magnification');
}
