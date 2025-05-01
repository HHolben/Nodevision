// FILE: formatHtml.js
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
