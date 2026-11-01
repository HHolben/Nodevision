// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlCalligraphy.mjs
// This module converts text ranges into individual image-text graphemes without restructuring their surrounding paragraphs, and keeps generation separate from the document mutation so asynchronous font loading cannot overwrite edits.
import { applyImageTextPresentation, IMAGE_TEXT_SELECTOR } from './HtmlImageText.mjs';
import { createCalligraphyGlyph } from '/Typography/CalligraphyGlyph.mjs';

export async function prepareCalligraphy(root, range, generate = createCalligraphyGlyph) {
  if (!range || !root.contains(range.commonAncestorContainer)) throw Error('Place the caret or select text in the graphical editor.');
  if (!Intl.Segmenter) throw Error('This browser does not support Unicode grapheme segmentation.');
  const doc = root.ownerDocument;
  const snapshot = root.innerHTML;
  const segmenter = new Intl.Segmenter(undefined, {granularity:'grapheme'});
  const jobs = [];
  const boundaries = new Set([root.textContent.length]);
  for (const part of segmenter.segment(root.textContent)) boundaries.add(part.index);
  let textOffset = 0;
  if (range.collapsed) {
    const element = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    if (element.closest(IMAGE_TEXT_SELECTOR)) throw Error('Move the caret outside the graphical letter first.');
    jobs.push({range:range.cloneRange(), text:'A', element});
  } else {
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const nodeOffset = textOffset; textOffset += node.length;
      if (!range.intersectsNode(node) || node.parentElement.closest(`${IMAGE_TEXT_SELECTOR},script,style,[contenteditable="false"]`)) continue;
      for (const {segment:text,index} of segmenter.segment(node.data)) {
        const end = index + text.length;
        const startLimit = node === range.startContainer ? range.startOffset : 0;
        const endLimit = node === range.endContainer ? range.endOffset : node.length;
        if (end <= startLimit || index >= endLimit || /^\s+$/u.test(text)) continue;
        if (!boundaries.has(nodeOffset + index) || !boundaries.has(nodeOffset + end)) throw Error('This grapheme crosses formatting boundaries. Keep the complete grapheme in one text run before converting.');
        if (index < startLimit || end > endLimit) throw Error('Select complete Unicode graphemes before converting.');
        const part = doc.createRange(); part.setStart(node,index); part.setEnd(node,end);
        jobs.push({range:part,text,element:node.parentElement});
      }
    }
  }
  // Resolve all graphics before changing the document; keep computed style snapshots stable.
  await doc.fonts?.ready;
  const fonts = new Map();
  for (const job of jobs) {
    const style = doc.defaultView.getComputedStyle(job.element);
    const width = job.range.collapsed ? undefined : job.range.getBoundingClientRect().width;
    job.graphic = await generate(job.text, style, doc, {width, fonts});
  }
  return {
    warnings:[...new Set(jobs.map(job => job.graphic.warning).filter(Boolean))],
    apply() {
      if (root.innerHTML !== snapshot || jobs.some(job => !root.contains(job.range.commonAncestorContainer))) throw Error('The document changed while fonts loaded. Select the text and retry.');
      const elements = [];
      for (const job of jobs.reverse()) {
        const span = doc.createElement('span'); span.textContent = job.text;
        applyImageTextPresentation(span, job.graphic);
        span.setAttribute('data-nodevision-calligraphy', 'true');
        span.contentEditable = 'false';
        span.style.minWidth = '0'; span.style.minHeight = '0';
        span.style.width = `${job.graphic.width}em`; span.style.height = `${job.graphic.height}em`;
        span.style.verticalAlign = `${-job.graphic.descent}em`;
        span.style.overflow = 'hidden'; span.style.lineHeight = '0'; span.style.whiteSpace = 'pre';
        span.style.printColorAdjust = 'exact';
        job.range.deleteContents(); job.range.insertNode(span); elements.unshift(span);
      }
      return elements;
    }
  };
}
