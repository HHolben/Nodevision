// Nodevision/public/InfoPanel.js
// Purpose: Refresh the file on display in the info panel.

import React, { useEffect, useState } from 'react';
import { updateInfoPanel } from './InfoPanel.js'; // ES module import

export function FileView({ initialPath = '' }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch directory contents
  async function fetchDirectoryContents(path) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/Notebook/${path}`);
      if (!response.ok) throw new Error('Failed to fetch directory');
      const data = await response.json();
      setFiles(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // On mount, fetch initial directory
  useEffect(() => {
    fetchDirectoryContents(initialPath);
  }, [initialPath]);

  return (
    <div id="file-view" style={{ padding: '10px' }}>
      {loading && <div style={{ textAlign: 'center' }}>Loading...</div>}
      {error && <div style={{ textAlign: 'center', color: 'red' }}>{error}</div>}
      <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
        {files.map(f => (
          <li key={f.name}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                updateInfoPanel(f.name); // call InfoPanel update
              }}
            >
              {f.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}