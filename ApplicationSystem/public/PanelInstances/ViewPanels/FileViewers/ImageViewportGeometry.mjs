// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ImageViewportGeometry.mjs
// This module maps visible keyboard movement into image-local coordinates using the inverse linear view transform and computes native-pixel image extents without resampling.
export function imageViewMatrix(angle = 0, zoom = 1) {
  const radians = angle * Math.PI / 180, c = Math.cos(radians) * zoom, s = Math.sin(radians) * zoom;
  return { a: c, b: s, c: -s, d: c };
}
export function screenToImageDelta(matrix, x, y) {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return { x: 0, y: 0 };
  return { x: (matrix.d * x - matrix.c * y) / determinant, y: (-matrix.b * x + matrix.a * y) / determinant };
}
export function imageViewBounds(width, height, angle = 0, zoom = 1) {
  const m = imageViewMatrix(angle, zoom);
  return { width: Math.abs(m.a) * width + Math.abs(m.c) * height, height: Math.abs(m.b) * width + Math.abs(m.d) * height };
}
