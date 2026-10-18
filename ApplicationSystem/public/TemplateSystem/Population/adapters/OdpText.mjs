// Nodevision/ApplicationSystem/public/TemplateSystem/Population/adapters/OdpText.mjs
// Text replacement retains frame and paragraph properties and consistently uses the first character span style for each new paragraph.
import {NS,is} from './OdpXml.mjs';
export function replaceOdpText(box,value) {
  const doc=box.ownerDocument;
  const first=Array.from(box.children).find(node=>is(node,'text','p')||is(node,'text','h'));
  const prototype=first?.cloneNode(false)||doc.createElementNS(NS.text,'text:p');
  const styles=[];
  let node=first;
  while(node) {
    node=Array.from(node.children).find(child=>is(child,'text','span'));
    if(node)styles.push(node.cloneNode(false));
  }
  const paragraphs=value.replace(/\r\n?/g,'\n').split('\n').map((line,index)=>{
    const p=prototype.cloneNode(false);let target=p;
    // Do not duplicate IDs when one paragraph becomes several.
    if(index)p.removeAttributeNS('http://www.w3.org/XML/1998/namespace','id');
    for(const style of styles){const span=style.cloneNode(false);if(index)span.removeAttributeNS('http://www.w3.org/XML/1998/namespace','id');target.append(span);target=span;}
    for(const part of line.split(/( +|\t)/)) {
      if(!part)continue;
      if(part==='\t'){target.append(doc.createElementNS(NS.text,'text:tab'));continue;}
      if(/^ +$/.test(part)){const space=doc.createElementNS(NS.text,'text:s');space.setAttributeNS(NS.text,'text:c',String(part.length));target.append(space);continue;}
      target.append(doc.createTextNode(part));
    }
    return p;
  });
  box.replaceChildren(...paragraphs);
}
