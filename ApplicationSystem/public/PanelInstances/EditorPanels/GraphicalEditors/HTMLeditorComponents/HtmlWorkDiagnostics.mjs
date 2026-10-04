// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlWorkDiagnostics.mjs
// This module delegates optional phase measurements to the owning editor without introducing global instrumentation or retaining document nodes in diagnostic samples.
export function measureHtmlWork(root, name, action) {
  return root?.__nvHtmlDiagnostics ? root.__nvHtmlDiagnostics.measure(name, action) : action();
}
