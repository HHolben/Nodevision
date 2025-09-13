//Nodevision/public/ToolbarCallbacks/insertCallbacks.js
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
    insertParagraph: () => {
    document.execCommand('insertHTML', false, '<p>new paragraph </p>');
  },
      insertFooter: () => {
    document.execCommand('insertHTML', false, '<footer>footer</footer>');
  },
      insertSuperscript: () => {
    document.execCommand('insertHTML', false, '<sup>superscript</sup>');
  },
  
  insertDIV: () => {

      const cols = parseInt(prompt("How many DIVs per row?", "3"), 10);
      const rows = parseInt(prompt("How many rows?", "1"), 10);
  
      if (isNaN(cols) || isNaN(rows) || cols < 1 || rows < 1) {
          alert("Please enter valid positive numbers for rows and columns.");
          return;
      }
  
      let gridHTML = `<div class="nv-grid" style="display: flex; flex-direction: column; gap: 10px;">`;
  
      for (let r = 1; r <= rows; r++) {
          gridHTML += `<div class="nv-row" style="display: flex; gap: 10px;">`;
          for (let c = 1; c <= cols; c++) {
              gridHTML += `<div class="nv-cell" style="flex: 1; border: 1px dashed #ccc; min-height: 50px; padding: 5px;">Cell ${r}-${c}</div>`;
          }
          gridHTML += `</div>`;
      }
  
      gridHTML += `</div>`;
  
      // Insert the generated grid at the caret position
      document.execCommand('insertHTML', false, gridHTML);
  
  
  const inputField = document.getElementById('editor');
  
  
  
  inputField.addEventListener('keydown', onInsertDIVShortcut);

  },

insertFootnote: () => {
  const note = prompt("Enter the footnote text:");
  if (!note) return;

  const editor = document.getElementById('editor');

  // Ensure <footer> and <ol> exist
  let footer = editor.querySelector('footer');
  if (!footer) {
    footer = document.createElement('footer');
    footer.innerHTML = `<h3>Footnotes</h3><ol id="footnotes-list"></ol>`;
    editor.appendChild(footer);
  } else if (!footer.querySelector('#footnotes-list')) {
    footer.innerHTML += `<h3>Footnotes</h3><ol id="footnotes-list"></ol>`;
  }

  const footnotesList = footer.querySelector('#footnotes-list');

  // === TEMP ID placeholders ===
  const tempId = Date.now();
  const refId = `temp-ref-${tempId}`;
  const noteId = `temp-note-${tempId}`;

  // === 1. Insert footnote reference at caret ===
  const sel = window.getSelection();
  if (sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.innerHTML = `<sup id="${refId}"><a href="#${noteId}" style="vertical-align: super;">?</a></sup>`;
    range.deleteContents();
    range.insertNode(span);
  }

  // === 2. Append new <li> for footnote ===
  const li = document.createElement('li');
  li.id = noteId;
  li.innerHTML = `${note} <a href="#${refId}" style="text-decoration:none;">↩</a>`;
  footnotesList.appendChild(li);

  // === 3. Give the DOM a moment to process (safety) ===
  setTimeout(() => {
    // === 4. Get all <sup><a> footnote references in document order ===
    const refs = Array.from(editor.querySelectorAll('sup > a[href^="#footnote-"], sup > a[href^="#temp-note-"]'));
    const lis = Array.from(footnotesList.querySelectorAll('li'));

    // Sort both by visual/top order
    refs.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    lis.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);

    refs.forEach((a, i) => {
      const newNum = i + 1;
      const newRefId = `footnote-ref-${newNum}`;
      const newNoteId = `footnote-${newNum}`;

      // Update reference (sup > a)
      const sup = a.parentElement;
      sup.id = newRefId;
      a.href = `#${newNoteId}`;
      a.textContent = newNum;

      // Update note <li>
      const li = lis[i];
      li.id = newNoteId;
      const back = li.querySelector('a[href^="#"]');
      if (back) back.href = `#${newRefId}`;
    });

    // Optional: scroll to the new footnote
    lis[refs.length - 1]?.scrollIntoView({ behavior: 'smooth' });
  }, 0); // Short delay to ensure new elements are registered in DOM
}
,




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




InsertCollapsible() {
    
    var SensitiveElement = ` <button type="button" style="background-color:#777;color:white;cursor:pointer;width:100%;border:none;text-align:left;outline:none;font-size:15px" onclick="this.classList.toggle('active');var content=this.nextElementSibling;content.style.display=content.style.display==='block'?'none':'block';this.style.backgroundColor=this.classList.contains('active')?'#555':'#777';">Open/Close Collapsible</button><section style="padding:0 18px;display:none;overflow:hidden;background-color:#f1f1f1;">COLLAPSABLE TEXT HERE.</section>`;

    document.execCommand('insertHTML', false, SensitiveElement);
},




