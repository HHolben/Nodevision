// Nodevision/scripts/editor-horizontal-scroll-browser.mjs
// This regression exercises horizontal wheel scrolling on actual HTML and SVG editor viewports, including direction, wheel units, boundaries, and unchanged document geometry.
export function checkEditorHorizontalScroll({ target, viewport, wheel, ok, label }) {
  const top = viewport.scrollTop;
  viewport.scrollLeft = 200;
  ok(viewport.scrollLeft > 0, `${label} has horizontal overflow`);
  let event = wheel(target, { ctrlKey: false, altKey: false, shiftKey: true, deltaY: -40 });
  ok(event.defaultPrevented && viewport.scrollLeft === 160, `${label} Shift-wheel scrolls left without Ctrl`);
  ok(viewport.scrollTop === top, `${label} Shift-wheel preserves vertical position`);
  wheel(target, { ctrlKey: false, altKey: false, shiftKey: true, deltaY: 40 });
  ok(viewport.scrollLeft === 200, `${label} Shift-wheel scrolls right`);
  wheel(target, { ctrlKey: false, altKey: false, shiftKey: true, deltaX: -20, deltaY: -20 });
  ok(viewport.scrollLeft === 180, `${label} preconverted deltaX is not doubled`);
  wheel(target, { ctrlKey: false, altKey: false, shiftKey: true, deltaY: -1, deltaMode: 1 });
  ok(viewport.scrollLeft === 164, `${label} line units scroll horizontally`);
  event = wheel(target, { ctrlKey: false, altKey: false, shiftKey: false, deltaY: 40 });
  ok(!event.defaultPrevented && viewport.scrollLeft === 164, `${label} ordinary wheel remains native`);
  viewport.scrollLeft = 0;
  event = wheel(target, { ctrlKey: false, altKey: false, shiftKey: true, deltaY: -40 });
  ok(event.defaultPrevented && viewport.scrollLeft === 0 && viewport.scrollTop === top, `${label} left edge does not fall through vertically`);
}
