# Nodevision Widgets

Widgets are reusable UI tools that mount inside an editor, viewer, or panel. They are smaller than full panels and are meant for editor-adjacent controls that can be shared across related file types.

Panels own workspace layout and major regions of the application. Widgets live inside those regions: a viewport overlay, a small control strip, a readout, or an embedded tool shared by multiple editors.

Editors mount widgets by importing the widget class and using `mountWidget`:

```js
import { mountWidget } from "/Widgets/WidgetHost.mjs";
import { ViewportOrientationWidget } from "/Widgets/ViewportOrientationWidget.mjs";

const widget = await mountWidget(ViewportOrientationWidget, {
  container,
  viewAdapter: {
    getCamera: () => camera,
    getControls: () => controls,
    getViewportElement: () => container,
    requestRender: () => render(),
  },
});

widget.destroy();
```

The first shared widget is `ViewportOrientationWidget`, the XYZ orientation gizmo for Three.js viewports. It owns its DOM and WebGL overlay, places snap controls at the positive and negative axis tips, exposes clickable axis-rotation arcs, supports cleanup through `destroy()`, and uses an adapter so hosts can provide camera/control behavior without hard-coding a specific editor.

Future reusable editor tools should be added under `ApplicationSystem/public/Widgets/`, expose a small mount/destroy lifecycle, accept host options or an adapter object, and avoid assuming a specific panel or editor unless that dependency is passed explicitly.
