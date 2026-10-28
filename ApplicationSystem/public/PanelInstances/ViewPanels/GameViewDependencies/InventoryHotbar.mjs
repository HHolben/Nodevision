// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/InventoryHotbar.mjs
// This module renders matching inventory and HUD hotbar slots and binds local item drag-and-drop. Slot selection and assignment are delegated to the owning inventory so both surfaces share the same state.
const MIME = 'application/x-nodevision-inventory-item';
export function createInventoryHotbar({state, findItem, createIcon, styleSlot, selectSlot, assignSlot, canEquip}) {
  const owner = crypto.randomUUID();
  function readDrop(event) {
    try {
      const data = JSON.parse(event.dataTransfer?.getData(MIME) || 'null');
      return data?.owner === owner && canEquip(data.id) ? data.id : null;
    } catch { return null; }
  }
  function render(location) {
    const strip = document.createElement('div');
    strip.dataset.inventoryHotbar = location;
    strip.setAttribute('role','group'); strip.setAttribute('aria-label','Hotbar slots');
    Object.assign(strip.style,{display:'grid',gridTemplateColumns:'repeat(9, minmax(0, 1fr))',gap:'4px',width:'100%'});
    state.dominantSlots.forEach((id,index)=>{
      const item=findItem(id),slot=document.createElement('button');
      slot.type='button';slot.dataset.hotbarSlotIndex=String(index);
      const selected=state.activeHand==='dominant' && state.dominantSlot===index;
      styleSlot(slot,selected);
      Object.assign(slot.style,{width:'100%',minWidth:'0',minHeight:'0',aspectRatio:'1',boxSizing:'border-box',cursor:'pointer',pointerEvents:'auto',padding:'2px'});
      const label=`Slot ${index+1}: ${item?.label || 'Empty'}`;
      slot.title=label;slot.setAttribute('aria-label',label);slot.setAttribute('aria-pressed',String(selected));
      const icon=createIcon(item);icon.draggable=false;icon.style.pointerEvents='none';
      slot.append(icon);
      const number=document.createElement('span');number.textContent=String(index+1);slot.append(number);
      slot.addEventListener('click',event=>{event.stopPropagation();selectSlot(index);});
      for(const type of ['pointerdown','mousedown'])slot.addEventListener(type,event=>event.stopPropagation());
      for(const type of ['dragenter','dragover'])slot.addEventListener(type,event=>{
        if (!event.dataTransfer?.types.includes(MIME)) return;
        event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='copy';slot.style.outline='2px solid #74d4ff';
      });
      slot.addEventListener('dragleave',()=>{slot.style.outline='';});
      slot.addEventListener('drop',event=>{
        if (!event.dataTransfer?.types.includes(MIME)) return;
        event.preventDefault();event.stopPropagation();slot.style.outline='';
        const id=readDrop(event);if(id!==null)assignSlot(index,id);
      });
      strip.append(slot);
    });
    return strip;
  }
  function bindItem(cell,item) {
    cell.dataset.inventoryItemId=item.id || '';
    cell.draggable=canEquip(item.id);
    for(const image of cell.querySelectorAll('img'))image.draggable=false;
    for(const type of ['pointerdown','mousedown'])cell.addEventListener(type,event=>event.stopPropagation());
    cell.addEventListener('dragstart',event=>{
      if(!canEquip(item.id) || !event.dataTransfer){event.preventDefault();return;}
      event.stopPropagation();event.dataTransfer.effectAllowed='copy';
      event.dataTransfer.setData(MIME,JSON.stringify({owner,id:item.id}));
    });
    cell.addEventListener('dragend',()=>{
      for(const strip of document.querySelectorAll('[data-inventory-hotbar]'))for(const slot of strip.children)slot.style.outline='';
    });
  }
  return {render,bindItem};
}
