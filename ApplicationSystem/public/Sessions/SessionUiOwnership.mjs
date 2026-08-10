// Nodevision/ApplicationSystem/public/Sessions/SessionUiOwnership.mjs
// This module temporarily grants a running Nodevision Session ownership of the index-page experience and restores the normal workspace afterward.

import { createPanelDOM } from "../panels/panelFactory.mjs";
import { openNodevisionOverlayPanel } from "../TemplateSystem/NodevisionOverlayPanel.mjs";

const STYLE_ID = "nv-session-ui-ownership-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
body.nv-session-mode #app-shell {
  visibility: hidden;
  pointer-events: none;
}
#nv-session-root {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  z-index: 1000;
  color: #f8fafc;
  background: linear-gradient(135deg, #10231b, #101827 58%, #1f2937);
  font: 15px system-ui, sans-serif;
}
#nv-session-root strong {
  font-size: 18px;
  letter-spacing: 0;
}
`;
  document.head.appendChild(style);
}

export class SessionUiOwnership {
  constructor(session = {}, options = {}) {
    this.session = session;
    this.onEscape = options.onEscape || (() => {});
    this.root = null;
    this.messagePanel = null;
    this.keyHandler = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      this.onEscape();
    };
  }

  take() {
    ensureStyles();
    document.body.classList.add("nv-session-mode");
    this.root = document.createElement("div");
    this.root.id = "nv-session-root";
    const title = document.createElement("strong");
    title.textContent = this.session.title || "Nodevision Session";
    this.root.appendChild(title);
    document.body.appendChild(this.root);
    window.addEventListener("keydown", this.keyHandler, true);
  }

  release() {
    window.removeEventListener("keydown", this.keyHandler, true);
    this.messagePanel?.remove();
    this.root?.remove();
    this.messagePanel = null;
    this.root = null;
    document.body.classList.remove("nv-session-mode");
  }

  async showMessage(message) {
    this.messagePanel?.remove();
    const created = await createPanelDOM("SessionOverlayPanel", `SessionOverlay-${Date.now()}`, "InfoPanel", {
      title: this.session.title || "Session",
      heading: this.session.title || "Session",
      message,
      choices: [{ label: "Continue", value: "continue", primary: true }],
      onDone: () => {
        this.messagePanel?.remove();
        this.messagePanel = null;
      },
    });
    this.messagePanel = created.panel;
    document.body.appendChild(created.panel);
    created.panel.__nvSetLayout?.("overlay", { onDismiss: () => null });
    return created.panel;
  }

  showPauseMenu() {
    return openNodevisionOverlayPanel("SessionOverlayPanel", {
      title: "Session Paused",
      heading: "Session Paused",
      message: this.session.title || "Nodevision Session",
      choices: [
        { label: "Resume", value: "resume", primary: true },
        { label: "Restart Session", value: "restart" },
        { label: "Quit", value: "quit" },
      ],
    });
  }

  showError(err) {
    return openNodevisionOverlayPanel("SessionOverlayPanel", {
      title: "Session Error",
      heading: "Session Error",
      message: err?.line ? `${err.message}\nLine ${err.line}` : (err?.message || "The Session stopped."),
      choices: [{ label: "Quit", value: "quit", primary: true }],
    });
  }
}

