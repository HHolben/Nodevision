const { app } = require('electron');

(async () => {
  try {
    const { setupElectronHandlers } = await import('./electron-main.js');
    setupElectronHandlers();
  } catch (err) {
    console.error('[electron-main] Failed to initialize Electron app', err);
    process.exit(1);
  }
})();
