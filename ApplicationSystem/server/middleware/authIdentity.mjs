// Nodevision/ApplicationSystem/server/middleware/authIdentity.mjs
// This file attaches authenticated identity information to incoming requests so that server routes can enforce access control consistently.

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

