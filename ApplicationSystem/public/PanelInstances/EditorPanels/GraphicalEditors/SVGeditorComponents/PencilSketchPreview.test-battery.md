# Pencil Sketch Preview Two-Segment Angle Test Battery

Use this battery for the active sketch preview layer. Raw pencil strokes should remain visible underneath the ghost preview until the user accepts/renders the preview. These cases focus only on the open two-segment angle hypothesis and full endpoint extension.

1. Lower-left to upper apex, choppy strokes
   - Draw several rough strokes along the first side.
   - Expected: first segment spans all compatible supporting strokes.

2. Apex to lower-right, choppy strokes
   - Draw several rough strokes along the second side.
   - Expected: second segment spans all compatible supporting strokes, not just points near the apex.

3. Second side with a gap
   - Leave a gap between second-side stroke fragments, then continue farther down/right along the same axis.
   - Expected: the second side still extends to the farthest compatible evidence.

4. One short accidental mark near the second side
   - Add one small mark that is not direction/perpendicular compatible with the second side.
   - Expected: do not extend the segment to that mark.

5. Full angle
   - Draw the complete lower-left to apex to lower-right angle.
   - Expected: preview is one clean `M outerEndpointA L corner L outerEndpointB` path with a stable corner and both sides fully extended.

Debug fields to watch when enabled:
- `winningHypothesis`
- `cornerPoint`
- `assignedCountA`
- `assignedCountB`
- `projectionMinA` / `projectionMaxA`
- `projectionMinB` / `projectionMaxB`
- `endpointA`
- `endpointB`
- `rejectedFarPointsA` / `rejectedFarPointsB`
- `strokeAssignments` with each stroke id, assigned segment, direction compatibility, midpoint distances, projected distances, support ratios, and rejection reason
- `segmentAAssignedStrokeCount` / `segmentBAssignedStrokeCount`
- `segmentBFarthestProjectedEndpoint`
- `segmentBEndpointSourceStrokeId`
- `assignmentTolerance` / `roughAssignmentTolerance`
