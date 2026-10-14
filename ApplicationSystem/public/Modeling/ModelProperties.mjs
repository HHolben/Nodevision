// Nodevision/ApplicationSystem/public/Modeling/ModelProperties.mjs
// These keyboard-accessible controls operate on the editor's shared selection. Parameter and material controls invoke the same action service as menu and terminal commands.
export function mountModelProperties(container,api,run) {
  const root=document.createElement('div');root.dataset.modelProperties='';container.append(root);let selectedId='';
  const label=(text,node,parent=root)=>{const l=document.createElement('label');l.style.cssText='display:flex;align-items:center;gap:5px;margin:4px 0;flex-wrap:wrap';l.append(text,node);parent.append(l);return node;};
  const input=(text,value,onchange,type='number',parent=root)=>{const n=document.createElement('input');n.type=type;n.value=value;n.style.cssText='width:90px;min-width:0';n.step='any';n.setAttribute('aria-label',text);n.onchange=()=>onchange(type==='number'?Number(n.value):n.value);return label(text,n,parent);};
  function render(){
    const node=api.selection()[0];if(root.contains(document.activeElement)&&selectedId===node?.uuid)return;selectedId=node?.uuid;root.replaceChildren();
    if(!node){root.textContent='Select an object to edit its properties.';return;}
    if(api.selection().length>1){root.textContent=api.selection().length+' selected — transforms use a shared pivot.';return;}
    input('Name',node.name,value=>run('rename',{name:value}),'text');
    for(const [key,title] of [['position','Position'],['rotation','Rotation °'],['scale','Scale']]){
      const values=['x','y','z'].map(a=>key==='rotation'?node.rotation[a]*180/Math.PI:node[key][a]);
      const row=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=title;row.append(legend);root.append(row);
      ['X','Y','Z'].forEach((a,i)=>input(a,Number(values[i].toFixed(5)),value=>{values[i]=value;run('properties',{[key]:values});},'number',row));
    }
    const primitive=node.userData.nvPrimitive;
    if(primitive){const field=document.createElement('fieldset');field.append('Primitive parameters');root.append(field);
      Object.entries(primitive.params).forEach(([key,value])=>{if(typeof value==='boolean'){const n=document.createElement('input');n.type='checkbox';n.checked=value;n.onchange=()=>run('parameters',{params:{[key]:n.checked}});label(key,n,field);}else input(key,value,v=>run('parameters',{params:{[key]:v}}),'number',field);});
    }
    const material=Array.isArray(node.material)?node.material[0]:node.material;
    if(material){const field=document.createElement('fieldset');field.append('Material (all slots)');root.append(field);
      if(material.color)input('Base color','#'+material.color.getHexString(),color=>run('material',{color}),'color',field);
      for(const key of ['metalness','roughness','opacity'])if(key in material){const n=input(key,material[key],v=>run('material',{[key]:v}),'number',field);n.min='0';n.max='1';n.step='.05';}
      input('Catalog material ID',material.userData.nvMaterialId||'',catalog=>run('material',{catalog}),'text',field);
      input('Texture /Notebook/…','',texture=>run('material',{texture}),'text',field);
      if(material.map){for(const key of ['repeat','offset'])['x','y'].forEach((axis,i)=>input(key+' '+axis,material.map[key][axis],value=>{const array=material.map[key].toArray();array[i]=value;run('material',{[key]:array});},'number',field));input('Texture rotation °',material.map.rotation*180/Math.PI,rotation=>run('material',{rotation}),'number',field);}
    }
  }
  render();return{render,dispose:()=>root.remove()};
}
