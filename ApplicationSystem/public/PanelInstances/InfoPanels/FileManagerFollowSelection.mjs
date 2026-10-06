// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/FileManagerFollowSelection.mjs
// This module reveals canonical file selections in the existing directory list without synthesizing clicks or opening files. Stale asynchronous directory responses are discarded.
import { getNodevisionSelection } from '../../NodevisionSelection.mjs';
export function bindFileManagerFollowSelection(panel, { fetchDirectoryContents, displayFiles, highlight }) {
  let generation = 0, disposed = false;
  async function reveal(reference) {
    const ticket = ++generation;
    if (!reference?.path || reference.kind === 'directory' || disposed) return;
    const path = reference.path;
    const find = () => [...panel.querySelectorAll('a.file')].find(link => link.dataset.fullPath === path);
    let link = find();
    if (!link) {
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      await fetchDirectoryContents(parent, displayFiles, panel.querySelector('#error'), panel.querySelector('#loading'),
        { isCurrent: () => !disposed && ticket === generation });
      if (disposed || ticket !== generation) return;
      link = find();
    }
    if (!link) return;
    highlight(link);
    const list = panel.querySelector('#file-list'), item = link.getBoundingClientRect(), viewport = list.getBoundingClientRect();
    if (item.top < viewport.top) list.scrollTop -= viewport.top - item.top;
    else if (item.bottom > viewport.bottom) list.scrollTop += item.bottom - viewport.bottom;
  }
  const changed = event => { reveal(event.detail?.reference).catch(console.error); };
  window.addEventListener('nodevision-selection-changed', changed);
  reveal(getNodevisionSelection()).catch(console.error);
  return () => { disposed = true; generation++; window.removeEventListener('nodevision-selection-changed', changed); };
}
