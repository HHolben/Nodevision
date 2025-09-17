// public/initMarkdownEditor.js
// Purpose: TODO: Add description of module purpose

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Markdown from '@tiptap/extension-markdown';

let editorInstance;

export async function initMarkdownEditor(containerSelector, filePath) {
  // 1. Fetch the Markdown content
  const response = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
  if (!response.ok) {
    console.error('Failed to load markdown:', response.statusText);
    return;
  }
  const markdown = await response.text();

  // 2. Prepare container
  const container = document.querySelector(containerSelector);
  container.innerHTML = '<div id="tiptap-editor"></div>';

  // 3. Initialize TipTap editor with Markdown extension
  editorInstance = new Editor({
    element: container.querySelector('#tiptap-editor'),
    extensions: [
      StarterKit,
      Markdown.configure({
        html: false  // Strict markdown mode
      })
    ],
    content: markdown,
    autofocus: true,
  });

  // 4. Hook up save button (assuming you have a toolbar button with id "save-btn")
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => saveMarkdown(filePath));
  }
}

export async function saveMarkdown(filePath) {
  if (!editorInstance) return;
  const markdown = editorInstance.storage.markdown.getMarkdown();
  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/markdown' },
      body: markdown
    });
    if (!res.ok) console.error('Save failed:', res.statusText);
  } catch (err) {
    console.error('Error saving markdown:', err);
  }
}
