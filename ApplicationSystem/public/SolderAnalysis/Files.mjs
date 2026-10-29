// Use the existing Notebook save API and overwrite prompt; native files use Save As.
import { reportFilename } from './Document.mjs';
export async function saveAnalysisFile(state, content, report = false) {
  const name = report ? reportFilename(state.source.name) : state.source.name.replace(/\.jpe?g$/i, '.solder.json');
  const type = report ? 'text/html' : 'application/json';
  if (state.source.notebookPath) {
    const path = state.source.notebookPath.replace(/[^/]+$/, name);
    const [{ saveViaApi, notifyFileSaved }, { notebookFileExists }, { openNodevisionOverlayPanel }] = await Promise.all([
      import('../ToolbarCallbacks/file/saveFile/utils.mjs'), import('../Sessions/SketchFocusSave.mjs'), import('../TemplateSystem/NodevisionOverlayPanel.mjs')
    ]);
    if (await notebookFileExists(path)) {
      const answer = await openNodevisionOverlayPanel('SessionOverlayPanel', { title: 'Replace Existing File?', message: `${path} already exists.`, choices: [{ label: 'Cancel', value: 'cancel' }, { label: 'Replace', value: 'replace', primary: true }] });
      if ((answer?.value ?? answer) !== 'replace') return null;
    }
    await saveViaApi({ path, sourcePath: path, content, mimeType: type }); notifyFileSaved(path); return path;
  }
  if (window.showSaveFilePicker) {
    const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: report ? 'HTML report' : 'Editable solder analysis', accept: { [type]: [report ? '.html' : '.json'] } }] });
    // Refuse a source-image filename even if the platform picker permits arbitrary extensions.
    if (/\.jpe?g$/i.test(handle.name)) throw Error('The source JPEG cannot be overwritten');
    const writer = await handle.createWritable(); await writer.write(content); await writer.close(); return handle.name;
  }
  const url = URL.createObjectURL(new Blob([content], { type })), link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return `${name} (download)`;
}
