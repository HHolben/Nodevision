// Nodevision/ApplicationSystem/tests/grayscaleAnalysisBrowser.mjs
// These integration checks exercise live grayscale controls, image-coordinate composition, persistence, and overlay lifecycle through the actual raster viewport and worker. All fixtures are decoded by the browser, including both JPEG extension variants and alpha PNG.
import { mountImageViewport } from '/PanelInstances/ViewPanels/FileViewers/ImageViewport.mjs';
import { installPngAnalysisTools } from '/RasterAnalysis/PngAnalysisTools.mjs';
import { getActiveAnalysisTools } from '/RasterAnalysis/AnalysisToolsContext.mjs';
import GrayscaleAnalysis from '/ToolbarCallbacks/view/GrayscaleAnalysis.mjs';
import { createPanel } from '/PanelInstances/InfoPanels/PngAnalysis.mjs';
import { assert, pointer } from './vectorDrawingBrowser.mjs';
const near = (a,b) => Math.abs(a-b)<.001;
const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
async function until(fn) { for (let i=0;i<200;i++) { if(fn()) return; await new Promise(r=>setTimeout(r,10)); } throw new Error('Timed out: '+fn); }

export async function run() {
  const passed=[];
  try {
    const global=document.createElement('div');global.id='global-toolbar';global.style.display='none';
    const toolbar=document.createElement('div');toolbar.id='sub-toolbar';document.body.append(global,toolbar);
    await (await import('/panels/createToolbar.mjs')).createToolbar();
    const entries=await fetch('/ToolbarJSONfiles/viewToolbar.json').then(r=>r.json());
    assert(entries.some(e=>e.parentHeading==='Analysis Tools'&&e.heading==='Grayscale Analysis'),'View menu registration');
    for (const filename of ['opaque.png','alpha.PNG','photo.JPG','photo.jpeg']) {
      console.log('GRAYSCALE TEST ' + filename);
      const host=document.createElement('div');host.className='panel';host.style.cssText='width:600px;height:400px;position:relative';document.body.append(host);
      window.__nvActivePanelElement=host;window.activeCell=host;
      const img=new Image();img.src='/Notebook/'+filename;await img.decode();
      const viewport=mountImageViewport(host,img);let analysis,panel,releasePanel;
      const factory=async (_name,_id,_type,vars)=>{
        analysis=vars.analysis;panel=document.createElement('div');panel.dataset.testResults='';
        panel.style.cssText='position:absolute;background:white;color:black;overflow:auto;box-sizing:border-box';
        createPanel(panel,vars,panel);releasePanel=panel.cleanup;return {panel};
      };
      let dispose=installPngAnalysisTools(host,viewport,filename,factory);
      const context=getActiveAnalysisTools();if(!context.visible)context.toggle();await until(()=>context.visible);
      GrayscaleAnalysis();await until(()=>analysis?.layerResults.some(r=>r.available));
      const store=analysis.analysisLayers, gray=store.layers.find(l=>l.type==='grayscale'), intersection=store.layers.find(l=>l.type==='intersection');
      const result=id=>analysis.layerResults.find(r=>r.id===id);
      const canvas=id=>host.querySelector(`canvas[data-analysis-layer="${id}"]`);
      const row=()=>panel.querySelector(`[data-analysis-layer-id="${gray.id}"]`);
      const input=(key,value)=>{const el=row().querySelector(`input[type=number][data-threshold=${key}]`);el.value=value;el.dispatchEvent(new Event('input'));};
      assert(result(gray.id).eligible===(filename==='alpha.PNG'?9500:9600),'eligible pixels '+filename);
      input('lower',15.25);input('upper',40.5);
      await until(()=>result(gray.id)?.count===(filename==='alpha.PNG'?4700:4800));
      assert(gray.config.lower===15.25&&gray.config.upper===40.5,'decimal controls');
      const slider=row().querySelector('input[type=range][data-threshold=upper]');slider.value='40';slider.dispatchEvent(new Event('input'));
      assert(gray.config.upper===40&&row().querySelector('input[type=number][data-threshold=upper]').value==='40','slider synchronizes numeric field');
      const click=label=>{const button=[...toolbar.querySelectorAll('button')].find(b=>b.textContent===label);assert(button,label);button.click();};
      const svg=host.querySelector('[data-png-analysis-overlay]');
      click('Region');for(const [x,y] of [[0,20],[120,20],[120,60],[0,60]])pointer(svg,'pointerdown',x,y);
      host.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      await until(()=>result(intersection.id)?.regionCount===4800);
      assert(result(intersection.id).count===2400&&result(intersection.id).regionPercentage===50,'polygon AND measurement');
      const savedRegion=JSON.stringify(analysis.regions);
      for(const [mode,value] of [['binary','255,255,255,255'],['highlight','255,204,0,115'],['isolate','0,0,0,0']]) {
        const select=row().querySelector('select');select.value=mode;select.dispatchEvent(new Event('change'));
        await until(()=>String(canvas(gray.id)?.getContext('2d').getImageData(20,20,1,1).data)===value);
        assert(result(gray.id).count===(filename==='alpha.PNG'?4700:4800),'display mode leaves mask unchanged');
      }
      store.update(gray.id,{visible:false});input('lower',30);await until(()=>result(gray.id).count===0);
      store.update(gray.id,{visible:true});
      await until(()=>canvas(gray.id).getContext('2d').getImageData(20,20,1,1).data[3]===200);
      assert(JSON.stringify(analysis.regions)===savedRegion,'thresholds preserve polygon');
      input('lower',15);await until(()=>result(intersection.id).regionPercentage===50);
      store.update(gray.id,{enabled:false});await until(()=>result(intersection.id).count===null);
      store.update(gray.id,{enabled:true});await until(()=>result(intersection.id).regionPercentage===50);
      store.move(gray.id,2);await frame();assert(result(intersection.id).regionPercentage===50,'visual ordering independent');
      const second=store.add('grayscale',{lower:20,upper:30,color:'#00ff00',opacity:.5},'Second band');
      store.update(intersection.id,{config:{inputs:[gray.id,second.id,'regions']}});
      await until(()=>result(second.id)?.count===(filename==='alpha.PNG'?4700:4800)&&canvas(second.id));
      for(const zoom of [.5,1,4]) {
        viewport.command({action:'set',zoom});viewport.command({action:'pan',dx:17,dy:-11});viewport.state.angle=37;viewport.render();host.style.width='570px';await frame();
        const a=img.getBoundingClientRect(),b=canvas(gray.id).getBoundingClientRect();
        assert(near(a.x,b.x)&&near(a.y,b.y)&&near(a.width,b.width)&&near(a.height,b.height),'mask transform alignment '+JSON.stringify({a:a.toJSON(),b:b.toJSON(),image:img.style.cssText,overlay:canvas(gray.id).style.cssText,hidden:canvas(gray.id).hidden}));
        const c=canvas(second.id).getBoundingClientRect();assert(near(a.x,c.x)&&near(a.y,c.y)&&near(a.width,c.width),'multiple masks aligned');
        const p=new DOMPoint(20,20).matrixTransform(svg.getScreenCTM());
        const hit=document.elementFromPoint(p.x,p.y);assert(hit!==canvas(gray.id),'mask does not intercept input');
      }
      store.update(second.id,{enabled:false});await until(()=>result(intersection.id).count===null);
      store.remove(second.id);store.update(intersection.id,{config:{inputs:[gray.id,'regions']}});
      await until(()=>result(intersection.id).regionPercentage===50);
      click('Circle');pointer(svg,'pointerdown',60,40);pointer(svg,'pointermove',80,40);pointer(svg,'pointerup',80,40);click('Analyze annotation');
      await until(()=>analysis.regions[0]?.geometry?.kind==='circle'&&result(intersection.id)?.regionCount===1264);
      assert(result(intersection.id).regionPercentage===50,'circle AND measurement');
      const config=JSON.stringify(store.layers), geometry=JSON.stringify(analysis.regions), annotations=JSON.stringify(analysis.annotations);
      const unrelated=document.createElement('div');unrelated.className='panel';document.body.append(unrelated);
      window.__nvActivePanelElement=unrelated;window.activeCell=unrelated;window.dispatchEvent(new CustomEvent('activePanelChanged'));
      assert(!getActiveAnalysisTools(),'unrelated panel ownership');
      window.__nvActivePanelElement=host;window.activeCell=host;window.dispatchEvent(new CustomEvent('activePanelChanged'));unrelated.remove();
      assert(JSON.stringify(store.layers)===config,'panel switch preserves layers');
      releasePanel();dispose();assert(!host.querySelector('canvas[data-analysis-layer]'),'dispose releases overlays');
      dispose=installPngAnalysisTools(host,viewport,filename,factory);await until(()=>analysis?.layerResults.some(r=>r.id===intersection.id&&r.count===632));
      assert(JSON.stringify(analysis.layers)===config&&JSON.stringify(analysis.regions)===geometry&&JSON.stringify(analysis.annotations)===annotations,'editing-context restoration');
      analysis.analysisLayers.remove(gray.id);await until(()=>result(intersection.id).count===null);
      assert(analysis.regions[0].geometry.kind==='circle','layer removal preserves region');
      passed.push(filename+': thresholds, modes, polygon/circle AND, transforms, lifecycle, restoration');
      releasePanel();dispose();viewport.command({action:'reset'});host._dispose();host.remove();
    }
    console.log('GRAYSCALE TEST editor');
    await (await import('./grayscaleEditorBrowser.mjs')).runEditorChecks(passed);
    // Leave a live, populated panel for responsive layout and screenshot inspection.
    const host=document.createElement('div');host.className='panel';host.style.cssText='width:100%;height:360px';document.body.append(host);window.__nvActivePanelElement=host;window.activeCell=host;
    const img=new Image();img.src='/Notebook/alpha.PNG';await img.decode();const view=mountImageViewport(host,img);
    let panel,analysis;installPngAnalysisTools(host,view,'preview.png',async(_n,_i,_t,vars)=>{analysis=vars.analysis;panel=document.createElement('div');createPanel(panel,vars,panel);return{panel};});
    GrayscaleAnalysis();await until(()=>analysis?.layerResults.some(r=>r.available));
    analysis.analysisLayers.update(analysis.layers.find(l=>l.type==='grayscale').id,{config:{lower:15,upper:40}});
    window.checkGrayscaleLayout=async width=>{
      toolbar.style.display='none';panel.style.cssText=`position:relative;width:${Math.min(width,440)}px;max-width:100%;height:510px;overflow:auto;padding:12px;box-sizing:border-box;background:white;color:black`;
      await frame();assert(panel.scrollWidth<=panel.clientWidth,'panel has no horizontal overflow');
      for(const input of panel.querySelectorAll('input,select')){const a=input.getBoundingClientRect(),b=panel.getBoundingClientRect();assert(a.left>=b.left&&a.right<=b.right,'control fits panel');}
    };
    return {ok:true,passed};
  } catch(error){return{ok:false,passed,error:error.stack};}
}
