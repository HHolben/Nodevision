// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgTextGeometry.mjs
// This module renders text selection outside the saved SVG using native glyph metrics and screen matrices. Geometry is recomputed as the viewport moves so transformed and zoomed text retain aligned editing feedback.
const NS = 'http://www.w3.org/2000/svg';
export function createTextGeometry(wrapper) {
  const overlay = document.createElementNS(NS, 'svg');
  overlay.setAttribute('data-nv-editor-ui', 'text-caret');
  Object.assign(overlay.style, {position:'fixed', inset:'0', width:'100%', height:'100%', pointerEvents:'none', zIndex:'1000', overflow:'visible'});
  wrapper.append(overlay);
  function edges(element, model) {
    const matrix = element.getScreenCTM(), count = element.getNumberOfChars();
    if (!matrix) return [];
    return model.boundaries.map(offset => {
      const run = model.runs.find(r => r.node && offset >= r.start && offset < r.end) || model.runs.filter(r => r.node && r.end <= offset).at(-1);
      const index = model.glyphOffsets[offset] ?? 0;
      const ending = index >= count || (run && offset === run.end);
      const i = Math.max(0, Math.min(count - 1, ending ? index - 1 : index));
      let point, size, box, angle = 0;
      if (count) {
        point = ending ? element.getEndPositionOfChar(i) : element.getStartPositionOfChar(i);
        box = element.getExtentOfChar(i); size = box.height;
        angle = element.getRotationOfChar(i) * Math.PI / 180;
      } else {
        point = {x:element.x.baseVal[0]?.value || 0, y:element.y.baseVal[0]?.value || 0};
        size = parseFloat(getComputedStyle(element).fontSize) || 16;
      }
      const transform = (x,y) => new DOMPoint(x,y).matrixTransform(matrix);
      const top = angle === 0 && box ? transform(point.x, box.y) : transform(point.x + Math.sin(angle)*size*.8, point.y - Math.cos(angle)*size*.8);
      const bottom = angle === 0 && box ? transform(point.x, box.y + box.height) : transform(point.x - Math.sin(angle)*size*.2, point.y + Math.cos(angle)*size*.2);
      return {offset, top, bottom};
    });
  }
  function nearest(element, model, event) {
    return edges(element, model).reduce((best, p) => {
      const x=(p.top.x+p.bottom.x)/2, y=(p.top.y+p.bottom.y)/2;
      const distance=Math.hypot(event.clientX-x,event.clientY-y);
      return distance < best.distance ? {offset:p.offset,distance} : best;
    }, {offset:0,distance:Infinity}).offset;
  }
  function draw(element, model, start, end) {
    overlay.replaceChildren();
    const clip = wrapper.getBoundingClientRect();
    overlay.style.clipPath = `inset(${Math.max(0,clip.top)}px ${Math.max(0,innerWidth-clip.right)}px ${Math.max(0,innerHeight-clip.bottom)}px ${Math.max(0,clip.left)}px)`;
    const points = edges(element, model);
    if (start === end) {
      const p = points.find(p => p.offset === start); if (!p) return;
      const line = document.createElementNS(NS,'line');
      for (const [k,v] of Object.entries({x1:p.top.x,y1:p.top.y,x2:p.bottom.x,y2:p.bottom.y,stroke:'#087bda','stroke-width':1.5})) line.setAttribute(k,v);
      overlay.append(line);
      // A stable time origin prevents continuous geometry refresh from restarting the blink.
      line.style.opacity = Date.now() % 1100 < 700 ? '1' : '0';
    } else for (let i=0;i<points.length-1;i++) {
      const a=points[i], b=points[i+1];
      if (a.offset < start || b.offset > end || model.value.slice(a.offset,b.offset).includes('\n')) continue;
      const polygon=document.createElementNS(NS,'polygon');
      polygon.setAttribute('points',[a.top,b.top,b.bottom,a.bottom].map(p=>`${p.x},${p.y}`).join(' '));
      polygon.setAttribute('fill','rgba(0,120,215,.3)'); overlay.append(polygon);
    }
  }
  return {nearest, draw, clear:()=>overlay.replaceChildren(), dispose:()=>overlay.remove()};
}
