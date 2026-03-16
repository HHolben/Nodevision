// Nodevision/ApplicationSystem/server/middleware/authIdentity.mjs
// This file defines auth Identity middleware for the Nodevision server. It inspects requests and enforces request-handling policies.

export function identityMiddleware(AuthService) {
  return async (req, res, next) => {
    try {
      req.identity = await AuthService.authenticateRequest(req);
    } catch (err) {
      return next(err);
    }
    next();
  };
}

export function requireAuthentication(req, res, next) {
  if (req.identity) return next();
  return res.redirect("/");
}
