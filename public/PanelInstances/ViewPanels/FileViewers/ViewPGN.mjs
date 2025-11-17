// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewPGN.js
// This file is used to render a portable game format chess game viewer
// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewPGN.js
// Purpose: Render PGN files with a live chessboard and forward/back controls

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    const response = await fetch(`${serverBase}/${filename}`);
    const pgn = await response.text();

    viewPanel.innerHTML = `
      <div id="pgn-viewer-root" style="display:flex;flex-direction:column;height:100%;gap:10px;">
        <div id="board-container" style="width:320px;height:320px;border:1px solid #ccc;"></div>

        <div style="display:flex;gap:10px;">
          <button id="pgn-prev-btn">◀ Prev</button>
          <button id="pgn-next-btn">Next ▶</button>
        </div>

        <pre id="pgn-source" style="white-space:pre-wrap;font-family:monospace;height:200px;overflow:auto;border:1px solid #ddd;padding:4px;">
${pgn}
        </pre>
      </div>
    `;

    // ---- Chessboard Rendering ----

    const boardContainer = viewPanel.querySelector("#board-container");
    const prevBtn = viewPanel.querySelector("#pgn-prev-btn");
    const nextBtn = viewPanel.querySelector("#pgn-next-btn");

    // Basic piece Unicode mapper
    const PIECES = {
      'r':'♜','n':'♞','b':'♝','q':'♛','k':'♚','p':'♟',
      'R':'♖','N':'♘','B':'♗','Q':'♕','K':'♔','P':'♙'
    };

    // Create a starting board array (8x8)
    function makeStartBoard() {
      return [
        ['r','n','b','q','k','b','n','r'],
        ['p','p','p','p','p','p','p','p'],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['P','P','P','P','P','P','P','P'],
        ['R','N','B','Q','K','B','N','R']
      ];
    }

    // Render board as HTML grid
    function renderBoard(board) {
      let html = `<div style="display:grid;grid-template-columns:repeat(8,1fr);width:100%;height:100%;">`;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const dark = (r + c) % 2 === 1 ? "#b58863" : "#f0d9b5";
          const piece = board[r][c];
          html += `
            <div style="
              background:${dark};
              display:flex;align-items:center;justify-content:center;
              font-size:32px;user-select:none;
            ">
              ${PIECES[piece] || ""}
            </div><br><br><br>`;
        }
      }

      html += "</div>";
      boardContainer.innerHTML = html;
    }

    // ---- PGN Parsing ----
    function parseMoves(pgn) {
      // Remove comments and metadata
      let clean = pgn
        .replace(/\[.*?\]/g, "")
        .replace(/\{.*?\}/g, "")
        .replace(/\d+\./g, "")   // remove "1.", "2.", etc.
        .trim();

      return clean.split(/\s+/).filter(t => t.length > 0);
    }

    const moves = parseMoves(pgn);

    // Apply minimal SAN move (only handles simple moves — good enough for viewer)
    function applyMove(board, san) {
      // Extremely minimal: only handles moves like "e4", "Nf3", "Qh5"
      // Does not implement full legality. Viewer is for stepping forward/back through PGN.

      // Pawn move like "e4"
      if (/^[a-h][1-8]$/.test(san)) {
        const file = san.charCodeAt(0) - 97;
        const rank = 8 - parseInt(san[1]);
        // White tries to move from rank+1, black from rank-1
        // This is simplistic but enough for demonstration
        if (board[rank+1] && board[rank+1][file] === 'P') {
          board[rank+1][file] = '';
          board[rank][file] = 'P';
        } else if (board[rank-1] && board[rank-1][file] === 'p') {
          board[rank-1][file] = '';
          board[rank][file] = 'p';
        }
        return;
      }

      // Piece moves like "Nf3", "Qh5"
      const pieceLetter = san[0].match(/[KQRNB]/) ? san[0] : 'P';
      const target = san.slice(pieceLetter === 'P' ? 0 : 1);

      if (/^[a-h][1-8]$/.test(target)) {
        const file = target.charCodeAt(0) - 97;
        const rank = 8 - parseInt(target[1]);

        // Find a piece of that type that can reach that square (very naive)
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (board[r][c] === pieceLetter || board[r][c] === pieceLetter.toLowerCase()) {
              // No legality check – just move first matching piece
              board[r][c] = '';
              board[rank][file] = pieceLetter;
              return;
            }
          }
        }
      }
    }

    let boardStates = [];
    let board = makeStartBoard();
    boardStates.push(JSON.parse(JSON.stringify(board)));

    moves.forEach(move => {
      applyMove(board, move);
      boardStates.push(JSON.parse(JSON.stringify(board)));
    });

    let index = 0;
    renderBoard(boardStates[0]);

    // Controls
    prevBtn.onclick = () => {
      if (index > 0) index--;
      renderBoard(boardStates[index]);
    };

    nextBtn.onclick = () => {
      if (index < boardStates.length - 1) index++;
      renderBoard(boardStates[index]);
    };

  } catch (err) {
    console.error("Error loading PGN:", err);
    viewPanel.innerHTML = '<p style="color:red;">Error loading PGN file.</p>';
  }

  // Basic guards
  if (!viewPanel) throw new Error("viewPanel element required");
  const fullUrl = `${serverBase}/${filename}`;




  

  // Helper: escape HTML to avoid XSS from PGN files
  function escapeHTML(str = "") {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Parse PGN text into { headers: {}, movesText: string }
  function parsePGN(text) {
    const lines = text.replace(/\r/g, "").split("\n");
    const headers = {};
    let i = 0;

    // collect header lines like: [Event "F/S Return Match"]
    for (; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === "") { i++; break; } // blank line separates headers from moves
      const m = line.match(/^\[([A-Za-z0-9_]+)\s+"(.*)"\]$/);
      if (m) {
        headers[m[1]] = m[2];
      } else {
        // if we encounter non-header before blank line, continue — some PGNs omit blank line
        // break header collection if line looks like moves (starts with digit or move like "1.")
        if (/^\d+\./.test(line) || /^[NBRQKOba-h1-8+#=-]/.test(line)) {
          break;
        }
      }
    }

    // Remaining lines (including current) are moves / comments / NAGs / variations.
    const movesLines = lines.slice(i).join(" ").trim();

    return { headers, movesText: movesLines };
  }

  // Turn movesText into an array of objects { moveNumber, white, black }
  // This is a SAN tokenizer that removes comments and variations for viewer simplicity.
  function parseMoves(movesText) {
    if (!movesText) return [];

    // Remove comments {...} and ;... end-of-line comments
    let s = movesText.replace(/\{[^}]*\}/g, " ").replace(/;[^\n\r]*/g, " ");

    // Remove variations ( ... ) - naive removal that deletes balanced parentheses
    // We'll perform a loop to strip nested parentheses.
    while (/\([^()]*\)/.test(s)) {
      s = s.replace(/\([^()]*\)/g, " ");
    }

    // Remove numeric annotation glyphs (NAGs) like $1, $2
    s = s.replace(/\$\d+/g, " ");

    // Remove results (1-0, 0-1, 1/2-1/2, *)
    s = s.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");

    // Normalize whitespace
    s = s.replace(/\s+/g, " ").trim();

    // Tokenize by splitting on spaces but first remove move numbers '1.' '2...' etc.
    // We'll keep track of move numbers by scanning tokens.
    const tokens = s.length ? s.split(" ") : [];

    const moves = [];
    let currentMoveNumber = 0;
    let expect = "moveNumberOrWhite"; // state machine

    // Helper to try to parse move number token like "12." or "12..."
    function parseMoveNumberToken(tok) {
      const m = tok.match(/^(\d+)\.+$/);
      if (m) return parseInt(m[1], 10);
      return null;
    }

    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];

      // skip empty tokens
      if (!tok) { i++; continue; }

      const maybeNum = parseMoveNumberToken(tok);
      if (maybeNum !== null) {
        currentMoveNumber = maybeNum;
        i++;
        continue;
      }

      // If token starts with a digit and dot attached (e.g. "12.e4"), split it.
      const mixed = tok.match(/^(\d+)\.(.+)$/);
      if (mixed) {
        currentMoveNumber = parseInt(mixed[1], 10);
        const rest = mixed[2];
        // treat rest as the white move
        const whiteMove = rest;
        // consume white
        if (!moves.length || moves[moves.length - 1].moveNumber !== currentMoveNumber) {
          moves.push({ moveNumber: currentMoveNumber, white: whiteMove, black: null });
        } else {
          // improbable, but if previous entry exists, set white
          moves[moves.length - 1].white = whiteMove;
        }
        i++;
        continue;
      }

      // Otherwise token should be a SAN move for white or black
      if (expect === "moveNumberOrWhite" || expect === "white") {
        // add new move object
        currentMoveNumber = currentMoveNumber || (moves.length + 1);
        moves.push({ moveNumber: currentMoveNumber, white: tok, black: null });
        expect = "black";
      } else if (expect === "black") {
        // attach to last move
        if (!moves.length) {
          // stray black move - create with moveNumber guessed
          moves.push({ moveNumber: ++currentMoveNumber, white: null, black: tok });
        } else {
          moves[moves.length - 1].black = tok;
        }
        expect = "white";
        currentMoveNumber++;
      } else {
        // fallback: push as white
        currentMoveNumber = currentMoveNumber || (moves.length + 1);
        moves.push({ moveNumber: currentMoveNumber, white: tok, black: null });
        expect = "black";
      }

      i++;
    }

    return moves;
  }

  // UI builder
  function buildViewerDom(headers, moves) {
    // root
    const root = document.createElement("div");
    root.id = "pgn-viewer-root";
    root.style.display = "flex";
    root.style.flexDirection = "column";
    root.style.height = "100%";
    root.style.width = "100%";
    root.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    root.style.boxSizing = "border-box";
    root.style.padding = "8px";
    root.style.gap = "8px";

    // header area
    const headerCard = document.createElement("div");
    headerCard.style.display = "flex";
    headerCard.style.flexDirection = "row";
    headerCard.style.flexWrap = "wrap";
    headerCard.style.gap = "8px";
    headerCard.style.alignItems = "flex-start";

    const headerTable = document.createElement("table");
    headerTable.style.borderCollapse = "collapse";
    headerTable.style.fontSize = "12px";
    headerTable.style.minWidth = "240px";

    for (const key of Object.keys(headers)) {
      const row = document.createElement("tr");
      const kCell = document.createElement("td");
      kCell.style.padding = "4px 8px";
      kCell.style.border = "1px solid #ddd";
      kCell.style.background = "#f5f5f5";
      kCell.style.fontWeight = "600";
      kCell.textContent = key;

      const vCell = document.createElement("td");
      vCell.style.padding = "4px 8px";
      vCell.style.border = "1px solid #ddd";
      vCell.textContent = headers[key];

      row.appendChild(kCell);
      row.appendChild(vCell);
      headerTable.appendChild(row);
    }

    headerCard.appendChild(headerTable);
    root.appendChild(headerCard);

    // Main content: moves list + info panel
    const main = document.createElement("div");
    main.style.display = "flex";
    main.style.flex = "1 1 auto";
    main.style.gap = "12px";
    main.style.minHeight = "0"; // allow flex children to shrink

    // Moves pane (scrollable)
    const movesPane = document.createElement("div");
    movesPane.style.flex = "1 1 60%";
    movesPane.style.overflow = "auto";
    movesPane.style.border = "1px solid #e0e0e0";
    movesPane.style.borderRadius = "6px";
    movesPane.style.padding = "8px";
    movesPane.style.minWidth = "200px";
    movesPane.style.background = "var(--panel-bg, #fff)";

    // Moves table
    const movesTable = document.createElement("table");
    movesTable.style.borderCollapse = "collapse";
    movesTable.style.width = "100%";
    movesTable.style.fontSize = "13px";
    movesTable.style.tableLayout = "fixed";

    // table header
    const thead = document.createElement("thead");
    const thr = document.createElement("tr");
    ["#", "White", "Black"].forEach(t => {
      const th = document.createElement("th");
      th.style.textAlign = "left";
      th.style.padding = "6px 8px";
      th.style.borderBottom = "1px solid #ddd";
      th.textContent = t;
      thr.appendChild(th);
    });
    thead.appendChild(thr);
    movesTable.appendChild(thead);

    const tbody = document.createElement("tbody");

    moves.forEach((m, idx) => {
      const tr = document.createElement("tr");
      tr.dataset.moveIndex = idx;

      const numTd = document.createElement("td");
      numTd.style.padding = "6px 8px";
      numTd.style.borderBottom = "1px solid #f0f0f0";
      numTd.style.width = "40px";
      numTd.textContent = m.moveNumber;

      const whiteTd = document.createElement("td");
      whiteTd.style.padding = "6px 8px";
      whiteTd.style.borderBottom = "1px solid #f0f0f0";
      whiteTd.style.cursor = "pointer";
      whiteTd.style.wordBreak = "break-word";
      whiteTd.innerHTML = escapeHTML(m.white || "");

      const blackTd = document.createElement("td");
      blackTd.style.padding = "6px 8px";
      blackTd.style.borderBottom = "1px solid #f0f0f0";
      blackTd.style.cursor = "pointer";
      blackTd.style.wordBreak = "break-word";
      blackTd.innerHTML = escapeHTML(m.black || "");

      // click handlers: highlight and update info panel
      whiteTd.addEventListener("click", () => {
        setCurrentMove(idx * 2); // white move index
      });
      blackTd.addEventListener("click", () => {
        setCurrentMove(idx * 2 + 1); // black move index
      });

      tr.appendChild(numTd);
      tr.appendChild(whiteTd);
      tr.appendChild(blackTd);
      tbody.appendChild(tr);
    });

    movesTable.appendChild(tbody);
    movesPane.appendChild(movesTable);
    main.appendChild(movesPane);

    // Info pane (right side)
    const infoPane = document.createElement("div");
    infoPane.style.flex = "0 0 36%";
    infoPane.style.minWidth = "200px";
    infoPane.style.maxWidth = "480px";
    infoPane.style.display = "flex";
    infoPane.style.flexDirection = "column";
    infoPane.style.gap = "8px";

    const infoBox = document.createElement("div");
    infoBox.style.border = "1px solid #e8e8e8";
    infoBox.style.borderRadius = "6px";
    infoBox.style.padding = "8px";
    infoBox.style.minHeight = "120px";
    infoBox.style.overflow = "auto";
    infoBox.style.background = "var(--panel-bg, #fff)";

    const infoTitle = document.createElement("div");
    infoTitle.style.fontWeight = "700";
    infoTitle.style.marginBottom = "6px";
    infoTitle.textContent = "Move details";

    const infoContent = document.createElement("div");
    infoContent.style.fontSize = "13px";
    infoContent.style.lineHeight = "1.4";
    infoContent.textContent = "Click a move to see the SAN prefix for that move.";

    infoBox.appendChild(infoTitle);
    infoBox.appendChild(infoContent);

    // status area: show SAN sequence up to selected move
    const statusBox = document.createElement("div");
    statusBox.style.border = "1px solid #e8e8e8";
    statusBox.style.borderRadius = "6px";
    statusBox.style.padding = "8px";
    statusBox.style.fontSize = "12px";
    statusBox.style.background = "var(--panel-bg, #fff)";

    const statusTitle = document.createElement("div");
    statusTitle.style.fontWeight = "700";
    statusTitle.style.marginBottom = "6px";
    statusTitle.textContent = "SAN up to selection";

    const statusContent = document.createElement("div");
    statusContent.style.wordBreak = "break-word";
    statusContent.textContent = "";

    statusBox.appendChild(statusTitle);
    statusBox.appendChild(statusContent);

    infoPane.appendChild(infoBox);
    infoPane.appendChild(statusBox);

    main.appendChild(infoPane);
    root.appendChild(main);

    // Helper: compute SAN prefix up to a move index (0-based where 0 == white of move 1)
    function sanPrefixUpTo(moveIndex0) {
      if (!Array.isArray(moves) || moves.length === 0) return "";
      const parts = [];
      for (let i = 0; i < moves.length; i++) {
        const mv = moves[i];
        if (mv.white && (i * 2) <= moveIndex0) parts.push(`${mv.moveNumber}. ${mv.white}`);
        if (mv.black && (i * 2 + 1) <= moveIndex0) parts.push(`${mv.black}`);
        if ((i * 2) > moveIndex0) break;
      }
      return parts.join(" ");
    }

    // UI state: highlight selection
    let currentlySelected = null; // moveIndex (0-based half-move number)
    function setCurrentMove(halfMoveIndex) {
      // clamp
      if (halfMoveIndex < 0) halfMoveIndex = 0;
      const maxHalf = Math.max(0, moves.length * 2 - 1);
      if (halfMoveIndex > maxHalf) halfMoveIndex = maxHalf;

      // un-highlight previous
      if (currentlySelected !== null) {
        const prevRow = movesTable.querySelector(`tr[data-move-index="${Math.floor(currentlySelected/2)}"]`);
        if (prevRow) {
          prevRow.querySelectorAll("td").forEach(td => {
            td.style.background = "";
          });
        }
      }

      // highlight new
      const row = movesTable.querySelector(`tr[data-move-index="${Math.floor(halfMoveIndex/2)}"]`);
      if (row) {
        const whiteTd = row.children[1];
        const blackTd = row.children[2];
        if (halfMoveIndex % 2 === 0) {
          whiteTd.style.background = "rgba(60,120,215,0.12)";
        } else {
          blackTd.style.background = "rgba(60,120,215,0.12)";
        }
        // scroll into view if needed
        const parentRect = movesPane.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        if (rowRect.top < parentRect.top || rowRect.bottom > parentRect.bottom) {
          row.scrollIntoView({ block: "nearest" });
        }
      }

      currentlySelected = halfMoveIndex;
      statusContent.textContent = sanPrefixUpTo(halfMoveIndex);

      // populate info content with details about the selected move
      const fullSAN = sanPrefixUpTo(halfMoveIndex);
      infoContent.innerHTML = `<div style="font-weight:600;margin-bottom:6px;">Selected half-move #${halfMoveIndex + 1}</div>
        <div style="font-size:13px;white-space:pre-wrap;">${escapeHTML(fullSAN)}</div>`;
    }

    // initial UI state
    if (moves.length) {
      setCurrentMove(0);
    } else {
      statusContent.textContent = "No moves parsed from PGN.";
    }

    return root;
  }

  // Fetch and render
  try {
    const res = await fetch(fullUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    const { headers, movesText } = parsePGN(text);
    const moves = parseMoves(movesText);

    // Build DOM and insert
    viewPanel.innerHTML = ""; // clear existing
    const dom = buildViewerDom(headers, moves);
    viewPanel.appendChild(dom);
  } catch (err) {
    console.error("Error loading PGN:", err);
    viewPanel.innerHTML = html+`<div style="color:red;padding:8px;">Error loading PGN file: ${escapeHTML(err && err.message)}</div>`;
  }
}
