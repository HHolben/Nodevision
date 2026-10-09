// Nodevision/scripts/application-zoom-browser.mjs
// This fixture verifies blank-toolbar deselection and independent whole-editor zoom, including active-panel isolation, toolbar controls, iframe forwarding, reset, and cleanup using the real selection and routing modules.
import { clearActivePanelSelection, activatePanelCell } from '/panels/workspaceParts/workspaceActivePanels.mjs';
import { installToolbarPanelDeselection } from '/panels/toolbarPanelDeselection.mjs';
import { getApplicationZoomOwner, disposeApplicationZoom } from '/panels/applicationZoom.mjs';
import { installPanelZoomShortcuts, routePanelZoomEvent } from '/panels/panelZoomPanParts/shortcuts.mjs';
import { getActivePanelElement } from '/panels/panelZoomPanParts/ownership.mjs';
import { getPanelZoomState, registerPanelZoomCapabilities, executePanelZoom } from '/panels/panelZoomCapabilities.mjs';
import { initToolbarWidget } from '/ToolbarJSONfiles/zoomPanControlsWidget.mjs';
const checks = [];
const ok = (value, message) => { if (!value) throw Error(message); checks.push(message); };
const wheel = (target, extra = {}) => {
  const event = new WheelEvent('wheel', { bubbles:true, cancelable:true, ctrlKey:true, deltaY:-100, ...extra });
  target.dispatchEvent(event); return event;
};
try {
  document.body.style.margin = '0';
  const shell = document.createElement('div'); shell.id = 'app-shell';
  shell.style.cssText = 'display:flex;flex-direction:column;width:100vw;height:100vh';
  shell.innerHTML = `<div id="global-toolbar" style="height:48px;flex:none"><button><span>Action</span></button><div class="empty" style="display:inline-block;width:200px;height:30px"></div></div>
<div id="sub-toolbar" style="height:36px;flex:none"></div><main style="display:flex;flex:1;min-height:0"><div class="panel-cell" data-id="editor" style="width:50%;height:100%"><div class="panel" style="height:100%"><div class="panel-toolbar" style="height:30px"><button>Tool</button><span class="gap"> </span></div><p>Editor content</p></div></div><div id="other" style="width:50%">Second panel</div></main><footer style="height:22px">Status</footer>`;
  document.body.append(shell);
  const toolbar = shell.querySelector('#global-toolbar'), sub = shell.querySelector('#sub-toolbar');
  const cell = shell.querySelector('.panel-cell'), panel = shell.querySelector('.panel'), para = panel.querySelector('p');
  let localGeometric = 1, localSemantic = 1, controlClicks = 0;
  toolbar.querySelector('button').onclick = () => controlClicks++;
  registerPanelZoomCapabilities(panel, {
    geometric(input) { localGeometric *= input.factor || 1; return true; },
    semantic(input) { localSemantic *= input.factor || 1; return true; },
    metadata: { semantic: { continuous:true } },
    getState: mode => ({ zoom:mode === 'semantic' ? localSemantic : localGeometric }),
  });
  const shortcuts = installPanelZoomShortcuts();
  const unbind = installToolbarPanelDeselection(() => clearActivePanelSelection({ announce:false }));
  cell.addEventListener('click', () => activatePanelCell(cell, { announce:false }));
  activatePanelCell(cell, { announce:false });
  const widget = document.createElement('div'); toolbar.append(widget); initToolbarWidget(widget);
  toolbar.querySelector('button span').click();
  ok(getActivePanelElement() === panel && controlClicks === 1, 'Toolbar controls preserve panel selection and action');
  toolbar.querySelector('.empty').click();
  ok(getActivePanelElement() === null && !cell.classList.contains('active-panel') && window.activeCell === null && !window.__nvActivePanelElement && !window.__nvLastActiveZoomPanPanel, 'Blank toolbar clears active selection and cached panel references');
  const beforeLocal = [localGeometric, localSemantic];
  const owner = getApplicationZoomOwner(), width = shell.offsetWidth;
  const rendered = shell.getBoundingClientRect().width;
  ok(wheel(para, { altKey:true }).defaultPrevented, 'No-panel geometric wheel is handled even over panel content');
  const g = getPanelZoomState(owner).zoom;
  ok(g > 1 && shell.offsetWidth === width && Math.abs(shell.getBoundingClientRect().width / rendered - g) < .01, 'Whole-editor magnification preserves layout and scales the full shell');
  const savedGeometry = g;
  wheel(toolbar);
  ok(getPanelZoomState(owner, 'semantic').zoom > 1 && getPanelZoomState(owner).zoom === savedGeometry && shell.offsetWidth < width, 'Whole-editor semantic zoom reflows independently');
  ok(localGeometric === beforeLocal[0] && localSemantic === beforeLocal[1], 'Global zoom does not mutate individual panel zoom');
  const state = [getPanelZoomState(owner).zoom, getPanelZoomState(owner, 'semantic').zoom];
  para.click();
  ok(getActivePanelElement() === panel, 'Clicking content selects the panel again');
  wheel(para, { altKey:true });
  ok(localGeometric > 1 && getPanelZoomState(owner).zoom === state[0], 'Reselected panel receives geometric zoom without changing global zoom');
  panel.querySelector('.gap').click();
  ok(getActivePanelElement() === null, 'Blank panel toolbar clears selection without bubbling reactivation');
  sub.tabIndex = 0;
  activatePanelCell(cell, { announce:false }); sub.click();
  ok(getActivePanelElement() === null, 'Blank sub-toolbar also deselects');
  ok(widget.querySelector('[data-nv-zp-panel]').textContent === 'Entire editor', 'Zoom toolbar identifies whole-editor scope');
  const old = getPanelZoomState(owner).zoom;
  widget.querySelector('[data-nv-zp-action="zoom-in"]').click();
  ok(getPanelZoomState(owner).zoom > old && getActivePanelElement() === null, 'Toolbar zoom controls target the entire editor when deselected');
  const mode = widget.querySelector('[aria-label="Panel zoom mode"]');
  mode.value = 'semantic'; mode.dispatchEvent(new Event('change'));
  const reading = getPanelZoomState(owner, 'semantic').zoom;
  widget.querySelector('[aria-label="Increase panel zoom detail or scale"]').click();
  ok(getPanelZoomState(owner, 'semantic').zoom > reading, 'Mode controls support whole-editor semantic zoom');
  const forwarded = new WheelEvent('wheel', { ctrlKey:true, altKey:true, deltaY:-20, cancelable:true });
  const iframe = document.createElement('iframe'); panel.append(iframe);
  ok(routePanelZoomEvent(forwarded, { target:iframe, clientX:200, clientY:200 }), 'Forwarded iframe wheel also targets the whole editor without a selection');
  const key = new KeyboardEvent('keydown', { bubbles:true, cancelable:true, ctrlKey:true, altKey:true, key:'0' });
  toolbar.dispatchEvent(key);
  ok(getPanelZoomState(owner).zoom === 1 && getPanelZoomState(owner, 'semantic').zoom > 1, 'Keyboard geometric reset preserves semantic scale');
  toolbar.dispatchEvent(new KeyboardEvent('keydown', { bubbles:true, cancelable:true, ctrlKey:true, key:'0' }));
  ok(getPanelZoomState(owner, 'semantic').zoom === 1, 'Keyboard semantic reset restores reading layout');
  ok(!wheel(toolbar, { ctrlKey:false, shiftKey:true }).defaultPrevented, 'Unmodified Shift-wheel remains ordinary scrolling');
  unbind(); shortcuts.dispose(); disposeApplicationZoom();
  ok(!document.querySelector('[data-nv-application-zoom-viewport]') && shell.parentElement === document.body && shell.style.transform === '', 'Cleanup restores the original shell and removes wrappers');
  document.querySelector('#result').textContent = `PASS: ${checks.length} application zoom checks\n${checks.join('\n')}`;
} catch (error) { document.querySelector('#result').textContent = 'FAIL: ' + error.stack; }
