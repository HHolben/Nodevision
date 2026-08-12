// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/XML/XmlSourceView.mjs
// This file renders the unchanged XML source text for the XML viewer. It deliberately assigns textContent instead of HTML so Notebook XML remains authoritative and untrusted source markup is not executed.

export function createXmlSourceView(source) {
  const pre = document.createElement("pre");
  pre.style.cssText = [
    "margin:0",
    "padding:1rem",
    "white-space:pre-wrap",
    "overflow:auto",
    "font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace",
    "background:#f8fafc",
    "color:#111827"
  ].join(";");
  pre.textContent = String(source ?? "");
  return pre;
}
