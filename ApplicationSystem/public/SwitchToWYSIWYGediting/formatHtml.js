// Nodevision/ApplicationSystem/public/SwitchToWYSIWYGediting/formatHtml.js
// This file defines browser-side format Html logic for the Nodevision UI. It renders interface components and handles user interactions.
// FILE: formatHtml.js
// Purpose: TODO: Add description of module purpose
(function(){
  function formatHtml(html) {
    let indentLevel = 0;
    return html
      .replace(/></g, '>' + '\n' + '<')
      .split('\n')
      .map(line => {
        line = line.trim();
        if (line.startsWith('</')) {
          indentLevel = Math.max(indentLevel - 1, 0);
        }
        const indented = '\t'.repeat(indentLevel) + line;
        if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>')) {
          indentLevel++;
        }
        return indented;
      })
      .filter(Boolean)
      .join('\n');
  }
  window.formatHtml = formatHtml;
})();
