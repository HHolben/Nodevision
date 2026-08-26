<!-- Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/README.md -->
<!-- This document explains the reusable image-map editor modules and how graphical editors should call them. -->

# Image Map Editor

The image-map editor creates ordinary HTML:

```html
<img src="relative-or-absolute-image.png" usemap="#image-map" alt="">
<map name="image-map">
  <area shape="rect" coords="0,0,100,100" href="target.html" alt="">
</map>
```

`HtmlImageMapAdapter.mjs` is the HTML/WYSIWYG adapter. It opens `ImageMapEditorPanel`, inserts new maps at the saved caret, and edits the selected `img[usemap]` plus its matching `map[name]` in place.

The reusable core is split by concern:

- `ImageMapModel.mjs`: model normalization and coordinate validation.
- `ImageMapSerialization.mjs`: parsing, serialization, and DOM application.
- `ImageMapGeometry.mjs`: intrinsic coordinate conversion and shape editing helpers.
- `ImageMapEditorView.mjs`: editor toolbar, keyboard behavior, and composition.
- `ImageMapCanvas.mjs`: pointer drawing and manipulation.
- `ImageMapSourceChooser.mjs`: Notebook image selection and blank SVG/PNG creation.

Notebook image sources and picked area hrefs use Nodevision's canonical Notebook path helpers so saved HTML remains portable and graph link moves can retarget area links like regular anchors.
