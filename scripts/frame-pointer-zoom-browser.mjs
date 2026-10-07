// Nodevision/scripts/frame-pointer-zoom-browser.mjs
// This regression measures the parent-screen location of a fixed iframe coordinate before and after geometric wheel and keyboard zoom, including reflow scale, borders, nested owners, and nonzero scroll offsets.
import { executePanelZoom, getPanelZoomState } from '/panels/panelZoomCapabilities.mjs';
export async function checkFramePointerZoom({ owner, iframe, wheel, tick, ok }) {
  const doc=iframe.contentDocument, viewport=iframe.contentWindow, target=doc.body || doc.documentElement;
  const reading=getPanelZoomState(owner,'semantic')?.zoom;
  const width=viewport.innerWidth, height=viewport.innerHeight;
  const source=doc.documentElement.outerHTML;
  executePanelZoom(owner,'geometric',{action:'set',zoom:3});
  owner.scrollLeft=57;owner.scrollTop=31;viewport.scrollTo(0,157);await tick();
  const scroll={x:viewport.scrollX,y:viewport.scrollY};
  const point={x:Math.min(137,width*.4),y:Math.min(91,height*.4)};
  const screen=()=>{const rect=iframe.getBoundingClientRect();return {x:rect.left+(point.x+iframe.clientLeft)*rect.width/iframe.offsetWidth,y:rect.top+(point.y+iframe.clientTop)*rect.height/iframe.offsetHeight,rect:[rect.left,rect.top,rect.width,rect.height],owner:[owner.scrollLeft,owner.scrollTop,owner.offsetWidth,owner.offsetHeight],window:[window.scrollX,window.scrollY],style:iframe.style.transform};};
  const anchored=async(before,label)=>{await tick();const after=screen();ok(Math.abs(before.x-after.x)<.8 && Math.abs(before.y-after.y)<.8,label+': '+JSON.stringify({before,after}));ok(viewport.innerWidth===width && viewport.innerHeight===height,'geometric anchor cannot resize iframe viewport');ok(viewport.scrollX===scroll.x && viewport.scrollY===scroll.y,'geometric anchor preserves document scroll');};
  for (const delta of [-150,-90,120,80,600,400]) {
    const before=screen();wheel(target,{altKey:delta!==-90,fn:delta===-90,deltaY:delta,clientX:point.x,clientY:point.y});await anchored(before,'wheel anchor stays under pointer');
  }
  const before=screen();
  target.dispatchEvent(new viewport.MouseEvent('pointermove',{bubbles:true,clientX:point.x,clientY:point.y}));
  target.dispatchEvent(new viewport.KeyboardEvent('keydown',{bubbles:true,cancelable:true,ctrlKey:true,altKey:true,key:'+'}));
  await anchored(before,'keyboard geometric zoom uses remembered pointer');
  const toolbarBefore=screen();executePanelZoom(owner,'geometric',{action:'zoom',factor:1.1});await anchored(toolbarBefore,'toolbar geometric zoom uses remembered content pointer');
  ok(doc.documentElement.outerHTML===source && getPanelZoomState(owner,'semantic')?.zoom===reading,'pointer zoom leaves source and reading scale unchanged');
  executePanelZoom(owner,'geometric',{action:'reset'});await tick();
  ok(getPanelZoomState(owner).zoom===1 && iframe.style.transform==='translate(0px, 0px) scale(1)','reset restores magnification and pan');
}
