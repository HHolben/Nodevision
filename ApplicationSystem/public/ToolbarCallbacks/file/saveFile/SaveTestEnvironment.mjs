// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/saveFile/SaveTestEnvironment.mjs
// This module provides isolated browser editor state and captures persistence side effects for native save regression tests. Its fetch stub prevents tests from writing Notebook files.

// Supply editor state and capture only persistence-related side effects.
export function editor(t, mode = '', path = 'page.html') {
  const writes = [],
    saved = [],
    calls = [],
    elements = {};
  globalThis.window = {
    NodevisionState: {
      currentMode: mode
    },
    currentActiveFilePath: path,
    dispatchEvent(event) {
      if (event.type === 'nodevision-file-saved') saved.push(event.detail.filePath);
    }
  };
  globalThis.document = {
    activeElement: null,
    getElementById: id => elements[id] || null
  };
  globalThis.HTMLCanvasElement = class {};
  globalThis.SVGElement = class {};
  globalThis.fetch = async (url, options) => {
    if (url === '/api/save') writes.push(JSON.parse(options.body));
    return Response.json({
      success: true,
      entries: []
    });
  };
  t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'warn', () => {});
  return {
    writes,
    saved,
    calls,
    elements
  };
}