insertQuote() {
    const text = document.getSelection().toString() || prompt("Enter the quote text:");
    const quoteElement = `<q>${text}</q>`;
    document.execCommand('insertHTML', false, quoteElement);
},



insertAbbreviation() {
    const abbreviation = prompt("Enter the abbreviation:");
    const title = prompt("Enter the full form (title):");
    const abbrElement = `<abbr title="${title}">${abbreviation}</abbr>`;
    document.execCommand('insertHTML', false, abbrElement);
},
insertAddress() {
    const address = prompt("Enter the address:");
    const addressElement = `<address>${address}</address>`;
    document.execCommand('insertHTML', false, addressElement);
},

insertBlockquote() {
    const text = document.getSelection().toString() || prompt("Enter the blockquote text:");
    const blockquoteElement = `<blockquote>${text}</blockquote>`;
    document.execCommand('insertHTML', false, blockquoteElement);
},

InsertCodeElement() {
    const CodeElement = `<code>print("Hello, World!")</code>`;
    document.execCommand('insertHTML', false, CodeElement);
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
      // Assumes a QRCode library is available.
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
      const qrContainer = 
        `<div id="qr-container">
          <input type="text" id="urlInput" placeholder="Enter URL for QR Code" />
          <button id="generateQR">Generate QR Code</button>
          <div id="qrCode"></div>
          <button id="copyButton" disabled>Copy QR Code URL</button>
        </div>`
      ;
      document.execCommand('insertHTML', false, qrContainer);
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
    },
  
   insertLink() {
      const url = prompt("Enter the URL:");
      const text = document.getSelection().toString() || prompt("Enter the link text:");
      const linkElement = `<a href="${url}" target="_blank">${text}</a>`;
      document.execCommand('insertHTML', false, linkElement);
  },

insertIFRAME()
{
    const url = prompt("Enter the URL:");
    const text = document.getSelection().toString() || prompt("Enter the title:");
    const iFrameElement = `<iframe src="${url}" title=${text}</a>`;
    document.execCommand('insertHTML', false, iFrameElement);
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
    },
 insertPrism: () => {
    console.log("Insert Prism callback fired.");

    // Ensure VR world context exists
    if (!window.VRWorldContext) {
      alert("VR World context is not available.");
      return;
    }

    const { scene, objects, THREE } = window.VRWorldContext;

    // Create triangular prism by extruding a triangle shape
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(1, 0);
    shape.lineTo(0.5, 1);
    shape.lineTo(0, 0);

    const extrudeSettings = { steps: 1, depth: 1, bevelEnabled: false };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    const material = new THREE.MeshStandardMaterial({ color: 0xff00ff });
    const prism = new THREE.Mesh(geometry, material);

    // Position prism in front of camera for visibility
    prism.position.set(0, 0.5, -2);

    // Add to scene + object tracking array
    scene.add(prism);
    if (objects) {
      objects.push(prism);
    }

    console.log("Prism inserted into VR world scene.");
  },
insertSTL: () => {
    console.log("Insert STL callback fired.");

    if (!window.VRWorldContext) {
      alert("VR World context is not available.");
      return;
    }

    const { scene, objects, THREE } = window.VRWorldContext;

    if (!THREE.STLLoader) {
      alert("STLLoader is not available. Please ensure it's imported.");
      return;
    }

    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.stl';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = (e) => {
        const contents = e.target.result;

        const loader = new THREE.STLLoader();
        const geometry = loader.parse(contents);

        const material = new THREE.MeshStandardMaterial({ color: 0x00ffcc });
        const mesh = new THREE.Mesh(geometry, material);

        // Scale for visibility
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = 1 / maxDim;
          mesh.scale.set(scale, scale, scale);
        }

        mesh.position.set(0, 0.5, -2);

        scene.add(mesh);
        if (objects) objects.push(mesh);

        console.log("STL model inserted into VR world scene.");
        document.body.removeChild(input);
      };

      reader.readAsArrayBuffer(file);
    });

    // Trigger the file picker
    input.click();
  },
      addCircle: () => {
        console.log("Insert Circle callback fired");

        if (!window.SVGEditorContext) {
            console.error("SVGEditorContext not found. Are you in SVG Editing mode?");
            return;
        }

        const { svgRoot } = window.SVGEditorContext;
        if (!svgRoot) {
            console.error("SVG root element not available in SVGEditorContext");
            return;
        }

        // Create a new circle element
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "50");  // default x position
        circle.setAttribute("cy", "50");  // default y position
        circle.setAttribute("r", "25");   // default radius
        circle.setAttribute("stroke", "black");
        circle.setAttribute("stroke-width", "2");
        circle.setAttribute("fill", "transparent");

        svgRoot.appendChild(circle);
        console.log("Circle added to SVG editor");

        // Optionally, select the new circle for immediate manipulation
        if (window.selectSVGElement) {
            window.selectSVGElement(circle);
        }
    },

