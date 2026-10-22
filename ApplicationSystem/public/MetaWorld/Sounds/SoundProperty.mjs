// Nodevision/ApplicationSystem/public/MetaWorld/Sounds/SoundProperty.mjs
// Validates the serializable sound property owned by a world shape.
export function normalizeSoundProperty(value={}) {
  const src=String(value.src||'').trim();
  if(!src)throw Error('Choose an audio file or enter its Notebook path.');
  if(/^[a-z][\w+.-]*:/i.test(src)&&!/^https?:\/\//i.test(src)&&!/^data:audio\/[\w.+-]+;base64,/i.test(src))throw Error('Use an audio file, Notebook path, or HTTP audio URL.');
  const volume=Number(value.volume??.8),range=Number(value.range??14);
  if(!Number.isFinite(volume)||volume<0||volume>1)throw Error('Volume must be between 0 and 1.');
  if(!Number.isFinite(range)||range<=0||range>10000)throw Error('Audible range must be greater than 0 and at most 10000.');
  return {src,volume,range,loop:value.loop!==false,enabled:value.enabled!==false};
}
