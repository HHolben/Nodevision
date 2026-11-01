// Nodevision/ApplicationSystem/public/Typography/CalligraphyGlyph.mjs
// This module generates portable glyph outlines using the bundled OpenType parser when exact font resolution is possible, and reports explicitly when browser-rendered SVG text must remain dependent on fonts.
import { parse } from '../lib/three/libs/opentype.module.js';
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const family = value => value.trim().replace(/^["']|["']$/g, '').toLowerCase();
const weight = value => ({normal:'400', bold:'700'}[value] || value || '400');
export const typographyProperties = ['font-family','font-size','font-weight','font-style','font-stretch','font-variation-settings','font-feature-settings','font-variant-ligatures','font-variant-caps','font-variant-numeric','font-variant-east-asian','font-kerning','text-transform','letter-spacing','word-spacing','direction'];

// Only use an unambiguous primary face; never pretend a fallback font is the requested one.
export async function resolveOutlineFont(doc, style) {
  const faces = [];
  function visit(rules, base) {
    for (const rule of rules) {
      if (rule.type === 5 && family(rule.style.fontFamily) === family(style.fontFamily.split(',')[0]) &&
          ['', 'normal', '100%'].includes(rule.style.fontStretch) && weight(rule.style.fontWeight) === weight(style.fontWeight) && (rule.style.fontStyle || 'normal') === style.fontStyle) {
        const src = rule.style.getPropertyValue('src');
        const match = /^\s*url\(["']?([^"')]+)["']?\)/.exec(src);
        if (match && !rule.style.getPropertyValue('unicode-range')) faces.push(new URL(match[1], base).href);
      }
      if (rule.cssRules) visit(rule.cssRules, base);
    }
  }
  for (const sheet of doc.styleSheets) {
    try { visit(sheet.cssRules, sheet.href || doc.baseURI); } catch { /* Cross-origin CSS cannot be inspected. */ }
  }
  if (faces.length !== 1) throw Error('The exact font file is not accessible or is ambiguous.');
  const response = await fetch(faces[0]);
  if (!response.ok) throw Error('The font file could not be loaded.');
  const font = parse(await response.arrayBuffer());
  if (font.tables.os2?.fsType & 0x306) throw Error('The font restricts outline embedding.');
  if (font.tables.fvar) throw Error('Variable font outlines are not supported by the bundled parser.');
  return font;
}

export async function createCalligraphyGlyph(text, style, doc, options = {}) {
  const size = parseFloat(style.fontSize) || 16;
  const canvas = doc.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`;
  ctx.direction = style.direction;
  const metrics = ctx.measureText(text);
  const ascent = metrics.fontBoundingBoxAscent || size * .8;
  const descent = metrics.fontBoundingBoxDescent || size * .2;
  const width = Math.max(.01, options.width ?? metrics.width);
  const height = ascent + descent;
  let content, warning = '';
  try {
    if (!/^[\u0021-\u024f]+$/u.test(text) || [...text].length !== 1 ||
        !['normal','none',''].includes(style.fontVariationSettings) ||
        !['normal',''].includes(style.fontFeatureSettings) ||
        !['normal',''].includes(style.fontVariantCaps) ||
        !['normal',''].includes(style.fontVariantNumeric || '') ||
        !['normal',''].includes(style.fontVariantEastAsian || '') ||
        !['none',''].includes(style.textTransform || '') ||
        !['normal','100%',''].includes(style.fontStretch)) throw Error('This typography requires browser shaping.');
    const key = [style.fontFamily, style.fontWeight, style.fontStyle].join('|');
    if (options.fonts && !options.fonts.has(key)) options.fonts.set(key, resolveOutlineFont(doc, style));
    const font = await (options.font || options.fonts?.get(key) || resolveOutlineFont(doc, style));
    if (!font.charToGlyphIndex(text)) throw Error('The selected font does not contain this character.');
    content = font.getPath(text, 0, ascent, size, {kerning:false}).toSVG();
    content = `<g fill="${escape(style.color)}">${content.replace(/ fill="[^"]*"/g, '')}</g>`;
  } catch (error) {
    warning = `${error.message} SVG text retains the requested typography but needs the font available; appearance may change on another computer. Ligatures and joining across separate letters are not preserved.`;
    const css = typographyProperties.map(key => `${key}:${style.getPropertyValue(key)}`).join(';');
    content = `<text x="${style.direction === 'rtl' ? width : 0}" y="${ascent}" fill="${escape(style.color)}" style="${escape(css)}">${escape(text)}</text>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`;
  return {src:`data:image/svg+xml,${encodeURIComponent(svg)}`, width:width/size, height:height/size, descent:descent/size, warning};
}
