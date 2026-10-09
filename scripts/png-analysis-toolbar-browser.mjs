// Nodevision/scripts/png-analysis-toolbar-browser.mjs
// This regression drives the real toolbar renderer and callback loader repeatedly to catch duplicate analysis widgets created inside the View dropdown.
import { createToolbar } from '/panels/actualCreateToolbar.mjs';
import { registerAnalysisTools } from '/RasterAnalysis/AnalysisToolsContext.mjs';
const tick = () => new Promise(resolve => setTimeout(resolve, 30));
const ok = (value, message) => { if (!value) throw Error(message); };
try {
  window.NodevisionState = { currentMode: 'PNGediting' };
  const panel = document.createElement('div'); panel.className='panel'; document.body.append(panel); window.activeCell=panel;
  let calls=0, visible=false;
  const release=registerAnalysisTools(panel,{id:'test-analysis',get visible(){return visible;},toggle(){visible=!visible;calls++;}});
  await createToolbar();
  const view=document.querySelector('#global-toolbar [data-heading="View"] > button');ok(view,'View button exists');view.click();await tick();
  const entry=document.querySelector('[data-toolbar-dropdown="true"] [data-heading="Analysis Tools"]');ok(entry,'Analysis Tools menu entry exists');
  const button=entry.querySelector('button');
  for(let i=0;i<6;i++) {
    button.click();
    for(let retry=0;retry<50&&calls!==i+1;retry++) await tick();
    ok(calls===i+1,'one callback per click');ok(visible===Boolean((i+1)%2),'subtoolbar toggles');
    ok(entry.querySelectorAll('button').length===1,'no extra buttons below entry');
    ok(!document.querySelector('#sub-toolbar').textContent.includes('Analysis Tools'),'no duplicate automatic subtoolbar');
  }
  release();panel.remove();document.querySelector('#result').textContent='PASS: real View dropdown repeated clicks keep one Analysis Tools button and invoke one toggle';
} catch(error) { document.querySelector('#result').textContent='FAIL: '+error.stack; }
