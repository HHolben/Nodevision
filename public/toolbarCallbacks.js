// toolbarCallbacks.js
export const toolbarCallbacks = {
    // File category callbacks
    saveFile: () => {
      const filePath = window.currentActiveFilePath;
      if (filePath && typeof window.saveWYSIWYGFile === 'function') {
        window.saveWYSIWYGFile(filePath);
      } else {
        console.error("Cannot save: filePath or saveWYSIWYGFile is missing.");
      }
    },
    viewNodevisionDeployment: () => {
      const urlParams = new URLSearchParams(window.location.search);
      const activeNode = urlParams.get('activeNode');
      if (activeNode) {
        const deploymentUrl = `http://localhost:3000/${activeNode}`;
        window.open(deploymentUrl, "_blank");
      } else {
        alert("No active node specified in the URL.");
      }
    },
    viewPHPDeployment: () => {
      const urlParams = new URLSearchParams(window.location.search);
      const activeNode = urlParams.get('activeNode');
      if (activeNode) {
        const deploymentUrl = `http://localhost:8000/${activeNode}`;
        window.open(deploymentUrl, "_blank");
      } else {
        alert("No active node specified in the URL.");
      }
    },
  
    // Edit category callbacks
    editRASTER: () => {
      // Placeholder for edit RASTER functionality.
      // Replace with the actual implementation.
      console.log("Edit RASTER callback fired.");
    },
  
    // Settings category callbacks
    toggleViewMode: (state) => {
      console.log("Toggle View Mode callback fired. State:", state);
      const cyContainer = document.getElementById('cy');
      const fileViewContainer = document.getElementById('file-view');
  
      if (state) {
        // Show graph view.
        cyContainer.style.display = 'block';
        fileViewContainer.style.display = 'none';
        if (window.cy) {
          // Assuming initializeTheGraphStyles is defined elsewhere.
          initializeTheGraphStyles();
          cy.layout({
            name: 'cose',
            animate: true,
            fit: true,
            padding: 30,
            nodeRepulsion: 8000,
            idealEdgeLength: 50,
          }).run();
        }
      } else {
        // Show file view.
        cyContainer.style.display = 'none';
        fileViewContainer.style.display = 'block';
        if (typeof window.fetchDirectoryContents === 'function') {
          window.fetchDirectoryContents();
        } else {
          console.error("window.fetchDirectoryContents is not defined.");
        }
      }
    },
    togglePagePreviewMode: (state) => {
      console.log(state ? 'Preview Mode Enabled' : 'Preview Mode Disabled');
    },
  
    // Insert category callbacks
    insertText: () => {
      // This callback can be a no-op if the sub-toolbar is handling insert text options.
      console.log("Insert Text callback triggered.");
    },
    insertH1: () => {
      document.execCommand('insertHTML', false, '<h1>Heading 1</h1>');
    },
    insertH2: () => {
      const h2Element = `<h2>Heading 2</h2>`;
      document.execCommand('insertHTML', false, h2Element);
    },
    insertH3: () => {
      const h3Element = `<h3>Heading 3</h3>`;
      document.execCommand('insertHTML', false, h3Element);
    },
    insertH4: () => {
      const h4Element = `<h4>Heading 4</h4>`;
      document.execCommand('insertHTML', false, h4Element);
    },
    insertH5: () => {
      const h5Element = `<h5>Heading 5</h5>`;
      document.execCommand('insertHTML', false, h5Element);
    },
    insertH6: () => {
      const h6Element = `<h6>Heading 6</h6>`;
      document.execCommand('insertHTML', false, h6Element);
    },
    insertTable: () => {
      const table = document.createElement('table');
      table.style.borderCollapse = "collapse";
      for (let i = 0; i < 3; i++) { // Example: 3 rows
        const row = table.insertRow();
        for (let j = 0; j < 3; j++) { // Example: 3 columns
          const cell = row.insertCell();
          cell.style.border = "1px solid black";
          cell.textContent = "Cell";
        }
      }
      document.getElementById('editor').appendChild(table);
    },
    insertOrderedList: () => {
      const ol = `<ol><li>Ordered Item</li></ol>`;
      document.execCommand('insertHTML', false, ol);
    },
    insertUnorderedList: () => {
      const ul = `<ul><li>Unordered Item</li></ul>`;
      document.execCommand('insertHTML', false, ul);
    },
    insertItalics: () => {
      const italicElement = `<i>italics</i>`;
      document.execCommand('insertHTML', false, italicElement);
    },
    insertBold: () => {
      const boldElement = `<b>bold text</b>`;
      document.execCommand('insertHTML', false, boldElement);
    },
    insertUnderline: () => {
      const underlinedElement = `<ins>underlined</ins>`;
      document.execCommand('insertHTML', false, underlinedElement);
    },
    insertStrikethrough: () => {
      const strikethroughElement = `<del>strikethrough</del>`;
      document.execCommand('insertHTML', false, strikethroughElement);
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
        <div id="serial-monitor-container" 
             style="background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); max-width: 500px; margin: auto; margin-top: 20px;">
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
  
      // Attach event listener after insertion
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
                  const rows = data.split("\\n").map(row => row.split(","));
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
      // Note: This implementation assumes you have a QRCode library loaded.
      const generateQRCode = () => {
        const url = document.getElementById("urlInput")?.value;
        if (url) {
          QRCode.toDataURL(url, { errorCorrectionLevel: 'H' }, function (err, qrUrl) {
            if (err) {
              alert("Failed to generate QR code.");
              return;
            }
            const qrCodeDiv = document.getElementById("qrCode");
            qrCodeDiv.innerHTML = `<img src="${qrUrl}" alt="QR Code" />`;
            const copyButton = document.getElementById("copyButton");
            if (copyButton) {
              copyButton.disabled = false;
              copyButton.dataset.qrUrl = qrUrl;
            }
          });
        } else {
          alert("Please enter a URL.");
        }
      };
  
      const copyQRCode = () => {
        const copyButton = document.getElementById("copyButton");
        const qrUrl = copyButton?.dataset.qrUrl;
        if (qrUrl) {
          const tempInput = document.createElement("input");
          tempInput.value = qrUrl;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand("copy");
          document.body.removeChild(tempInput);
          alert("QR code URL copied to clipboard!");
        }
      };
  
      // Insert a container for QR code generation
      const qrContainer = `
        <div id="qr-container">
          <input type="text" id="urlInput" placeholder="Enter URL for QR Code" />
          <button id="generateQR">Generate QR Code</button>
          <div id="qrCode"></div>
          <button id="copyButton" disabled>Copy QR Code URL</button>
        </div>
      `;
      document.execCommand('insertHTML', false, qrContainer);
  
      // Attach event listeners after insertion
      setTimeout(() => {
        const generateBtn = document.getElementById("generateQR");
        const copyBtn = document.getElementById("copyButton");
        if (generateBtn) {
          generateBtn.addEventListener("click", (e) => {
            e.preventDefault();
            generateQRCode();
          });
        }
        if (copyBtn) {
          copyBtn.addEventListener("click", (e) => {
            e.preventDefault();
            copyQRCode();
          });
        }
      }, 100);
    }
  };
  