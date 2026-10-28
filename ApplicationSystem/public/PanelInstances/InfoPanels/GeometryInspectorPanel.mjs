// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GeometryInspectorPanel.mjs
// This dockable information panel presents read-only geometry measurements from the active SVG editor or viewer. Its lifecycle uses the existing workspace panel cleanup and persistence mechanisms.
import { observeGeometryInspector } from '../../SvgGeometry/InspectorController.mjs';
export function setupPanel(panel) {
  panel.cleanup?.();panel.replaceChildren();
  Object.assign(panel.style,{padding:'12px',overflow:'auto',boxSizing:'border-box',font:'13px system-ui',minWidth:'0'});
  panel.dataset.nvGeometryInspector='true';
  const title=document.createElement('h3');title.textContent='Geometry Inspector';title.style.margin='0 0 12px';panel.append(title);
  const content=document.createElement('div');content.setAttribute('aria-live','polite');panel.append(content);
  const format=(value,unit)=>value===null||!Number.isFinite(value)?'Unavailable':`${new Intl.NumberFormat(undefined,{maximumSignificantDigits:7}).format(value)} ${unit}`;
  const stop=observeGeometryInspector(state=>{
    content.replaceChildren();
    if(state.count!==1){content.textContent=state.count?`${state.count} objects selected. Select one object to inspect its geometry.`:'Select an SVG object to inspect its geometry.';return;}
    const {element,measurement:m,order}=state;
    const name=document.createElement('p');name.textContent=element.getAttribute('data-element-name')||element.getAttribute('data-layer-name')||element.id||'Unnamed object';content.append(name);
    const rows=[['SVG element',element.localName],['Enclosed Area',format(m.area,m.units.area)],[m.lengthLabel,format(m.length,m.units.length)],['X Dimension',format(m.width,m.units.length)],['Y Dimension',format(m.height,m.units.length)],['Position',order.position?`${order.position} / ${order.total}`:'Unavailable']];
    if(order.parent)rows.push(['Within parent group',order.parent]);rows.push(['Units',m.units.name]);
    const list=document.createElement('dl');Object.assign(list.style,{display:'grid',gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)',gap:'8px'});
    for(const [label,value] of rows){const key=document.createElement('dt'),val=document.createElement('dd');key.textContent=label;val.textContent=value;Object.assign(val.style,{margin:'0',fontWeight:'600',overflowWrap:'anywhere',fontVariantNumeric:'tabular-nums'});list.append(key,val);}
    content.append(list);
    const note=document.createElement('p');note.textContent=`${m.note} Bounds exclude stroke, markers, clipping, masks and filters. Curved measurements are numerical approximations independent of canvas zoom.`;note.style.opacity='.75';content.append(note);
  });
  let cleaned=false;
  const cleanup=()=>{if(cleaned)return;cleaned=true;stop();disconnect.disconnect();if(panel.cleanup===cleanup)panel.cleanup=null;};
  const disconnect=new MutationObserver(()=>{if(!panel.isConnected)cleanup();});disconnect.observe(document.body,{childList:true,subtree:true});
  panel.cleanup=cleanup;return cleanup;
}
