// Nodevision/ApplicationSystem/server/middleware/requestSizeError.mjs
// This middleware turns body parser size failures into a stable recovery response without changing allocation limits or exposing request content.
export function requestSizeError(error, req, res, next) {
  if (error?.type !== 'entity.too.large') return next(error);
  return res.status(413).json({ code: 'REQUEST_TOO_LARGE', error: 'The document exceeds the save request size limit.',
    ...(Number.isFinite(error.limit) ? { limitBytes: error.limit } : {}) });
}
