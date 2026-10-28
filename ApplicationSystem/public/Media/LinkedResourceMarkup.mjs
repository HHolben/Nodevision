// Shared semantic media markup; references are already resolved against the destination document.
const escape = value => String(value ?? '').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
export const IMAGE_EXTENSIONS = new Set(['png','jpg','jpeg','gif','webp','svg','avif','bmp']);
export function resourceTag(extension) { return IMAGE_EXTENSIONS.has(extension) ? 'img' : ['mp4','webm'].includes(extension) ? 'video' : ['mp3','wav','ogg'].includes(extension) ? 'audio' : 'a'; }
export function linkedResourceMarkup({src,name,extension,tag=resourceTag(extension),attributes=''}) {
  if(tag==='img')return `<img src="${escape(src)}" alt="${escape(name)}"${attributes}>`;
  if(tag==='video'||tag==='audio')return `<${tag} controls src="${escape(src)}"${attributes}></${tag}>`;
  return `<a href="${escape(src)}"${attributes}>${escape(name)}</a>`;
}
