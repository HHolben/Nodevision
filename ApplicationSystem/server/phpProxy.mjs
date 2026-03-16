// Nodevision/ApplicationSystem/server/phpProxy.mjs
// This file defines proxy configuration for the local PHP server so that Nodevision can route /php traffic through Express reliably.

export const phpProxyOptions = {
  target: "http://localhost:8080",
  changeOrigin: true,
  pathRewrite: {
    "^/php": "",
  },
  onError: (err, req, res) => {
    console.error("PHP proxy error:", err.message);
    res.status(503).json({ error: "PHP server unavailable" });
  },
};

