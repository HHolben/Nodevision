// public/initCSVEditor.js
// Purpose: TODO: Add description of module purpose



// initCSVEditor.js
import { loadCSV } from './loadCSV.js';
import { saveCSV } from './saveCSV.js';

let csvData = [];

export async function initCSVEditor(containerSelector, filePath) {
  const container = document.querySelector(containerSelector);
  container.innerHTML = '<div id="csv-editor"></div>';
  const editorEl = container.querySelector('#csv-editor');

  try {
    csvData = await loadCSV(filePath);
  } catch (err) {
    editorEl.innerText = 'Error loading CSV: ' + err.message;
    return;
  }
  // Build table
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  csvData.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    row.forEach((cell, colIndex) => {
      const td = document.createElement(rowIndex === 0 ? 'th' : 'td');
      td.contentEditable = 'true';
      td.innerText = cell;
      td.style.border = '1px solid #ccc';
      td.style.padding = '4px';
      td.addEventListener('input', () => {
        csvData[rowIndex][colIndex] = td.innerText;
      });
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  editorEl.appendChild(table);

  // Hook Save button
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      try {
        await saveCSV(filePath, csvData);
        console.log('CSV saved');
      } catch (err) {
        console.error(err);
      }
    };
  }
}
