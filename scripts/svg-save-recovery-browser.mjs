// Nodevision/scripts/svg-save-recovery-browser.mjs
// This regression exercises the live SVG save hook, recovery dialog, exact backup blob, and retry behavior without writing Notebook files.
export async function checkSvgSaveRecovery(context) {
  const ok = (value, message) => { if (!value) throw Error(message); };
  const originalFetch = window.fetch, create = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
  let blob, status = 413;
  try {
    context.recordSvgSnapshot('save-test', () => { context.svgRoot.querySelector('rect').setAttribute('fill', '#123456'); });
    const content = context.getEditorHTML();
    window.fetch = async () => ({ ok: status === 200, status, json: async () => ({ limitBytes: 1024 }) });
    ok(await context.save('fixture.svg') === false && context.isDirty(), '413 preserves dirty state');
    const dialog = document.querySelector('dialog');
    ok(dialog.textContent.includes('request limit') && dialog.textContent.includes('unsaved'), 'specific recovery message');
    URL.createObjectURL = value => { blob = value; return 'blob:backup-test'; };
    HTMLAnchorElement.prototype.click = function () { ok(this.download === 'fixture.backup.svg', 'backup filename'); };
    dialog.querySelector('button').click();
    ok(await blob.text() === content, 'backup contains exact current SVG');
    dialog.close();
    ok(context.getEditorHTML() === content && context.isDirty(), 'dismissal loses nothing');
    status = 200; await context.save('fixture.svg');
    ok(!context.isDirty(), 'successful retry clears dirty');
  } finally { window.fetch = originalFetch; URL.createObjectURL = create; HTMLAnchorElement.prototype.click = click; }
}
