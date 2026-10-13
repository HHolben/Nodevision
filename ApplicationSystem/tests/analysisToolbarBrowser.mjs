// Nodevision/ApplicationSystem/tests/analysisToolbarBrowser.mjs
// These checks exercise analysis subtoolbar ownership, replacement, and cleanup through the real toolbar registry. They keep document controls separate and ensure stale widgets cannot operate on an inactive image.
import { registerAnalysisTools, getActiveAnalysisTools } from '/RasterAnalysis/AnalysisToolsContext.mjs';
import { showToolbarSubToolbar, hideToolbarSubToolbar } from '/panels/createToolbar.mjs';
export async function checkAnalysisToolbar() {
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 20)); };
  const sub = document.querySelector('#sub-toolbar');
  const make = label => {
    const host = document.createElement('div'); host.className = 'panel'; document.body.append(host);
    const menu = document.createElement('div'); menu.dataset.testAnalysisOwner = label;
    let releases = 0;
    const context = { mount(target) { target.append(menu); return () => { if (menu.parentElement === target) { menu.remove(); releases++; } }; } };
    const unregister = registerAnalysisTools(host, context);
    return { host, menu, unregister, context, get releases() { return releases; } };
  };
  const a = make('A'), b = make('B'), other = document.createElement('div'); other.className = 'panel'; document.body.append(other);
  function activate(host) { window.activeCell = host; window.__nvActivePanelElement = host; window.dispatchEvent(new CustomEvent('activePanelChanged')); }
  activate(a.host); showToolbarSubToolbar('Analysis Tools', {force:true,toggle:false}); await settle();
  assert(sub.contains(a.menu) && !a.host.contains(a.menu), 'Analysis Tools must mount in shared subtoolbar: ' + sub.outerHTML + '; active=' + (getActiveAnalysisTools() === a.context));
  activate(b.host); await settle();
  assert(sub.contains(b.menu) && !a.menu.isConnected && a.releases === 1, 'switching images releases previous controls');
  assert(getActiveAnalysisTools() === b.context, 'commands target active image');
  showToolbarSubToolbar('Analysis Tools', {force:true,toggle:false}); await settle();
  assert(sub.querySelectorAll('[data-test-analysis-owner]').length === 1, 'reopening does not duplicate controls');
  activate(other); await settle(); assert(!sub.querySelector('[data-test-analysis-owner]'), 'unrelated panels expose no image controls');
  activate(a.host); await settle(); assert(sub.contains(a.menu), 'returning restores image controls');
  a.unregister(); await settle(); assert(!a.menu.isConnected, 'disposing owner removes its controls');
  activate(b.host); await settle(); assert(sub.contains(b.menu), 'remaining context is usable');
  hideToolbarSubToolbar('Analysis Tools'); await settle(); assert(!b.menu.isConnected, 'toolbar replacement detaches controls');
  b.unregister(); a.host.remove(); b.host.remove(); other.remove(); window.activeCell = null; window.__nvActivePanelElement = null;
}
