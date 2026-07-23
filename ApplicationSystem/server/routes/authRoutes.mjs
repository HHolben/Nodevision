// Nodevision/ApplicationSystem/server/routes/authRoutes.mjs
// This file registers login, logout, session, and timeout endpoints so Nodevision can authenticate users and manage idle session expiry.

function sessionCookieOptions(expires) {
  const expiresMs = Math.max(Math.floor(Number(expires || 0) * 1000 - Date.now()), 0);
  return {
    httpOnly: true,
    sameSite: "lax",
    maxAge: expiresMs,
    path: "/",
  };
}

function setSessionCookie(res, token, expires) {
  res.cookie("nodevision_session", token, sessionCookieOptions(expires));
}

function clearSessionCookie(res) {
  res.clearCookie("nodevision_session", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

function identityPayload(identity) {
  if (!identity) return null;
  const { id, username, role, type } = identity;
  return { id, username, role, type };
}

export function registerAuthRoutes(app, AuthService) {
  app.get("/api/session", async (req, res) => {
    if (!req.identity) {
      return res.status(200).json({ loggedIn: false });
    }

    const settings = await AuthService.getSessionTimeoutSettings();
    res.status(200).json({
      loggedIn: true,
      identity: identityPayload(req.identity),
      expires: req.identity.expires || null,
      lastActivity: req.identity.lastActivity || null,
      ...settings,
    });
  });

  app.get("/api/session/timeout", async (req, res) => {
    try {
      if (!req.identity) return res.status(401).json({ error: "Authentication required" });
      const settings = await AuthService.getSessionTimeoutSettings();
      res.json({
        success: true,
        expires: req.identity.expires || null,
        lastActivity: req.identity.lastActivity || null,
        ...settings,
      });
    } catch (err) {
      console.error("Timeout settings read error", err);
      res.status(500).json({ error: "Unable to read timeout settings" });
    }
  });

  app.put("/api/session/timeout", async (req, res) => {
    try {
      if (!req.identity) return res.status(401).json({ error: "Authentication required" });
      const settings = await AuthService.updateSessionTimeoutSettings(req.body || {});
      const token = req.cookies?.nodevision_session;
      const session = await AuthService.touchSession(token);
      if (!session) {
        clearSessionCookie(res);
        return res.status(401).json({ error: "Session expired" });
      }
      setSessionCookie(res, token, session.expires);
      res.json({
        success: true,
        expires: session.expires,
        lastActivity: session.lastActivity || null,
        ...settings,
      });
    } catch (err) {
      console.error("Timeout settings update error", err);
      res.status(400).json({ error: err?.message || "Unable to update timeout settings" });
    }
  });

  app.post("/api/session/activity", async (req, res) => {
    try {
      const token = req.cookies?.nodevision_session;
      const session = await AuthService.touchSession(token);
      if (!session) {
        clearSessionCookie(res);
        return res.status(401).json({ error: "Session expired" });
      }
      setSessionCookie(res, token, session.expires);
      res.json({
        success: true,
        expires: session.expires,
        lastActivity: session.lastActivity || null,
        timeoutSeconds: session.timeoutSeconds,
      });
    } catch (err) {
      console.error("Session activity error", err);
      res.status(500).json({ error: "Unable to refresh session activity" });
    }
  });

  app.get("/login", (req, res) => {
    res.redirect("/");
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await AuthService.login({
        username,
        password,
        ip: req.ip,
      });

      setSessionCookie(res, result.token, result.expires);

      res.json({
        success: true,
        identity: result.identity,
        expires: result.expires,
        timeoutSeconds: result.timeoutSeconds,
      });
    } catch (err) {
      if (err?.message === "Invalid credentials") {
        return res.status(401).json({ error: "Invalid username or password" });
      }
      console.error("Login error", err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/logout", async (req, res) => {
    try {
      const token = req.cookies?.nodevision_session;
      await AuthService.logout(token);
      clearSessionCookie(res);
      res.json({ success: true });
    } catch (err) {
      console.error("Logout error", err);
      res.status(500).json({ error: "Logout failed" });
    }
  });
}
