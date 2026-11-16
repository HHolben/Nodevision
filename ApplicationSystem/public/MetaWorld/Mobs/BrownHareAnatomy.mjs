// Anatomical +Z is forward, +X is the animal's left. Bounds in normalized metres.
// Rigid Rabbit adapter: vertex slices locate ears/head at +Z, haunches at -Z.
const part=(id,name,classification,position,size,contributions,extra={})=>({id,name,classification,parent:id==='torso'?null:'torso',position,bounds:size,hitRegion:{shape:'box'},maxCondition:1,response:{exponent:2,disabledBelow:.1},vulnerabilities:{piercing:1,blunt:.8,cutting:1,slashing:1},contributions,animationBinding:'rigid-body',colliderBinding:'visual-pivot',...extra});
export const brownHareAnatomy={
 parts:[
  part('torso','Torso','core',[0,.225,-.065],[.255,.27,.36],{propulsion:.15,jump:.1,acceleration:.1,endurance:.8,coordination:.1,vitality:1}),
  part('head','Head','sensory',[0,.285,.21],[.15,.16,.23],{perception:1,coordination:.75,turning:.1,endurance:.1}),
  part('tail','Tail','appendage',[0,.19,-.302],[.10,.10,.046],{balance:.04}),
  part('foreleg-left','Left Foreleg','limb',[.073,.065,.135],[.075,.13,.17],{balance:.18,turning:.28,recovery:.25},{lateral:1}),
  part('foreleg-right','Right Foreleg','limb',[-.073,.065,.135],[.075,.13,.17],{balance:.18,turning:.28,recovery:.25},{lateral:-1}),
  part('hindleg-left','Left Hind Leg','limb',[.105,.085,-.16],[.10,.17,.23],{propulsion:.4,jump:.45,acceleration:.4,recovery:.2,balance:.12},{lateral:1,locomotor:true}),
  part('hindleg-right','Right Hind Leg','limb',[-.105,.085,-.16],[.10,.17,.23],{propulsion:.4,jump:.45,acceleration:.4,recovery:.2,balance:.12},{lateral:-1,locomotor:true}),
  part('eye-left','Left Eye','sensory',[.082,.307,.215],[.035,.038,.048],{visionLeft:1},{parent:'head'}),
  part('eye-right','Right Eye','sensory',[-.082,.307,.215],[.035,.038,.048],{visionRight:1},{parent:'head'}),
  part('ear-left','Left Ear','sensory',[.042,.414,.17],[.052,.107,.075],{hearingLeft:1},{parent:'head'}),
  part('ear-right','Right Ear','sensory',[-.042,.414,.17],[.052,.107,.075],{hearingRight:1},{parent:'head'}),
  part('nose','Nose','sensory',[0,.267,.315],[.065,.049,.024],{smell:1,scentDetection:1},{parent:'head'}),
  part('tongue','Tongue','sensory',[0,.239,.276],[.036,.014,.025],{taste:1},{parent:'head',hitRegion:{shape:'box',exposed:false}})
 ],
 senses:{
  vision:[{id:'eye-left',capability:'visionLeft',yaw:80*Math.PI/180,field:180*Math.PI/180,range:10},{id:'eye-right',capability:'visionRight',yaw:-80*Math.PI/180,field:180*Math.PI/180,range:10}],
  hearing:{capabilities:['hearingLeft','hearingRight'],residual:.18,range:16,threshold:.055,obstruction:.45},
  smell:{capability:'smell',detection:'scentDetection',range:6,threshold:.12},taste:{capability:'taste',range:.3},
  verticalField:120*Math.PI/180,behavior:{soundAlert:.15,soundFlee:.3,visualFleeDistance:5,memory:1.5},eyeHeight:.31,maxSignals:8
 },
 viability:{fatalParts:['torso'],incapacitatingParts:['head'],incapacitatingBelow:.08,cumulativeIncapacitation:.72},
 movement:{minimumPropulsion:.12,minimumCoordination:.12,roll:.10,recoveryPenalty:1.5},
 arrowDamage:.38
};
// One immutable species schema, never copied into authored instances.
function freeze(o){Object.values(o).forEach(v=>{if(v&&typeof v==='object')freeze(v);});return Object.freeze(o);}freeze(brownHareAnatomy);
