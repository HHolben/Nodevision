// Nodevision/scripts/astronomy-sandbox-browser.mjs
// This entry point runs actual Sandbox lifecycle checks with a fixed host-time source while leaving the simulation clock independent.
window.nvTestAstronomy=true;
Date.now=()=>Date.parse('2026-10-07T18:00:00Z');
await import('./sandbox-session-browser.mjs');
