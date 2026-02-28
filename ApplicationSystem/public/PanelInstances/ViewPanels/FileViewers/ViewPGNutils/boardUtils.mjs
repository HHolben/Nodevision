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

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function isWhitePiece(piece) {
  return piece && piece === piece.toUpperCase();
}

function isPathClear(board, from, to) {
  const dr = Math.sign(to.r - from.r);
  const dc = Math.sign(to.c - from.c);
  let r = from.r + dr;
  let c = from.c + dc;

  while (r !== to.r || c !== to.c) {
    if (board[r][c] !== '') return false;
    r += dr;
    c += dc;
  }

  return true;
}

function canPawnReach(board, from, to, turn, capture) {
  const dir = turn === 'w' ? -1 : 1;
  const startRow = turn === 'w' ? 6 : 1;
  const targetPiece = board[to.r][to.c];

  if (capture) {
    if (to.r !== from.r + dir || Math.abs(to.c - from.c) !== 1) return false;
    if (!targetPiece) return false; // en passant is not handled in this simple viewer
    return turn === 'w' ? !isWhitePiece(targetPiece) : isWhitePiece(targetPiece);
  }

  if (from.c !== to.c) return false;
  if (targetPiece !== '') return false;

  if (to.r === from.r + dir) return true;
  if (from.r === startRow && to.r === from.r + 2 * dir) {
    const mid = from.r + dir;
    return board[mid][from.c] === '';
  }

  return false;
}

function canPieceReach(board, from, to, pieceLetter, turn, capture) {
  if (!inBounds(to.r, to.c)) return false;

  const targetPiece = board[to.r][to.c];
  const targetOccupied = targetPiece !== '';

  if (capture && !targetOccupied) return false;
  if (!capture && targetOccupied) return false;
  if (targetOccupied) {
    const sameColor = turn === 'w' ? isWhitePiece(targetPiece) : !isWhitePiece(targetPiece);
    if (sameColor) return false;
  }

  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const adr = Math.abs(dr);
  const adc = Math.abs(dc);
  const p = pieceLetter.toUpperCase();

  if (p === 'P') return canPawnReach(board, from, to, turn, capture);
  if (p === 'N') return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
  if (p === 'K') return adr <= 1 && adc <= 1 && (adr + adc > 0);
  if (p === 'B') return adr === adc && isPathClear(board, from, to);
  if (p === 'R') return (dr === 0 || dc === 0) && isPathClear(board, from, to);
  if (p === 'Q') {
    const straight = dr === 0 || dc === 0;
    const diagonal = adr === adc;
    return (straight || diagonal) && isPathClear(board, from, to);
  }

  return false;
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
  const fileFilter = options.file ? options.file.toLowerCase().charCodeAt(0) - 97 : null;
  const rankFilter = options.rank ? 8 - parseInt(options.rank, 10) : null;
  const capture = options.capture === true;

  const candidates = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === pieceCode) {
        if (fileFilter !== null && c !== fileFilter) continue;
        if (rankFilter !== null && r !== rankFilter) continue;
        if (!target) {
          candidates.push({ r, c });
          continue;
        }
        if (canPieceReach(board, { r, c }, target, piece, turn, capture)) {
          candidates.push({ r, c });
        }
      }
    }
  }

  return candidates[0] || null;
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
