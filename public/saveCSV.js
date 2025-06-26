// saveCSV.js
export async function saveCSV(filePath, data) {
  // data: array of arrays
  const csvText = data.map(r => r.join(',')).join('\n');
  const res = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/csv' },
    body: csvText
  });
  if (!res.ok) throw new Error('Failed to save CSV: ' + res.statusText);
}