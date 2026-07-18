// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/chat.mjs
// Toggles the on-demand LAN cooperation chat panel.

import { setStatus } from "/StatusBar.mjs";
import { initLANCooperationChatPanel } from "/LANCooperationChatPanel.mjs";

export default function toggleLANChat() {
  const mounted = window.__nvLanCooperationChatPanelMounted;
  if (mounted?.panel?.isConnected) {
    mounted.dispose?.();
    setStatus("LAN chat", "Hidden");
    return;
  }

  const next = initLANCooperationChatPanel();
  next?.panel?.querySelector?.("[data-chat-input]")?.focus?.();
  setStatus("LAN chat", "Opened");
}
