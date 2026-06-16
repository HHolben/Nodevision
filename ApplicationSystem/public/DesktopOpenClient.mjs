// Nodevision/ApplicationSystem/public/DesktopOpenClient.mjs
// Browser-side startup handler for files opened through the desktop launcher.

const OUTSIDE_MESSAGE = 'This file is outside your Notebook. Nodevision only edits files inside the Notebook. Would you like to copy this file into the root of your Notebook and edit the copy?';

function openNotebookFile(relativePath) {
  if (!relativePath) return;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = relativePath;
  window.NodevisionState.activeEditorFilePath = relativePath;
  window.currentActiveFilePath = relativePath;
  window.selectedFilePath = relativePath;
  window.dispatchEvent(new CustomEvent('toolbarAction', { detail: { id: 'FileView', type: 'ViewPanel' } }));
}

function showOutsideModal(entry) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'desktop-open-modal-backdrop';
    Object.assign(backdrop.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.55)', zIndex: '10000',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
    });

    const modal = document.createElement('div');
    Object.assign(modal.style, {
      maxWidth: '560px', background: '#20242a', color: '#fff', border: '1px solid #58606b',
      borderRadius: '10px', padding: '20px', boxShadow: '0 12px 40px rgba(0,0,0,0.4)', fontFamily: 'system-ui, sans-serif'
    });

    const title = document.createElement('h2');
    title.textContent = 'Open With Nodevision';
    title.style.marginTop = '0';

    const message = document.createElement('p');
    message.textContent = OUTSIDE_MESSAGE;

    const file = document.createElement('p');
    file.textContent = entry?.originalPath || entry?.basename || '';
    Object.assign(file.style, { opacity: '0.8', overflowWrap: 'anywhere' });

    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '18px' });

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy into Notebook and Open';
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    for (const button of [copyButton, cancelButton]) Object.assign(button.style, { padding: '8px 12px', cursor: 'pointer' });

    actions.append(cancelButton, copyButton);
    modal.append(title, message, file, actions);
    backdrop.append(modal);
    document.body.append(backdrop);

    const close = (accepted) => { backdrop.remove(); resolve(accepted); };
    copyButton.addEventListener('click', () => close(true));
    cancelButton.addEventListener('click', () => close(false));
  });
}

async function fetchPending() {
  const response = await fetch('/api/desktop-open/pending', { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) return { pending: null, count: 0 };
  return response.json();
}

async function cancelPending() {
  await fetch('/api/desktop-open/cancel', { method: 'POST', headers: { Accept: 'application/json' } });
}

async function importPending() {
  const response = await fetch('/api/desktop-open/import', { method: 'POST', headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || 'Failed to import file.');
  return payload;
}

export async function handleDesktopOpenStartup() {
  for (let guard = 0; guard < 50; guard += 1) {
    const { pending } = await fetchPending();
    if (!pending) return;

    if (pending.kind === 'inside') {
      openNotebookFile(pending.notebookRelativePath);
      await cancelPending();
      continue;
    }

    if (pending.kind === 'outside') {
      const accepted = await showOutsideModal(pending);
      if (!accepted) { await cancelPending(); continue; }
      const imported = await importPending();
      openNotebookFile(imported.notebookRelativePath);
      continue;
    }

    alert(pending.reason || 'Nodevision could not open the selected file.');
    await cancelPending();
  }
}
