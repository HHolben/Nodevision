// Nodevision/ApplicationSystem/public/Widgets/WidgetHost.mjs
// Lightweight helpers for mounting reusable editor/viewer widgets.

export async function mountWidget(WidgetClass, options = {}) {
  if (typeof WidgetClass !== "function") {
    console.warn("[Nodevision Widgets] mountWidget expected a widget class.");
    return null;
  }
  const widget = new WidgetClass(options);
  if (typeof widget.mount === "function") await widget.mount();
  return widget;
}

export function destroyMountedWidget(widget) {
  if (widget && typeof widget.destroy === "function") widget.destroy();
}
