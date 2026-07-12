// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/QuickMenuWidget.mjs
// Configurable compact radial/near-pointer menu for SVG editor actions.

const DEFAULT_LABELS = {
  brush: "Brush",
  eraser: "Eraser",
  eyedropper: "Eyedropper",
  select: "Select",
  transform: "Transform",
  duplicate: "Duplicate",
  bringForward: "Bring Forward",
  sendBackward: "Send Backward",
};

function keepInViewport(menu, x, y) {
  const rect = menu.getBoundingClientRect();
  const margin = 10;
  const left = Math.min(window.innerWidth - rect.width - margin, Math.max(margin, x));
  const top = Math.min(window.innerHeight - rect.height - margin, Math.max(margin, y));
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function actionLabel(action) {
  return DEFAULT_LABELS[action] || String(action || "Action");
}

export function createQuickMenuWidget(options = {}) {
  const actionHandlers = options.actionHandlers || {};
  let menu = null;
  let longPressTimer = 0;
  let start = null;

  function ensureMenu() {
    if (menu?.isConnected) return menu;
    menu = document.createElement("div");
    menu.dataset.nvSvgQuickMenu = "true";
    menu.setAttribute("role", "menu");
    menu.tabIndex = -1;
    Object.assign(menu.style, {
      position: "fixed",
      zIndex: "25000",
      display: "none",
      gridTemplateColumns: "repeat(2, minmax(112px, 1fr))",
      gap: "6px",
      padding: "8px",
      border: "1px solid rgba(17,24,39,0.28)",
      borderRadius: "8px",
      background: "rgba(255,255,255,0.96)",
      boxShadow: "0 10px 28px rgba(0,0,0,0.22)",
      maxWidth: "min(320px, calc(100vw - 20px))",
    });
    menu.addEventListener("keydown", (event) => {
      const buttons = Array.from(menu.querySelectorAll("button"));
      const current = document.activeElement;
      const index = buttons.indexOf(current);
      if (event.key === "Escape") {
        hide();
        event.preventDefault();
        return;
      }
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      if (!buttons.length) return;
      const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
      buttons[(index + delta + buttons.length) % buttons.length]?.focus();
      event.preventDefault();
    });
    document.body.appendChild(menu);
    return menu;
  }

  function hide() {
    if (menu) menu.style.display = "none";
    window.removeEventListener("pointerdown", outsidePointer, true);
  }

  function outsidePointer(event) {
    if (menu?.contains(event.target)) return;
    hide();
  }

  function show(clientX, clientY, settings = {}) {
    const host = ensureMenu();
    host.innerHTML = "";
    const slots = Array.isArray(settings.quickMenuActionSlots)
      ? settings.quickMenuActionSlots
      : ["brush", "eraser", "eyedropper", "select", "transform", "duplicate", "bringForward", "sendBackward"];
    slots.forEach((action) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = actionLabel(action);
      btn.setAttribute("role", "menuitem");
      btn.setAttribute("aria-label", actionLabel(action));
      Object.assign(btn.style, {
        minHeight: "40px",
        minWidth: "104px",
        border: "1px solid #c8d0da",
        borderRadius: "6px",
        background: "#f8fafc",
        color: "#111827",
        fontSize: "13px",
        cursor: "pointer",
      });
      btn.addEventListener("click", () => {
        actionHandlers[action]?.();
        hide();
      });
      host.appendChild(btn);
    });
    host.style.display = "grid";
    keepInViewport(host, clientX + 10, clientY + 10);
    const first = host.querySelector("button");
    setTimeout(() => first?.focus?.({ preventScroll: true }), 0);
    window.addEventListener("pointerdown", outsidePointer, true);
  }

  function cancelLongPress() {
    if (longPressTimer) window.clearTimeout(longPressTimer);
    longPressTimer = 0;
    start = null;
  }

  function scheduleLongPress(event, settings = {}, isEligible = () => true) {
    cancelLongPress();
    if (!settings.gestureLongPressQuickMenu || !isEligible(event)) return false;
    start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    longPressTimer = window.setTimeout(() => {
      longPressTimer = 0;
      if (!start) return;
      show(start.x, start.y, settings);
    }, Math.max(150, Number(settings.quickMenuLongPressMs) || 550));
    return true;
  }

  function onPointerMove(event, tolerance = 10) {
    if (!start || event.pointerId !== start.pointerId) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > tolerance) cancelLongPress();
  }

  return {
    show,
    hide,
    scheduleLongPress,
    cancelLongPress,
    onPointerMove,
    isOpen() {
      return menu?.style.display !== "none";
    },
  };
}

