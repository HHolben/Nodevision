// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewPGN.mjs

import { parsePGN } from "./ViewPGNutils/parsePGN.mjs";
import { parseMoves } from "./ViewPGNutils/parseMoves.mjs";
import { makeStartBoard } from "./ViewPGNutils/boardSetup.mjs";
import { renderBoard } from "./ViewPGNutils/boardRenderer.mjs";
import { applyMove } from "./ViewPGNutils/applyMove.mjs";
import { escapeHTML } from "./ViewPGNutils/escapeHTML.mjs";

function safeHeader(value, fallback = "Unknown") {
  if (!value || value === "?") return fallback;
  return value;
}

function buildGameTitle(headers, filename) {
  const event = safeHeader(headers.Event, "");
  const white = safeHeader(headers.White, "White");
  const black = safeHeader(headers.Black, "Black");

  if (event) return `${event} - ${white} vs ${black}`;
  return `${white} vs ${black} (${filename})`;
}

function buildPlayersInfo(headers) {
  const white = safeHeader(headers.White, "White");
  const black = safeHeader(headers.Black, "Black");
  const whiteElo = safeHeader(headers.WhiteElo, "N/A");
  const blackElo = safeHeader(headers.BlackElo, "N/A");
  const result = safeHeader(headers.Result, "*");
  const date = safeHeader(headers.Date, "Unknown Date");
  const site = safeHeader(headers.Site, "Unknown Site");

  return `
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;">
      <div><strong>White:</strong> ${escapeHTML(white)} (${escapeHTML(whiteElo)})</div>
      <div><strong>Black:</strong> ${escapeHTML(black)} (${escapeHTML(blackElo)})</div>
      <div><strong>Result:</strong> ${escapeHTML(result)}</div>
      <div><strong>Date:</strong> ${escapeHTML(date)}</div>
      <div><strong>Site:</strong> ${escapeHTML(site)}</div>
    </div>
  `;
}

function buildNotationRows(moves) {
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    const moveNo = Math.floor(i / 2) + 1;
    rows.push({
      moveNo,
      white: moves[i] || "",
      black: moves[i + 1] || "",
      whitePly: i + 1,
      blackPly: i + 2
    });
  }
  return rows;
}

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    const safePath = String(filename || "")
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    const response = await fetch(`${serverBase}/${safePath}`);
    if (!response.ok) {
      throw new Error(`Failed to load PGN (${response.status} ${response.statusText})`);
    }
    // Parse
    const pgnText = await response.text();
    const { headers, movesText } = parsePGN(pgnText);
    const moves = parseMoves(movesText)
      .map((token) => token.replace(/^\d+\.(\.\.)?/, ""))
      .filter(Boolean);
    const notationRows = buildNotationRows(moves);
    const gameTitle = buildGameTitle(headers, filename);

    // UI root
    viewPanel.innerHTML = `
      <div id="pgn-viewer-root" style="display:flex;flex-direction:column;height:100%;gap:10px;padding:8px;box-sizing:border-box;">
        <div id="pgn-game-title" style="font-size:18px;font-weight:600;border-bottom:1px solid #ddd;padding-bottom:6px;">
          ${escapeHTML(gameTitle)}
        </div>

        <div style="display:flex;gap:12px;flex:1;min-height:0;">
          <div style="display:flex;flex-direction:column;gap:10px;flex:0 0 380px;min-width:320px;">
            <div id="board-container" style="width:100%;height:380px;border:1px solid #ccc;background:#fff;"></div>
            <div style="display:flex;gap:10px;">
              <button id="pgn-prev-btn">◀ Prev</button>
              <button id="pgn-next-btn">Next ▶</button>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;min-width:260px;flex:1;border:1px solid #ddd;">
            <div style="padding:8px 10px;border-bottom:1px solid #ddd;font-weight:600;">Algebraic Notation</div>
            <div id="pgn-notation" style="overflow:auto;padding:8px;font-family:monospace;font-size:14px;line-height:1.6;"></div>
          </div>
        </div>

        <div id="pgn-players-info" style="border-top:1px solid #ddd;padding-top:8px;">
          ${buildPlayersInfo(headers)}
        </div>
      </div>
    `;

    const boardContainer = viewPanel.querySelector("#board-container");
    const prevBtn = viewPanel.querySelector("#pgn-prev-btn");
    const nextBtn = viewPanel.querySelector("#pgn-next-btn");
    const notationContainer = viewPanel.querySelector("#pgn-notation");

    // Build board states
    let board = makeStartBoard();
    const boardStates = [JSON.parse(JSON.stringify(board))];

    let turn = "w";
    moves.forEach((m) => {
      const applied = applyMove(board, m, turn);
      if (applied) {
        boardStates.push(JSON.parse(JSON.stringify(board)));
      } else {
        console.warn(`[ViewPGN] Skipped unsupported/invalid SAN move: ${m}`);
      }
      turn = turn === "w" ? "b" : "w";
    });

    let index = 0;
    const renderNotation = () => {
      notationContainer.innerHTML = notationRows.map((row) => {
        const whiteActive = row.whitePly === index ? "background:#fff59d;" : "";
        const blackActive = row.blackPly === index ? "background:#fff59d;" : "";
        return `
          <div style="display:grid;grid-template-columns:40px 1fr 1fr;gap:8px;padding:2px 0;">
            <span style="color:#666;">${row.moveNo}.</span>
            <span data-ply="${row.whitePly}" style="cursor:pointer;padding:0 3px;border-radius:3px;${whiteActive}">
              ${escapeHTML(row.white)}
            </span>
            <span data-ply="${row.blackPly}" style="cursor:pointer;padding:0 3px;border-radius:3px;${blackActive}">
              ${escapeHTML(row.black)}
            </span>
          </div>
        `;
      }).join("");
    };

    const renderCurrent = () => {
      renderBoard(boardStates[index], boardContainer);
      renderNotation();
    };

    renderCurrent();

    prevBtn.onclick = () => {
      if (index > 0) index--;
      renderCurrent();
    };

    nextBtn.onclick = () => {
      if (index < boardStates.length - 1) index++;
      renderCurrent();
    };

    notationContainer.onclick = (event) => {
      const ply = event.target?.dataset?.ply;
      if (!ply) return;
      const nextIndex = parseInt(ply, 10);
      if (Number.isNaN(nextIndex)) return;
      if (nextIndex >= 0 && nextIndex < boardStates.length) {
        index = nextIndex;
        renderCurrent();
      }
    };
  } catch (err) {
    console.error("Error loading PGN:", err);
    viewPanel.innerHTML = '<p style="color:red;">Error loading PGN file.</p>';
  }
}
