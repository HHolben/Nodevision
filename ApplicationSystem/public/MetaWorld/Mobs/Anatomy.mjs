// Pure, reusable session condition processor. No AI, model, document or event ownership.
export function createAnatomy(schema,targetId){
 const parts=new Map(),seen=new Set(),errors=[];let lastHit=null,revision=0,current;
 if(!schema?.parts?.length)throw Error('Anatomy requires parts');
 for(const p of schema.parts){if(!p.id||parts.has(p.id)||!(p.maxCondition>0)||p.hitRegion?.shape!=='box'||p.position?.length!==3||p.bounds?.length!==3||!p.position.every(Number.isFinite)||!p.bounds.every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid anatomical definition');parts.set(p.id,{definition:p,condition:p.maxCondition});}
 for(const {definition:p} of parts.values())if(p.parent&&!parts.has(p.parent))throw Error('Unknown anatomical parent');
 const fail=message=>{errors.push(message);if(errors.length>8)errors.shift();return {applied:false,error:message};};
 function calculate(){
  const capabilities={},conditions={};let total=0,asymmetry=0,locomotors=0,functionalLocomotors=0;
  for(const [id,s] of parts){const p=s.definition,n=s.condition/p.maxCondition,capacity=n<=p.response.disabledBelow?0:n**p.response.exponent;
   conditions[id]={condition:s.condition,maximum:p.maxCondition,capacity,enabled:capacity>0};total+=1-n;
   for(const [key,weight] of Object.entries(p.contributions)){capabilities[key]??=1;capabilities[key]-=weight*(1-capacity);}
   asymmetry+=(p.lateral||0)*(p.contributions.propulsion||0)*(1-capacity);
   if(p.locomotor){locomotors++;if(capacity>0)functionalLocomotors++;}
  }
  for(const key of Object.keys(capabilities))capabilities[key]=Math.max(0,Math.min(1,capabilities[key]));
  const v=schema.viability||{},dead=(v.fatalParts||[]).some(id=>conditions[id]?.condition===0),incapacitated=(v.incapacitatingParts||[]).some(id=>conditions[id]&&conditions[id].condition/conditions[id].maximum<=(v.incapacitatingBelow??0))||total/parts.size>=(v.cumulativeIncapacitation??1);
  const state=dead?'Dead':incapacitated?'Incapacitated':total>0?'Impaired':'Active',m=schema.movement||{};
  const mobile=!dead&&!incapacitated&&(!locomotors||functionalLocomotors>0)&&(capabilities.propulsion??1)>(m.minimumPropulsion??0)&&(capabilities.coordination??1)>(m.minimumCoordination??0);
  current={revision,state,parts:conditions,capabilities,movement:{mobile,speed:(capabilities.propulsion??1)*(.5+.5*(capabilities.endurance??1))*(.6+.4*(capabilities.coordination??1)),acceleration:capabilities.acceleration??1,jump:capabilities.jump??1,turning:(capabilities.turning??1)*(.5+.5*(capabilities.coordination??1))*(.9+.1*(capabilities.balance??1)),recovery:1+(1-(capabilities.recovery??1))*(m.recoveryPenalty??1),roll:asymmetry*(m.roll??0),sway:(1-(capabilities.balance??1))*.025,asymmetry},vitality:capabilities.vitality??1};revision++;return current;
 }
 calculate();
 return {
  get effective(){return current;},
  applyDamage(input={}){
   if(!input||typeof input!=='object'||Array.isArray(input))return fail('Invalid damage input');
   const {bodyPartId,amount,damageType,sourceId,targetId:claimed=targetId,impactPoint,impactDirection}=input;
   if(claimed!==targetId)return fail('Target identity mismatch');if(!parts.has(bodyPartId))return fail('Unknown body part');
   if(!Number.isFinite(amount)||amount<=0||amount>1)return fail('Damage amount must be in (0, 1]');
   if(typeof sourceId!=='string'||!sourceId.trim()||sourceId.length>128)return fail('Invalid damage source');
   const part=parts.get(bodyPartId),multiplier=part.definition.vulnerabilities[damageType];if(!Number.isFinite(multiplier)||multiplier<0)return fail('Unsupported damage type');
   for(const v of [impactPoint,impactDirection])if(v!==undefined&&(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)))return fail('Invalid impact vector');
   if(seen.has(sourceId))return {applied:false,duplicate:true};
   // Reject new sources at the bounded budget rather than forgetting old IDs and applying a replay.
   if(seen.size>=4096)return fail('Session damage source budget exhausted');seen.add(sourceId);
   const before=part.condition;part.condition=Math.max(0,before-amount*part.definition.maxCondition*multiplier);lastHit={bodyPartId,sourceId,damageType,amount:before-part.condition};calculate();return {applied:true,...lastHit,state:current.state};
  },
  // Caller must guard authoring permissions. Debug repair is not gameplay damage or an undo entry.
  setCondition(id,value){const part=parts.get(id);if(!part||!Number.isFinite(value)||value<0||value>part.definition.maxCondition)return fail('Invalid debug condition');part.condition=value;calculate();return {applied:true};},
  snapshot(){return {...structuredClone(current),lastHit:lastHit&&{...lastHit},errors:[...errors],processedSources:seen.size,estimatedStateBytes:parts.size*32+seen.size*256+errors.length*256};},
  dispose(){parts.clear();seen.clear();errors.length=0;lastHit=null;}
 };
}
