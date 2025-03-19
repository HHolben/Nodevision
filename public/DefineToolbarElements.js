import { toolbarCallbacks } from './toolbarCallbacks.js';

/**
 * Loads and merges toolbar configuration from multiple JSON files.
 * @param {Array<string>} configUrls - Array of JSON configuration file URLs.
 * @returns {Promise<Array>} - A promise that resolves with the merged toolbar items.
 */
export async function loadToolbarElements(configUrls = [
  'fileToolbar.json',
  'editToolbar.json',
  'settingsToolbar.json',
  'viewToolbar.json',
  'searchToolbar.json',
  'userToolbar.json',
  'insertToolbar.json'
]) {
  try {
    // Fetch all configuration files concurrently.
    const responses = await Promise.all(
      configUrls.map(url => fetch(url).then(response => {
        if (!response.ok) {
          throw new Error(`Error loading ${url}: ${response.statusText}`);
        }
        return response.json();
      }))
    );

    // Merge arrays from each JSON file into a single array.
    const mergedData = responses.flat();

    // Map callback keys to actual functions.
    const boxes = mergedData.map(item => {
      if (item.callbackKey) {
        return { ...item, callback: toolbarCallbacks[item.callbackKey] };
      }
      return item;
    });

    return boxes;
  } catch (error) {
    console.error('Failed to load toolbar configuration:', error);
    return [];
  }
}
