// insertCallbacks.js
export const insertCallbacks = {
  insertText: () => {
    console.log("Insert Text callback triggered.");
  },
  insertH1: () => {
    document.execCommand('insertHTML', false, '<h1>Heading 1</h1>');
  },
  insertH2: () => {
    document.execCommand('insertHTML', false, '<h2>Heading 2</h2>');
  },
  insertH3: () => {
    document.execCommand('insertHTML', false, '<h3>Heading 3</h3>');
  },
  insertH4: () => {
    document.execCommand('insertHTML', false, '<h4>Heading 4</h4>');
  },
  insertH5: () => {
    document.execCommand('insertHTML', false, '<h5>Heading 5</h5>');
  },
  insertH6: () => {
    document.execCommand('insertHTML', false, '<h6>Heading 6</h6>');
  },
  insertTable: () => {
    const table = document.createElement('table');
    table.style.borderCollapse = "collapse";
    for (let i = 0; i < 3; i++) {
      const row = table.insertRow();
      for (let j = 0; j < 3; j++) {
        const cell = row.insertCell();
        cell.style.border = "1px solid black";
        cell.textContent = "Cell";
      }
    }
    document.getElementById('editor').appendChild(table);
  },
  insertOrderedList: () => {
    document.execCommand('insertHTML', false, `<ol><li>Ordered Item</li></ol>`);
  },
  insertUnorderedList: () => {
    document.execCommand('insertHTML', false, `<ul><li>Unordered Item</li></ul>`);
  },
  insertItalics: () => {
    document.execCommand('insertHTML', false, `<i>italics</i>`);
  },
  insertBold: () => {
    document.execCommand('insertHTML', false, `<b>bold text</b>`);
  },
  insertUnderline: () => {
    document.execCommand('insertHTML', false, `<ins>underlined</ins>`);
  },
  insertStrikethrough: () => {
    document.execCommand('insertHTML', false, `<del>strikethrough</del>`);
  },
  insertSensitive: () => {
    const text = document.getSelection().toString() || prompt("Enter the sensitive text:");
    const sensitiveElement = `<style>@media print { .sensitive { display: none; } }</style>
      <div class="sensitive" style="padding: 20px; background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; margin: 10px 0;" onload="this.innerHTML='Content hidden for privacy';">${text}</div>`;
    document.execCommand('insertHTML', false, sensitiveElement);
  },
  insertBlankSVG: () => {
    const svgElement = `<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg" style="border: 1px solid black;">
      <rect width="100%" height="100%" fill="white"/>
    </svg>`;
    document.execCommand('insertHTML', false, svgElement);
  },
  insertVideo: () => {
    const videoFile = prompt("Enter the name of the video file (with extension):");
    if (videoFile) {
      const videoElement = `
        <video controls width="600">
          <source src="/${videoFile}" type="video/mp4">
          Your browser does not support the video tag.
        </video>`;
      document.execCommand('insertHTML', false, videoElement);
    } else {
      alert("Video file name is required.");
    }
  },
  insertSerialMonitor: () => {
    const serialMonitorElement = `
      <div id="serial-monitor-container" style="background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); max-width: 500px; margin: auto; margin-top: 20px;">
        <form id="serial-config-form">
          <label for="serial-port" style="font-weight: bold;">Port:</label>
          <input type="text" id="serial-port" placeholder="/dev/ttyUSB0" style="margin-top: 5px; padding: 8px; font-size: 16px; width: 100%;">
          <label for="baud-rate" style="font-weight: bold;">Baud Rate:</label>
          <input type="number" id="baud-rate" placeholder="9600" style="margin-top: 5px; padding: 8px; font-size: 16px; width: 100%;">
          <button type="submit" style="margin-top: 5px; padding: 8px; font-size: 16px; width: 100%; background: #007bff; color: white; border: none; cursor: pointer;"
                  onmouseover="this.style.background='#0056b3'" onmouseout="this.style.background='#007bff'">
            Update
          </button>
        </form>
        <pre id="serial-output" style="background: black; color: #0f0; padding: 10px; height: 200px; overflow-y: auto; white-space: pre-wrap; margin-top: 10px;">
        <!-- Serial content will be displayed here -->
        </pre>
      </div>
    `;
    document.execCommand('insertHTML', false, serialMonitorElement);
    setTimeout(() => {
      const form = document.getElementById('serial-config-form');
      if (form) {
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          const port = document.getElementById('serial-port').value;
          const baudRate = document.getElementById('baud-rate').value;
          const output = document.getElementById('serial-output');
          output.textContent += `\nPort set to: ${port}, Baud Rate set to: ${baudRate}`;
          output.scrollTop = output.scrollHeight;
        });
      } else {
        console.error('Serial Monitor form not found.');
      }
    }, 100);
  },
  insertCSV: () => {
    const CSVfile = prompt("Enter the relative path of the CSV file (with extension):");
    if (CSVfile) {
      const CSVtableElement = `
        <table id="${CSVfile}">
          <thead></thead>
          <tbody></tbody>
        </table>
        <script>
          (function loadCsv() {
            fetch('${CSVfile}')
              .then(response => response.text())
              .then(data => {
                const rows = data.split("\n").map(row => row.split(","));
                const table = document.getElementById("${CSVfile}");
                const thead = table.querySelector("thead");
                const tbody = table.querySelector("tbody");
                thead.innerHTML = "";
                tbody.innerHTML = "";
                if (rows.length > 0) {
                  const headerRow = document.createElement("tr");
                  rows[0].forEach(headerText => {
                    const th = document.createElement("th");
                    th.textContent = headerText.trim();
                    headerRow.appendChild(th);
                  });
                  thead.appendChild(headerRow);
                }
                rows.slice(1).forEach(row => {
                  if (row.length === 1 && row[0].trim() === "") return;
                  const tr = document.createElement("tr");
                  row.forEach(cellText => {
                    const td = document.createElement("td");
                    td.textContent = cellText.trim();
                    tr.appendChild(td);
                  });
                  tbody.appendChild(tr);
                });
              })
              .catch(error => {
                console.error("Error fetching or parsing the CSV file:", error);
                document.getElementById("${CSVfile}").innerHTML = "Error loading CSV file.";
              });
            setTimeout(loadCsv, 5000);
          })();
        </script>
      `;
      document.execCommand('insertHTML', false, CSVtableElement);
    } else {
      alert("CSV filename (relative path) is required.");
    }
  },
  insertQRcode: () => {
    // ... existing QR code insertion ...
  },
  insertFlashCards: () => {
    const CSVfile = prompt("Enter the relative path of your CSV file (with extension):");
    if (!CSVfile) return alert("CSV filename (relative path) is required.");

    // Helper: load PapaParse if it isn't already
    function loadPapaParse() {
      return new Promise((resolve, reject) => {
        if (window.Papa) return resolve(window.Papa);

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.3.2/papaparse.min.js';
        script.onload = () => {
          if (window.Papa) resolve(window.Papa);
          else reject(new Error('PapaParse loaded but window.Papa is missing'));
        };
        script.onerror = () => reject(new Error('Failed to load PapaParse library'));
        document.head.appendChild(script);
      });
    }

    loadPapaParse()
      .then(Papa => fetch(CSVfile)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.text();
        })
        .then(csvText => {
          const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
          });
          if (parsed.errors.length) {
            console.warn('PapaParse errors:', parsed.errors);
            throw new Error('CSV parsing error — see console for details.');
          }

          // Build card objects safely
          const cards = parsed.data
            .map(row => ({
              front: (row.front || '').trim(),
              back:  (row.back  || '').trim()
            }))
            .filter(c => c.front && c.back);

          if (!cards.length) {
            throw new Error("No valid cards found — ensure you have 'front' and 'back' columns.");
          }

          // Create a unique deck container
          const containerId = `flash-deck-${Date.now()}`;
          const container = document.createElement('div');
          container.id = containerId;
          container.className = 'flash-deck';
          container.style.margin = '20px 0';
          document.getElementById('editor').appendChild(container);

          // Render UI
          let idx = 0;
          const cardEl = document.createElement('div');
          cardEl.className = 'flash-card';
          Object.assign(cardEl.style, {
            cursor: 'pointer',
            border: '1px solid #ccc',
            padding: '16px',
            borderRadius: '4px',
            textAlign: 'center',
            fontSize: '1.1em',
            userSelect: 'none',
            marginBottom: '10px'
          });
          container.appendChild(cardEl);

          const render = () => {
            const side = cardEl.dataset.showing === 'back' ? 'back' : 'front';
            cardEl.textContent = cards[idx][side];
          };
          cardEl.dataset.showing = 'front';
          render();

          cardEl.addEventListener('click', () => {
            cardEl.dataset.showing = cardEl.dataset.showing === 'front' ? 'back' : 'front';
            render();
          });

          const nav = document.createElement('div');
          Object.assign(nav.style, { display: 'flex', justifyContent: 'space-between', width: '200px' });
          const makeBtn = (text, delta) => {
            const b = document.createElement('button');
            b.textContent = text;
            b.addEventListener('click', () => {
              idx = (idx + delta + cards.length) % cards.length;
              cardEl.dataset.showing = 'front';
              render();
            });
            return b;
          };
          nav.append(makeBtn('Prev', -1), makeBtn('Next', +1));
          container.appendChild(nav);
        }))
      .catch(err => {
        console.error('Error loading flash cards:', err);
        alert(`Error loading flash cards: ${err.message}`);
      });
  }
};