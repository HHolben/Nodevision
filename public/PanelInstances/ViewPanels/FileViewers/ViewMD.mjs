// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewMD.mjs
// This module renders Markdown (.md) files into readable HTML inside a Nodevision view panel.

export async function renderFile(filePath, panel) {
  const serverBase = '/Notebook';
  panel.innerHTML = '';

  if (!filePath || !filePath.toLowerCase().endsWith('.md')) {
    panel.innerHTML = `<p>No Markdown file selected.</p>`;
    return;
  }

  console.log('[ViewMD] loading', filePath);

  try {
    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const text = await response.text();
    const html = renderMarkdown(text);

    const container = document.createElement('div');
    container.className = 'markdown-body';
    container.innerHTML = html;

    applyDefaultStyles(container);
    panel.appendChild(container);

  } catch (err) {
    console.error('[ViewMD] Error:', err);
    panel.innerHTML = `<pre style="color:red;">${err.message}</pre>`;
  }
}

/* ----------------------------- MARKDOWN RENDERER ----------------------------- */

function renderMarkdown(src) {
  let out = escapeHTML(src);

  // Code blocks ```
  out = out.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${code}</code></pre>`
  );

  // Headings
  out = out.replace(/^###### (.*)$/gm, '<h6>$1</h6>');
  out = out.replace(/^##### (.*)$/gm, '<h5>$1</h5>');
  out = out.replace(/^#### (.*)$/gm, '<h4>$1</h4>');
  out = out.replace(/^### (.*)$/gm, '<h3>$1</h3>');
  out = out.replace(/^## (.*)$/gm, '<h2>$1</h2>');
  out = out.replace(/^# (.*)$/gm, '<h1>$1</h1>');

  // Bold & italic
  out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links [text](url)
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    `<a href="$2" target="_blank" rel="noopener">$1</a>`
  );

  // Unordered lists
  out = out.replace(
    /(?:^|\n)(- .+(?:\n- .+)*)/g,
    block => `<ul>${block
      .trim()
      .split('\n')
      .map(l => `<li>${l.slice(2)}</li>`)
      .join('')}</ul>`
  );

  // Paragraphs
  out = out
    .split(/\n{2,}/)
    .map(p =>
      p.match(/^<\/?(h|ul|pre)/) ? p : `<p>${p}</p>`
    )
    .join('\n');

  return out;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ----------------------------- DEFAULT STYLES ----------------------------- */

function applyDefaultStyles(container) {
  container.style.fontFamily = 'system-ui, sans-serif';
  container.style.lineHeight = '1.6';
  container.style.padding = '10px';

  container.querySelectorAll('pre').forEach(pre => {
    pre.style.background = '#f6f8fa';
    pre.style.padding = '8px';
    pre.style.overflowX = 'auto';
  });

  container.querySelectorAll('code').forEach(code => {
    code.style.fontFamily = 'monospace';
    code.style.background = '#eee';
    code.style.padding = '2px 4px';
    code.style.borderRadius = '3px';
  });

  container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
    h.style.borderBottom = '1px solid #ddd';
    h.style.paddingBottom = '4px';
  });
}
