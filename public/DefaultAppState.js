// DefaultAppState.js
// Purpose: TODO: Add description of module purpose

// Instead of just setting window.currentMode, we define a centralized state manager.
window.AppState = {
    currentMode: 'Viewing', // Default mode is "Viewing"
    _listeners: [], // Subscribers to mode changes

    // Returns the current mode.
    getMode() {
        return this.currentMode;
    },

    // Sets a new mode and notifies subscribers if the mode changes.
    setMode(newMode) {
        if (this.currentMode !== newMode) {
            this.currentMode = newMode;
            console.log(`App mode changed to: ${newMode}`);
            this._notifyListeners(newMode);
        }
    },

    // Subscribe to mode changes.
    subscribe(listener) {
        if (typeof listener === 'function') {
            this._listeners.push(listener);
        }
    },

    // Notify all subscribers of the mode change.
    _notifyListeners(newMode) {
        this._listeners.forEach(listener => listener(newMode));
    }
};
