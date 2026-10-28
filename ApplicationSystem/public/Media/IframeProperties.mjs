// Shared iframe values and safe markup for media insertion and property editing.
export const iframeDefaults = Object.freeze({ sourceKind: 'notebook', src: '', width: '560px', height: '315px', title: '', loading: 'lazy', sandbox: '', allow: '', allowfullscreen: false, border: '0' });
export function validateIframeSource(value, kind) {
  const source = String(value ?? '').trim();
  if (!source || /[\u0000-\u0020\u007f\\]/.test(source)) throw Error('Enter a URL or path; encode spaces as %20.');
  const scheme = source.match(/^([a-z][a-z\d+.-]*):/i)?.[1];
  if (scheme && !/^https?$/i.test(scheme) || source.startsWith('//')) throw Error('Use a Notebook path or an HTTP(S) URL.');
  if (kind === 'internet' && !/^https?:\/\//i.test(source)) throw Error('Internet resources require an HTTP(S) URL.');
  if (kind === 'notebook' && scheme) throw Error('Choose Internet for an HTTP(S) URL.');
  if (scheme) { const url = new URL(source); if (!url.hostname || url.username || url.password) throw Error('Use a URL without credentials.'); }
  return source;
}
export function iframeDimension(value) {
  const text = String(value).trim();
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:px|%|em|rem|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc)?$/.test(text) || parseFloat(text) <= 0) throw Error('Enter a positive size in pixels, percent, or CSS units.');
  return /^\d+(\.\d+)?$/.test(text) ? text + 'px' : text;
}
export function validateIframeValues(values) {
  const v = { ...iframeDefaults, ...values };
  v.src = validateIframeSource(v.src, v.sourceKind);
  v.width = iframeDimension(v.width); v.height = iframeDimension(v.height);
  if (!['lazy', 'eager', ''].includes(v.loading)) throw Error('Loading must be lazy or eager.');
  if (!/^[a-z\s-]*$/i.test(v.sandbox || '')) throw Error('Sandbox permissions must be space-separated tokens.');
  // Scripts plus same-origin can escape a same-origin sandbox in the application.
  if (/\ballow-scripts\b/.test(v.sandbox) && /\ballow-same-origin\b/.test(v.sandbox)) throw Error('Do not combine allow-scripts and allow-same-origin.');
  if (/[;{}<>]|url\s*\(/i.test(v.border)) throw Error('Enter a single CSS border value.');
  return v;
}
// Imported values are validated only when the user changes them.
export function validateIframePatch(values, previous) {
  const probe = { ...iframeDefaults, src: 'placeholder.html' };
  for (const key of Object.keys(values)) if (values[key] !== previous[key]) probe[key] = values[key];
  if (values.src !== previous.src || values.sourceKind !== previous.sourceKind) { probe.src = values.src; probe.sourceKind = values.sourceKind; }
  validateIframeValues(probe);
  return values;
}
export function readIframeValues(frame, provenance) {
  const attr = name => provenance ? provenance.sourceAttribute(frame, name) : frame.getAttribute(name);
  const src = attr('src') || '';
  return { sourceKind: /^https?:/i.test(src) ? 'internet' : 'notebook', src,
    width: frame.style.width || attr('width') || '560px', height: frame.style.height || attr('height') || '315px',
    title: attr('title') ?? '', loading: attr('loading') ?? '', sandbox: attr('sandbox'), allow: attr('allow') ?? '',
    allowfullscreen: frame.hasAttribute('allowfullscreen'), border: frame.style.border };
}
export function applyIframeValues(frame, values, previous = null) {
  const changed = key => !previous || values[key] !== previous[key];
  for (const key of ['src', 'title', 'loading', 'sandbox', 'allow']) {
    if (!changed(key)) continue;
    if (values[key] === null || (key !== 'sandbox' && key !== 'title' && !values[key])) frame.removeAttribute(key);
    else frame.setAttribute(key, values[key]);
  }
  if (changed('allowfullscreen')) frame.toggleAttribute('allowfullscreen', !!values.allowfullscreen);
  for (const key of ['width', 'height']) if (changed(key)) {
    const size = iframeDimension(values[key]);
    frame.style[key] = size;
    if (/^\d+px$/.test(size)) frame.setAttribute(key, size.slice(0, -2)); else frame.removeAttribute(key);
  }
  if (changed('border')) frame.style.border = values.border;
  return frame;
}
export function createIframeElement(doc, values) { return applyIframeValues(doc.createElement('iframe'), validateIframeValues(values)); }
export function iframeWorldDefinition(values, position) {
  const v = validateIframeValues(values);
  return { id: 'iframe-' + crypto.randomUUID(), type: 'iframe', name: v.title || 'Embedded Page', src: v.src, iframeSrc: v.src,
    iframeTitle: v.title, sandbox: v.sandbox, allow: v.allow, loading: v.loading, allowfullscreen: v.allowfullscreen,
    iframeWidth: v.width, iframeHeight: v.height, iframeBorder: v.border,
    position, size: [2.4, 2.4 * (parseFloat(v.height) / parseFloat(v.width)), 0.04], collider: false, isSolid: false };
}
