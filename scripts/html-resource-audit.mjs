// Browser regressions for portable resource substitutions, undo identities, and independent editors.
import { documentSignature } from './html-source-fixtures.mjs';
export async function auditResources(context, renderEditor, ok) {
  const source = '<!doctype html><html><body><img id="image" src="./Images/Photo.png?x=1#crop">' +
    '<audio id="audio" src="../Audio/Track.ogg#t=2"></audio><video id="video" src="./Movie.webm" poster="./Poster.png"></video>' +
    '<iframe id="frame" src="./Pages/Preview.html" title="preview"></iframe></body></html>';
  context.setHTML(source);
  await new Promise(resolve => setTimeout(resolve, 50));
  const root = context.editorElement, provenance = root.__nvSourceProvenance;
  for (const [id, name] of [['image', 'src'], ['audio', 'src'], ['video', 'src'], ['video', 'poster'], ['frame', 'src']]) {
    const element = root.querySelector('#' + id);
    provenance.resolveAttribute(element, name, '/Notebook/runtime/' + id + '-' + name);
  }
  provenance.resolveAttribute(root.querySelector('#image'), 'src', URL.createObjectURL(new Blob(['image'])));
  ok(documentSignature(context.getHTML()) === documentSignature(source), 'all explicitly substituted media retain authored paths');
  await context.save();
  ok(documentSignature(context.getHTML()) === documentSignature(source), 'resource save is idempotent');
  context.transactions.run('Change portable image', () => {
    const image = root.querySelector('#image');
    image.setAttribute('src', './Images/photo.png?x=2#crop');
    provenance.resolveAttribute(image, 'src', '/Notebook/runtime/lowercase-photo.png');
  });
  ok(context.getHTML().includes('./Images/photo.png?x=2#crop'), 'explicit resource edit after save keeps case and suffix');
  root.__nvProgrammaticHistory.undo();
  ok(documentSignature(context.getHTML()) === documentSignature(source), 'undo uses the resource substitution belonging to its snapshot');
  root.__nvProgrammaticHistory.redo();
  ok(context.getHTML().includes('./Images/photo.png?x=2#crop'), 'redo restores edited portable source');

  const host = document.createElement('div'); document.body.append(host);
  const dispose = await renderEditor('Other.html', host);
  const second = host.__nvHtmlEditorContext;
  second.setHTML(source.replace('Photo.png', 'photo.png'));
  const other = second.editorElement.querySelector('#image');
  second.editorElement.__nvSourceProvenance.resolveAttribute(other, 'src', '/Notebook/runtime/other.png');
  ok(second.getHTML().includes('./Images/photo.png?x=1#crop'), 'second editor owns its resource restoration');
  ok(context.getHTML().includes('./Images/photo.png?x=2#crop'), 'second editor cannot replace first resource source');
  dispose(); host.remove(); context.activate();
}
