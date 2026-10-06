// Nodevision/ApplicationSystem/public/panels/neutralLayoutPanel.mjs
// This module mounts a neutral file-panel shell during structural layout restoration. A document is opened only after an explicit user action, through the normal panel loader.
export function mountNeutralLayoutPanel(host, panelType, open) {
  const message = document.createElement('p'); message.textContent = `${panelType}: no document open.`;
  const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Open selected file';
  let lifecycle = null, disposed = false;
  button.onclick = async () => {
    button.disabled = true;
    try {
      host.replaceChildren(); lifecycle = await open();
      if (disposed) { if (typeof lifecycle === 'function') lifecycle(); else lifecycle?.destroy?.(); }
    } catch (error) { message.textContent = error.message; host.replaceChildren(message, button); button.disabled = false; }
  };
  host.replaceChildren(message, button);
  return { activate: () => lifecycle?.activate?.(), deactivate: () => lifecycle?.deactivate?.(), destroy() {
    disposed = true; if (typeof lifecycle === 'function') lifecycle(); else lifecycle?.destroy?.();
  } };
}
