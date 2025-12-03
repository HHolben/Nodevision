// Utility functions for a simple 8x8 chess board representation.
// Each square holds a string: '' for empty, 'P'/'p' for pawns, 'N'/'n' for knights, etc.
// Uppercase = White, Lowercase = Black

/**
 * Parse a square string like "e4" into board coordinates { r, c }
 * r = row 0-7 (0 = top row, 7 = bottom row)
 * c = column 0-7 (0 = 'a', 7 = 'h')
 */
export function parseSquare(sq) {
  if (!sq || sq.length !== 2) return null;
  const file = sq[0].toLowerCase();
  const rank = parseInt(sq[1], 10);
  if (file < 'a' || file > 'h' || rank < 1 || rank > 8) return null;
  const c = file.charCodeAt(0) - 97;
  const r = 8 - rank;
  return { r, c };
}

/**
 * Move a piece from one coordinate to another
 */
export function movePiece(board, from, to) {
  if (!from || !to) return;
  board[to.r][to.c] = board[from.r][from.c];
  board[from.r][from.c] = '';
}

/**
 * Find a piece of type (letter) and color ('w' or 'b') that can move to the target square.
 * Options:
 *   file: optional file letter for disambiguation (for pawns)
 *   target: {r, c} destination
 *   capture: true if move is a capture
 */
export function findPiece(board, pieceLetter, turn, options = {}) {
  const isWhite = turn === 'w';
  const target = options.target;
  const piece = pieceLetter.toUpperCase();
  const pieceCode = isWhite ? piece : piece.toLowerCase();

  // Naive: return first matching piece that exists on board
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === pieceCode) {
        // For pawns, check file for disambiguation if provided
        if (piece === 'P' && options.file && c !== options.file.charCodeAt(0) - 97) continue;

        // Optional: we could add more sophisticated legality checks later
        return { r, c };
      }
    }
  }
  return null; // piece not found
}

/**
 * Initialize a standard starting chess board
 */
export function makeStartBoard() {
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

/**
 * Optional: render board as HTML string (for testing)
 */
export function renderBoardHTML(board, container) {
  const PIECES = {
    'r':'♜','n':'♞','b':'♝','q':'♛','k':'♚','p':'♟',
    'R':'♖','N':'♘','B':'♗','Q':'♕','K':'♔','P':'♙'
  };
  let html = `<div style="display:grid;grid-template-columns:repeat(8,1fr);width:100%;height:100%;">`;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dark = (r + c) % 2 === 1 ? "#b58863" : "#f0d9b5";
      const piece = board[r][c];
      html += `<div style="background:${dark};display:flex;align-items:center;justify-content:center;font-size:32px;">
        ${PIECES[piece] || ""}
      </div>`;
    }
  }
  html += "</div>";
  container.innerHTML = html;
}
