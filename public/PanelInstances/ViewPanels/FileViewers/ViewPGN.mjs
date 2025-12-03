// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewPGN.mjs

import { parsePGN } from "./ViewPGNutils/parsePGN.mjs";
import { parseMoves } from "./ViewPGNutils/parseMoves.mjs";
import { makeStartBoard } from "./ViewPGNutils/boardSetup.mjs";
import { renderBoard } from "./ViewPGNutils/boardRenderer.mjs";
import { applyMove } from "./ViewPGNutils/applyMove.mjs";
import { escapeHTML } from "./ViewPGNutils/escapeHTML.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  try {
    const response = await fetch(`${serverBase}/${filename}`);
    const pgnText = await response.text();

    // UI root
    viewPanel.innerHTML = `
      <div id="pgn-viewer-root" style="display:flex;flex-direction:column;height:100%;gap:10px;">
        <div id="board-container" style="width:320px;height:320px;border:1px solid #ccc;"></div>

        <div style="display:flex;gap:10px;">
          <button id="pgn-prev-btn">◀ Prev</button>
          <button id="pgn-next-btn">Next ▶</button>
        </div>

        <pre id="pgn-source" style="white-space:pre-wrap;font-family:monospace;height:200px;overflow:auto;border:1px solid #ddd;padding:4px;">
${escapeHTML(pgnText)}
        </pre>
      </div>
    `;

    const boardContainer = viewPanel.querySelector("#board-container");
    const prevBtn = viewPanel.querySelector("#pgn-prev-btn");
    const nextBtn = viewPanel.querySelector("#pgn-next-btn");

    // Parse
    const { movesText } = parsePGN(pgnText);
    const moves = parseMoves(movesText);

    // Build board states
    let board = makeStartBoard();
    const boardStates = [JSON.parse(JSON.stringify(board))];

    moves.forEach(m => {
      applyMove(board, m);
      boardStates.push(JSON.parse(JSON.stringify(board)));
    });

    let index = 0;
    renderBoard(boardStates[index], boardContainer);

    prevBtn.onclick = () => {
      if (index > 0) index--;
      renderBoard(boardStates[index], boardContainer);
    };

    nextBtn.onclick = () => {
      if (index < boardStates.length - 1) index++;
      renderBoard(boardStates[index], boardContainer);
    };
  } catch (err) {
    console.error("Error loading PGN:", err);
    viewPanel.innerHTML = '<p style="color:red;">Error loading PGN file.</p>';
  }
}
