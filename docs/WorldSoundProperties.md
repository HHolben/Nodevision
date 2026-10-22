# Sound properties in virtual worlds

Use **Insert → Sound → Place sound on shape**, then click a cylinder or another world shape. Choose an audio file, or enter a Notebook path such as `audio/rain.ogg`. Apply the sound. **Sound on selected shape** edits the currently inspected shape. The **Sound** inventory tool uses the same placement tool; Escape cancels picking.

In **Layers**, each shape offers **Add Sound property**. Once assigned, **Sound** appears as an indented child of that shape. Expand it to replace the source, change volume or audible range (world units), toggle looping/enabled, or remove the property. Each shape currently owns one sound property. Local files are embedded in the world; Notebook paths remain linked. `./` and `../` paths resolve relative to the world document.

Looping defaults on. Volume decreases linearly with distance from the shape's world-space origin, reaching silence at the audible range. Playback pauses outside the range and when the shape or an ancestor is hidden. Audio follows the shape as it moves. Browser autoplay restrictions are retried after a pointer or keyboard interaction. A nonlooping sound plays once per entry into range.

Sound properties save inside their owning object definition as `soundProperty`, preserving its geometry and type. Property edits and removal use world undo/redo. Removing a shape disposes its audio; undo restores it. Play/read-only permissions block authoring.

Validation:

```sh
node --test ApplicationSystem/public/MetaWorld/Sounds/SoundProperty.test.mjs
python3 scripts/test-sound-properties-browser.py
```

The browser fixture uses real world loading, serialization, history, placement and Layers controls. Playback state/distance checks use a deterministic audio double; a separate embedded WAV check exercises Chromium decoding. Audible speaker output requires a manual check.
