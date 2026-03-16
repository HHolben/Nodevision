// Nodevision/ApplicationSystem/server/routes/authRoutes.mjs
// This file registers login, logout, and session endpoints so that the Nodevision client can authenticate users and maintain sessions via cookies.

export function registerAuthRoutes(app, AuthService) {
  app.get("/api/session", (req, res) => {
    if (!req.identity) {
      return res.status(200).json({ loggedIn: false });
    }

    const { id, username, role, type } = req.identity;
    res.status(200).json({
      loggedIn: true,
      identity: { id, username, role, type },
    });
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

      const expiresMs = Math.max(result.expires * 1000 - Date.now(), 0);
      res.cookie("nodevision_session", result.token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: expiresMs,
        path: "/",
      });

      res.json({
        success: true,
        identity: result.identity,
        expires: result.expires,
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
      res.clearCookie("nodevision_session", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
      res.json({ success: true });
    } catch (err) {
      console.error("Logout error", err);
      res.status(500).json({ error: "Logout failed" });
    }
  });
}

