// Nodevision/ApplicationSystem/server/phpProxy.mjs
// This file defines proxy configuration for the local PHP server so that Nodevision can route /php traffic through Express reliably.

const DEFAULT_PHP_TARGET = "http://127.0.0.1:8080";

export function createPhpProxyOptions(runtimeConfig = {}) {
  const explicitTarget =
    runtimeConfig?.phpProxyTarget ||
    (process.env.NODEVISION_PHP_URL ? String(process.env.NODEVISION_PHP_URL) : null);

  const target = explicitTarget || DEFAULT_PHP_TARGET;

  return {
    target,
    changeOrigin: true,
    pathRewrite: {
      "^/php": "",
    },
    onError: (err, req, res) => {
      console.error("PHP proxy error:", err.message);
      res.status(503).json({ error: "PHP server unavailable" });
    },
  };
}
