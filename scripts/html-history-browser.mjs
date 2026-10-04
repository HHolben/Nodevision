// Browser-side experiments use real retained HTML contexts and disposable bare editing hosts.
import './html-foundation-workspace.mjs';
import { beginPropertiesEdit } from '/PanelInstances/Common/HtmlProperties/PropertiesEdit.mjs';
import { discoverHtmlProperties, prepareHtmlCssDocument } from '/PanelInstances/Common/HtmlProperties/HtmlCssDocument.mjs';
import { setupPanel } from '/PanelInstances/InfoPanels/HTMLPropertiesPanel.mjs';
try {
  if (!window.foundation?.ready) throw new Error(window.foundationError || 'Foundation not ready');
  const contexts = foundation.contexts, traces = [], disposers = [];
  let operation = null, rememberedOperation = null, bare = null, bareFrame = null, preventHistory = false;
  function nodePath(root, node) {
    const path = [];
    while (node && node !== root) { if (!node.parentNode) return null; path.unshift([...node.parentNode.childNodes].indexOf(node)); node = node.parentNode; }
    return node === root ? path : null;
  }
  function caret(root) {
    const s = root.ownerDocument.getSelection();
    return { anchor: nodePath(root, s.anchorNode), anchorOffset: s.anchorOffset,
      focus: nodePath(root, s.focusNode), focusOffset: s.focusOffset, collapsed: s.isCollapsed };
  }
  function trace(root, owner) {
    const events = [], counters = { characterData: 0, childList: 0, attributes: 0, oldTextCodeUnits: 0 };
    const textBefore = new Map();
    const push = entry => { if (events.length === 256) events.shift(); events.push(entry); };
    const listener = event => {
      const item = { type: event.type, inputType: event.inputType, trusted: event.isTrusted,
        cancelable: event.cancelable, composing: event.isComposing, data: event.data,
        ranges: event.getTargetRanges?.().map(range => ({ start: nodePath(root, range.startContainer), startOffset: range.startOffset, end: nodePath(root, range.endContainer), endOffset: range.endOffset })),
        caret: caret(root) };
      if (preventHistory && event.type === 'beforeinput' && /^history/.test(event.inputType)) event.preventDefault();
      push(item); queueMicrotask(() => { item.prevented = event.defaultPrevented; });
    };
    for (const type of ['beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend']) root.addEventListener(type, listener, true);
    const selection = () => { if (root.contains(root.ownerDocument.getSelection().anchorNode)) push({ type: 'selectionchange', caret: caret(root) }); };
    root.ownerDocument.addEventListener('selectionchange', selection);
    const observe = records => {
      for (const record of records) {
        counters[record.type]++;
        if (record.type === 'characterData') {
          counters.oldTextCodeUnits += record.oldValue.length;
          if (!textBefore.has(record.target)) textBefore.set(record.target, record.oldValue);
        }
      }
    };
    const observer = new MutationObserver(observe);
    observer.observe(root, { subtree: true, characterData: true, characterDataOldValue: true, childList: true, attributes: true });
    const off = owner?.transactions.subscribe(event => push({ type: 'revision', ...event }));
    const offBoundary = owner?.transactions.subscribeBoundary?.(event => push({ type: 'boundary', ...event }));
    const record = { owner: owner?.filePath || 'bare', events, counters,
      journalSize() { observe(observer.takeRecords()); return { nodes: textBefore.size, retainedCodeUnits: [...textBefore].reduce((n, [node, before]) => n + before.length + node.data.length, 0) }; } };
    traces.push(record);
    const stop = () => {
      observer.disconnect(); off?.(); offBoundary?.();
      for (const type of ['beforeinput', 'input', 'compositionstart', 'compositionupdate', 'compositionend']) root.removeEventListener(type, listener, true);
      root.ownerDocument.removeEventListener('selectionchange', selection);
    };
    disposers.push(stop); return record;
  }
  const panelHost = document.createElement('div'); document.body.append(panelHost);
  const panelHooks = setupPanel(panelHost), panel = panelHost.__nvHtmlProperties;
  const toolbar = document.createElement('button'); toolbar.textContent = 'Test toolbar'; document.body.append(toolbar);
  const originalFetch = window.fetch.bind(window);
  const css = '.card {color: purple;}';
  window.fetch = (url, options) => String(url) === '/Notebook/history.css' ? Promise.resolve(new Response(css)) : originalFetch(url, options);
  function end(index = 0) {
    const context = foundation.activate(index), root = context.editorElement, node = root.querySelector('#text').lastChild;
    root.focus(); const range = document.createRange();
    if (node.nodeType === 3) range.setStart(node, node.length); else range.setStartAfter(node);
    range.collapse(true); getSelection().removeAllRanges(); getSelection().addRange(range); context.selection.capture();
  }
  function clear() { disposers.splice(0).forEach(fn => fn()); traces.length = 0; bareFrame?.remove(); bare = bareFrame = null; operation = null; preventHistory = false; }
  async function reset({ sheet = false, paragraphs = 0, fragmented = false, instrument = true } = {}) {
    clear();
    for (const context of contexts) {
      context.__nvPropertiesUndoCleanup?.();
      const padding = (fragmented ? '<p><span>x</span><em>y</em><span>z</span></p>' : '<p>ordinary text</p>').repeat(paragraphs);
      context.setHTML(`<!doctype html><html lang="en"><head>${sheet ? '<link rel="stylesheet" href="history.css">' : ''}<script src="example.js" defer></script></head><body class="authored"><p id="text" class="card">x</p>${padding}</body></html>`);
      if (instrument) trace(context.editorElement, context);
    }
    end(0); if (sheet) await Promise.all(contexts.map(prepareHtmlCssDocument)); await panel.refresh();
  }
  window.historyExperiment = {
    ready: true, reset, end,
    state() { return contexts.map(context => ({ source: context.getHTML(), text: context.editorElement.querySelector('#text').textContent,
      element: context.editorElement.querySelector('#text').outerHTML, caret: caret(context.editorElement),
      ownedSelection: (({ owner, ...bookmark }) => bookmark)(context.selection.bookmark()),
      selected: context.selection.getElement()?.id, revision: context.revision, dirty: context.isDirty,
      stack: context.editorElement.__nvProgrammaticHistory.inspect(), blocked: !!context.editorElement.__nvPropertiesUndoBlocked,
      css: operation?.source ? { text: operation.source.text, revision: operation.source.revision, dirty: operation.source.dirty } : null })); },
    async edit(kind, { unsafe = false, focus = '', value = 'red' } = {}) {
      const context = window.__nvActiveHtmlEditorContext, root = context.editorElement, element = root.querySelector('#text');
      if (focus === 'toolbar') toolbar.focus();
      if (focus === 'properties') panel.ui.value.focus();
      if (kind === 'properties' || kind === 'css') {
        const target = kind === 'css' ? (await discoverHtmlProperties(context, element, 'color')).targets[0] : null;
        const edit = await beginPropertiesEdit(context, element, 'color', target); edit.preview(value); operation = await edit.apply();
        if (unsafe) context.__nvPropertiesUndoCleanup?.(); // Controlled diagnosis only; never shipped as an editing path.
      } else context.transactions.run(kind, () => {
        if (kind === 'insertion') { const node = document.createElement('span'); node.textContent = '[insert]'; element.append(node); }
        if (kind === 'attribute') element.classList.add('new-class');
        if (kind === 'style') element.style.color = 'red';
      });
    },
    propertyUndo(direction = 'undo') { try { return { result: operation.undo(direction) }; } catch (error) { return { error: error.message }; } },
    rememberOperation() { rememberedOperation = operation; },
    undoRemembered() { try { return { result: rememberedOperation.undo() }; } catch (error) { return { error: error.message }; } },
    toolbarUndo(direction = 'undo') { toolbar.focus(); return window.HTMLWysiwygTools[direction](); },
    directUndo(direction = 'undo') { return document.execCommand(direction); },
    rawProgrammaticUndo(direction = 'undo') { return contexts[0].editorElement.__nvProgrammaticHistory[direction](); },
    focusProperties() { panel.ui.value.focus(); },
    trace() { return traces.map(record => ({ owner: record.owner, events: record.events, mutations: record.counters, coalescedTextJournal: record.journalSize() })); },
    async bareReset() {
      clear(); bareFrame = document.createElement('iframe'); document.body.prepend(bareFrame);
      const doc = bareFrame.contentDocument;
      doc.body.innerHTML = '<div id="first" contenteditable="true"><p>x</p></div><div id="second" contenteditable="true"><p>y</p></div>';
      bare = doc.getElementById('first'); this.bareFocus(0); trace(bare); trace(doc.getElementById('second'));
    },
    bareFocus(index) {
      const doc = bare.ownerDocument, root = doc.getElementById(index ? 'second' : 'first'), selection = doc.getSelection(); root.focus();
      const range = doc.createRange(); range.selectNodeContents(root.firstChild); range.collapse(false); selection.removeAllRanges(); selection.addRange(range);
    },
    bareCommand(kind) {
      const node = bare.firstChild, doc = bare.ownerDocument, selection = doc.getSelection();
      if (kind === 'attribute') node.style.color = 'red';
      if (kind === 'insertHTML') doc.execCommand('insertHTML', false, '<span class="inserted">[insert]</span>');
      if (kind === 'foreColor') { const r = doc.createRange(); r.selectNodeContents(node); selection.removeAllRanges(); selection.addRange(r); doc.execCommand('foreColor', false, 'red'); r.selectNodeContents(node); r.collapse(false); selection.removeAllRanges(); selection.addRange(r); }
      if (kind === 'replace') bare.innerHTML = bare.innerHTML;
      if (kind === 'reverseAttribute') node.style.removeProperty('color');
    },
    bareState: () => ({ html: bare.innerHTML, other: bare.ownerDocument.getElementById('second').innerHTML, caret: caret(bare), canUndo: bare.ownerDocument.queryCommandEnabled('undo'), canRedo: bare.ownerDocument.queryCommandEnabled('redo') }),
    intercept(value) { preventHistory = value; },
    startPerformance() { foundationDiagnostics.inputs.length = 0; return { heap: performance.memory?.usedJSHeapSize, counts: foundationDiagnostics.counts() }; },
    endPerformance() { return { heap: performance.memory?.usedJSHeapSize, inputs: foundationDiagnostics.inputs, counts: foundationDiagnostics.counts(), stack: contexts[0].editorElement.__nvProgrammaticHistory.inspect() }; },
    dispose() { clear(); panelHooks.destroy(); panelHost.remove(); toolbar.remove(); foundation.dispose(); },
  };
  await reset();
} catch (error) { window.historyError = error.stack; }