// === New Enhanced SVG Shape Insertion Callbacks ===
svgInsertRectangle: () => {
    console.log("Insert Rectangle callback fired");
    const svgEditor = document.getElementById('svg-editor');
    if (!svgEditor) {
        console.error("SVG editor not found. Are you in SVG Editing mode?");
        return;
    }

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "20");
    rect.setAttribute("y", "20");
    rect.setAttribute("width", "80");
    rect.setAttribute("height", "60");
    rect.setAttribute("stroke", "black");
    rect.setAttribute("stroke-width", "2");
    rect.setAttribute("fill", "rgba(0, 128, 255, 0.3)");

    svgEditor.appendChild(rect);
    window.selectedSVGElement = rect;
    document.getElementById('svg-message').textContent = 'Rectangle inserted';
},

svgInsertCircle: () => {
    console.log("Insert Circle callback fired");
    const svgEditor = document.getElementById('svg-editor');
    if (!svgEditor) {
        console.error("SVG editor not found. Are you in SVG Editing mode?");
        return;
    }

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "60");
    circle.setAttribute("cy", "60");
    circle.setAttribute("r", "30");
    circle.setAttribute("stroke", "black");
    circle.setAttribute("stroke-width", "2");
    circle.setAttribute("fill", "rgba(255, 0, 128, 0.3)");

    svgEditor.appendChild(circle);
    window.selectedSVGElement = circle;
    document.getElementById('svg-message').textContent = 'Circle inserted';
},

svgInsertEllipse: () => {
    console.log("Insert Ellipse callback fired");
    const svgEditor = document.getElementById('svg-editor');
    if (!svgEditor) {
        console.error("SVG editor not found. Are you in SVG Editing mode?");
        return;
    }

    const ellipse = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    ellipse.setAttribute("cx", "80");
    ellipse.setAttribute("cy", "50");
    ellipse.setAttribute("rx", "60");
    ellipse.setAttribute("ry", "30");
    ellipse.setAttribute("stroke", "black");
    ellipse.setAttribute("stroke-width", "2");
    ellipse.setAttribute("fill", "rgba(0, 255, 128, 0.3)");

    svgEditor.appendChild(ellipse);
    window.selectedSVGElement = ellipse;
    document.getElementById('svg-message').textContent = 'Ellipse inserted';
},

svgInsertLine: () => {
    console.log("Insert Line callback fired");
    const svgEditor = document.getElementById('svg-editor');
    if (!svgEditor) {
        console.error("SVG editor not found. Are you in SVG Editing mode?");
        return;
    }

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", "20");
    line.setAttribute("y1", "20");
    line.setAttribute("x2", "120");
    line.setAttribute("y2", "80");
    line.setAttribute("stroke", "black");
    line.setAttribute("stroke-width", "3");

    svgEditor.appendChild(line);
    window.selectedSVGElement = line;
    document.getElementById('svg-message').textContent = 'Line inserted';
},

svgInsertPath: () => {
    console.log("Insert Path callback fired");
    const svgEditor = document.getElementById('svg-editor');
    if (!svgEditor) {
        console.error("SVG editor not found. Are you in SVG Editing mode?");
        return;
    }

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M 20 20 Q 60 10 100 50 T 140 80");
    path.setAttribute("stroke", "black");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("fill", "none");

    svgEditor.appendChild(path);
    window.selectedSVGElement = path;
    document.getElementById('svg-message').textContent = 'Path inserted';
},

svgInsertText: () => {
    console.log("Insert Text callback fired");
    const svgEditor = document.getElementById('svg-editor');
    if (!svgEditor) {
        console.error("SVG editor not found. Are you in SVG Editing mode?");
        return;
    }

    const text = prompt('Enter text:', 'Sample Text');
    if (!text) return;

    const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
    textElement.setAttribute("x", "20");
    textElement.setAttribute("y", "40");
    textElement.setAttribute("font-family", "Arial");
    textElement.setAttribute("font-size", "16");
    textElement.setAttribute("fill", "black");
    textElement.textContent = text;

    svgEditor.appendChild(textElement);
    window.selectedSVGElement = textElement;
    document.getElementById('svg-message').textContent = 'Text inserted';
},

svgInsertPolygon: () => {
    console.log("Insert Polygon callback fired");
    const svgEditor = document.getElementById('svg-editor');
    if (!svgEditor) {
        console.error("SVG editor not found. Are you in SVG Editing mode?");
        return;
    }

    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", "60,20 80,60 40,60");  // Triangle
    polygon.setAttribute("stroke", "black");
    polygon.setAttribute("stroke-width", "2");
    polygon.setAttribute("fill", "rgba(255, 128, 0, 0.3)");

    svgEditor.appendChild(polygon);
    window.selectedSVGElement = polygon;
    document.getElementById('svg-message').textContent = 'Polygon inserted';
}

};