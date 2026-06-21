# Pencil Sketch Preview Straight-Line Test Battery

Use this battery for the active sketch preview layer. Raw pencil strokes should remain visible underneath the ghost preview until the user accepts/renders the preview. These cases focus only on the open straight-line hypothesis.

1. Straight line, single stroke
   - Draw one diagonal or horizontal stroke.
   - Expected: the preview preserves the raw stroke and does not auto-straighten.

2. Several short strokes from lower-left to upper-right
   - Draw multiple nearby strokes along one shared diagonal axis.
   - Expected: one clean diagonal ghost line spans the min/max projected endpoints.

3. Add a short stroke slightly below the established line
   - Draw the diagonal line first, then add one nearby parallel stroke below it.
   - Expected: the preview remains one clean diagonal line. It may shift slightly, but must not bend, kink, or collapse into the local stroke.

4. Add a short stroke slightly above the established line
   - Draw the diagonal line first, then add one nearby parallel stroke above it.
   - Expected: the preview remains one clean diagonal line. It may shift slightly, but must not bend, kink, or collapse into the local stroke.

5. Add a short stroke extending the line farther along the same axis
   - Draw a short compatible stroke beyond one projected endpoint.
   - Expected: the preview remains a clean line and extends in that direction.

6. Add a short stroke crossing the line at a very different angle
   - Draw a crossing stroke that clearly violates the established direction.
   - Expected: straight-line confidence drops; the line hypothesis should not be forced if the conflict is strong.

7. Accept the preview
   - Render/accept the straight-line preview.
   - Expected: final SVG geometry is a simple `<line>` or an `M/L` path with two endpoints, not a Bezier path with many handles.
