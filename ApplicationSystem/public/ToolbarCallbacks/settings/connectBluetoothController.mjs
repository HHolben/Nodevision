// Nodevision/ApplicationSystem/public/ToolbarCallbacks/settings/connectBluetoothController.mjs
// Opens the Bluetooth/HID controller connection overlay.

export default async function connectBluetoothController() {
  const { openBluetoothControllerOverlay } = await import("/Settings/BluetoothControllerOverlay.mjs");
  openBluetoothControllerOverlay();
}
