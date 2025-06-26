// loadCSV.js
export async function loadCSV(filePath) {
  const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) throw new Error('Failed to load CSV: ' + res.statusText);
  const text = await res.text();
  // Simple CSV parse (no quotes support)
  return text.trim().split('\n').map(row => row.split(','));
}