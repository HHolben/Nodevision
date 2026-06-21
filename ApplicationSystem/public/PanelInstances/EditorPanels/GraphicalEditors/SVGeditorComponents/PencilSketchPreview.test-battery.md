# Pencil Sketch Preview Angle Test Battery

Use this battery for the active sketch preview layer. Raw pencil strokes should remain visible underneath the ghost preview until the user accepts/renders the preview. These cases focus only on the two-segment angular polyline hypothesis.

1. One straight-ish stroke
   - Draw a single rough diagonal or angled stroke.
   - Expected: the preview preserves the raw stroke and does not auto-convert it into an angle.

2. Multiple rough strokes along one direction
   - Draw several nearby strokes along a single shared axis.
   - Expected: one straight-line ghost preview, not an angle.

3. Add multiple rough strokes forming a second direction from an apex
   - Draw one segment toward a corner, then draw enough strokes leaving the corner in another direction.
   - Expected: the preview changes to one clean two-segment angle.

4. Lower-left to upper apex, then upper apex to lower-right
   - Draw an inverted V / roof-like angle as one sketch preview.
   - Expected: one clean `M start L corner L end` ghost path with a preserved sharp corner.

5. Add extra rough strokes near either segment
   - Reinforce either side of the angle with nearby strokes.
   - Expected: each segment may adjust slightly, but the shared corner remains stable.

6. Add a small accidental hook near one segment
   - Add one short hook that does not have enough length/support to be a real second segment.
   - Expected: do not turn the whole sketch into an angle from the hook.

7. Accept the preview
   - Render/accept the angular preview.
   - Expected: final SVG geometry is one simple polyline/path with `M-L-L` commands and no Bezier handles.

Debug fields to watch when enabled:
- `winningHypothesis`
- `oneLineError`
- `bestTwoLineError`
- `improvementRatio`
- `cornerPoint`
- `angleBetweenSegments`
- `segmentLengthA`
- `segmentLengthB`
- `confidence`
