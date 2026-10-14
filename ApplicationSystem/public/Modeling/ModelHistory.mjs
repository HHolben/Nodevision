// Nodevision/ApplicationSystem/public/Modeling/ModelHistory.mjs
// This history stores scene-node records and immutable geometry/material references, never glTF exports. Each drag captures one transaction, and rollback restores the original parent order and shared selection owner.
export function createModelHistory(host) {
  const past=[],future=[],resources=new Set();let pending=null;
  function capture() {
    const nodes=[];host.root().traverse(node=>{
      if(node===host.root()||node.userData.nvBoneDisplay)return;
      const record={node,parent:node.parent,index:node.parent.children.indexOf(node),name:node.name,visible:node.visible,
        position:node.position.clone(),quaternion:node.quaternion.clone(),scale:node.scale.clone(),data:structuredClone(node.userData),geometry:node.geometry,material:node.material};
      if(record.geometry)resources.add(record.geometry);for(const m of [].concat(record.material||[])){resources.add(m);for(const value of Object.values(m))if(value?.isTexture)resources.add(value);}
      nodes.push(record);
    });return{nodes,selected:[...host.selected()]};
  }
  function restore(snapshot) {
    const current=[];host.root().traverse(n=>{if(n!==host.root()&&!n.userData.nvBoneDisplay)current.push(n);});current.forEach(n=>n.removeFromParent());
    for(const r of snapshot.nodes){r.parent.add(r.node);Object.assign(r.node,{name:r.name,visible:r.visible,userData:structuredClone(r.data)});r.node.position.copy(r.position);r.node.quaternion.copy(r.quaternion);r.node.scale.copy(r.scale);if(r.geometry)r.node.geometry=r.geometry;if(r.material)r.node.material=r.material;}
    host.refresh(snapshot.selected);
  }
  function begin(label){if(pending)throw new Error('Finish or cancel the current operation first');pending={label,before:capture()};}
  function commit(){if(!pending)return;const entry={...pending,after:capture()};pending=null;past.push(entry);future.length=0;if(past.length>100)past.shift();host.refresh([...host.selected()]);}
  function cancel(){if(!pending)return;const before=pending.before;pending=null;restore(before);}
  return {begin,commit,cancel,get pending(){return Boolean(pending);},
    run(label,action){begin(label);try{const result=action();commit();return result;}catch(error){cancel();throw error;}},
    undo(){if(pending){cancel();return;}const e=past.pop();if(e){restore(e.before);future.push(e);}},
    redo(){if(pending)return;const e=future.pop();if(e){restore(e.after);past.push(e);}},
    dispose(){pending=null;past.length=future.length=0;for(const r of resources)r.dispose?.();resources.clear();}
  };
}
