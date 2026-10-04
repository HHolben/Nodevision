// Nodevision/ApplicationSystem/public/panels/panelRemovalCleanup.mjs
// This module releases a factory panel's content and shell resources after its mounted DOM is removed, including overlays whose factory does not use workspace tab lifecycle hooks.
export function observePanelRemoval(panel, cleanup) {
  let mounted = panel.isConnected;
  const observer = new MutationObserver(records => {
    mounted ||= panel.isConnected || records.some(record => [...record.addedNodes].some(node => node === panel || node.contains?.(panel)));
    if (!mounted || panel.isConnected) return;
    observer.disconnect();
    cleanup();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
