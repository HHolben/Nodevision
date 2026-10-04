// Tests authored marker collisions, detached serialization, resources, and repeated saves.
import { documentSignature } from './html-source-fixtures.mjs';
import { markHtmlEditorChrome } from '/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSourceProvenance.mjs';
import { clearRenderedPageListenHighlights } from '/Listen/ListenHighlights.mjs';
import { presentHtmlClass } from '/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs';
export async function auditPreservation(context, ok) {
  const source = '<!doctype html><html lang="fr"><head><!--head--><style>p { white-space: pre-wrap }</style></head><body class="author">' +
    '<p id="caret" class="nv-html-text-style-target authored" data-nv-interactive="user" contenteditable="false">a <em>b</em> c</p>' +
    '<div class="nv-editor-only">Authored class</div><span data-nv-listen-highlight="author">Keep wrapper</span>' +
    '<div class="nv-poem-controls" data-nv-cartoon-selected="author">Keep content</div>' +
    '<img id="photo" src="./images/pic.png?size=2#crop" data-nv-saved-src="author metadata" alt="A">' +
    '<audio src="../audio/song.ogg#t=1" controls></audio><video poster="./images/poster.png"><source src="./clip.webm"></video>' +
    '<template><p class="nv-editor-only">inert authored</p><script async src="template.js"></script></template>' +
    '<!--tail--></body></html>';
  context.setHTML(source);
  await new Promise(resolve => setTimeout(resolve, 50));
  const root = context.editorElement;
  const chrome = markHtmlEditorChrome(document.createElement('span'));
  chrome.className = 'nv-editor-only'; chrome.id = 'temporary-handle'; root.append(chrome);
  const photo = root.querySelector('#photo');
  root.__nvSourceProvenance.resolveAttribute(photo, 'src', URL.createObjectURL(new Blob(['fixture'])));
  const before = root.innerHTML;
  const native = window.getSelection();
  const range = document.createRange();
  range.setStart(root.querySelector('#caret').firstChild, 1);
  range.collapse(true);
  native.removeAllRanges(); native.addRange(range);
  context.selection.capture();
  let mutations = 0;
  const observer = new MutationObserver(records => { mutations += records.length; });
  observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
  const first = context.getHTML(), second = context.getHTML();
  await Promise.resolve();
  observer.disconnect();
  ok(documentSignature(first) === documentSignature(source), 'authored marker collisions and resource paths survive: ' + first);
  ok(first === second, 'repeated serialization is idempotent');
  ok(root.innerHTML === before && mutations === 0, 'save never changes live DOM or triggers rehydration');
  ok(native.anchorNode === range.startContainer && native.anchorOffset === 1, 'save retains native caret');
  context.transactions.run('Attribute', () => root.querySelector('#caret').setAttribute('title', 'edited'));
  const expected = source.replace('id="caret"', 'id="caret" title="edited"');
  ok(documentSignature(context.getHTML()) === documentSignature(expected), 'edit keeps surrounding authored source and collisions');
  clearRenderedPageListenHighlights(root);
  ok(root.querySelector('[data-nv-listen-highlight="author"]'), 'Listen cleanup preserves an authored marker collision');
  const revision = context.revision;
  context.transactions.run('Presentation only', () => presentHtmlClass(root.querySelector('#photo'), 'nv-selected-image', true));
  ok(context.revision === revision, 'presentation-only transaction creates no dirty revision');
  context.transactions.run('Authored marker', () => {
    const element = document.createElement('span');
    element.id = 'new-author'; element.className = 'nv-selected-image nv-editor-only';
    element.setAttribute('data-nv-resizable', 'authored'); root.append(element);
  });
  const savedAuthor = new DOMParser().parseFromString(context.getHTML(), 'text/html').getElementById('new-author');
  ok(savedAuthor.className === 'nv-selected-image nv-editor-only' && savedAuthor.getAttribute('data-nv-resizable') === 'authored', 'newly authored marker-like state is never guessed to be presentation');
  const inert = '<!doctype html><html><head><style onload="window.__sourceScriptRan=true">p{color:red}</style></head>' +
    '<body><button onclick="window.__sourceScriptRan=true">click</button><a href="javascript:window.__sourceScriptRan=true">link</a>' +
    '<script>window.__sourceScriptRan=true</script><iframe sandbox="allow-scripts" srcdoc="&lt;script>parent.__sourceScriptRan=true&lt;/script>"></iframe></body></html>';
  window.__sourceScriptRan = false;
  context.setHTML(inert);
  root.querySelector('button').click();
  await new Promise(resolve => setTimeout(resolve, 50));
  ok(!window.__sourceScriptRan, 'scripts, event handlers and iframe script execution stay inert');
  ok(root.querySelector('a').getAttribute('href') === 'about:blank', 'javascript links are inert while editing');
  ok(documentSignature(context.getHTML()) === documentSignature(inert), 'inert substitutions restore original authored source');
}
