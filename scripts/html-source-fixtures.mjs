// Browser fixtures use ordinary HTML, with no Notebook files or external services.
export const sourceFixture = `<!--before--><!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html lang="en" dir="ltr" data-document="retained"><head data-head="retained">
<!--head comment--><meta charset="utf-8"><title>Source &amp; meaning</title>
<base href="./assets/" target="_blank">
<link rel="stylesheet" href="theme.css?x=1#part" media="screen" integrity="test" crossorigin="anonymous">
<style media="screen">/* keep comments */ :root { --space: 2rem; } @media (max-width: 600px) { .card { padding: var(--space); } }</style>
<script type="importmap">{"imports":{"local":"./module.js"}}</script>
<script src="./start.js" defer nonce="fixture" data-script="head"></script>
<script type="module">window.__authoredScriptExecuted = true;</script>
</head><body id="page" class="theme card" data-body="yes" style="margin: 3px; --local: red; white-space: pre-wrap; background-color: ivory" onload="window.__authoredScriptExecuted = true">
<!--body comment--><p id="editable" style="white-space: nowrap">alpha <em>beta</em>
<strong>gamma</strong> &amp; delta</p>
<script async src="./middle.js" data-script="body"></script>
<section id="nested"><span>one</span> <span>two</span><script type="application/ld+json">{"text":"<value>"}</script><!--nested comment--></section>
<pre>  first\n    second &lt;third&gt;\n</pre><textarea name="raw">line one\n  line two</textarea>
<template id="card"><style>.inside { color: red; }</style><div> template <script type="module" src="./inert.js"></script><!--inert--></div></template>
<script>window.__authoredScriptExecuted = true; /* < & > */</script>
</body></html><!--after-->`;

export function documentSignature(source) {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const visit = node => {
    if (node.nodeType === 10) return ['doctype', node.name, node.publicId, node.systemId];
    if (node.nodeType === 1) return [node.namespaceURI, node.localName,
      [...node.attributes].map(a => [a.name, a.value]).sort(),
      [...(node.content || node).childNodes].map(visit)];
    return [node.nodeType, node.nodeValue, [...node.childNodes].map(visit)];
  };
  return JSON.stringify(visit(doc));
}
