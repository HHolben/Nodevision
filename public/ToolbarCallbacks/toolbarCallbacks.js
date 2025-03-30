// toolbarCallbacks.js
import { fileCallbacks } from './fileCallbacks.js';
import { editCallbacks } from './editCallbacks.js';
import { settingsCallbacks } from './settingsCallbacks.js';
import { insertCallbacks } from './insertCallbacks.js';

export const toolbarCallbacks = {
  ...fileCallbacks,
  ...editCallbacks,
  ...settingsCallbacks,
  ...insertCallbacks
};
