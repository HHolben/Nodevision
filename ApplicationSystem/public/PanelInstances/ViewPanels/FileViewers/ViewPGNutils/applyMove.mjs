import { findPiece, movePiece, parseSquare } from "./boardUtils.mjs";

export function applyMove(board, san, turn) {
  san = (san || "").trim();
  if (!san || !turn) return false;

  // Handle castling
  if (san === "O-O" || san === "0-0") {
    const row = turn === "w" ? 7 : 0;
    movePiece(board, { r: row, c: 4 }, { r: row, c: 6 }); // king
    movePiece(board, { r: row, c: 7 }, { r: row, c: 5 }); // rook
    return true;
  }
  if (san === "O-O-O" || san === "0-0-0") {
    const row = turn === "w" ? 7 : 0;
    movePiece(board, { r: row, c: 4 }, { r: row, c: 2 }); // king
    movePiece(board, { r: row, c: 0 }, { r: row, c: 3 }); // rook
    return true;
  }

  // Strip SAN suffixes like check, mate, NAG punctuation.
  san = san.replace(/[+#?!]+/g, "");

  // Pawn capture SAN: exd5 or exd8=Q
  let m = san.match(/^([a-h])x([a-h][1-8])(=?[QRBN])?$/);
  if (m) {
    const fromFile = m[1];
    const to = parseSquare(m[2]);
    const promo = m[3];
    const from = findPiece(board, "P", turn, {
      file: fromFile,
      target: to,
      capture: true
    });
    if (!from || !to) return false;
    movePiece(board, from, to);
    if (promo) {
      const p = promo.replace("=", "");
      board[to.r][to.c] = turn === "w" ? p.toUpperCase() : p.toLowerCase();
    }
    return true;
  }

  // Pawn push SAN: e4 or e8=Q
  m = san.match(/^([a-h][1-8])(=?[QRBN])?$/);
  if (m) {
    const to = parseSquare(m[1]);
    const promo = m[2];
    const from = findPiece(board, "P", turn, {
      target: to,
      capture: false
    });
    if (!from || !to) return false;
    movePiece(board, from, to);
    if (promo) {
      const p = promo.replace("=", "");
      board[to.r][to.c] = turn === "w" ? p.toUpperCase() : p.toLowerCase();
    }
    return true;
  }

  // Piece SAN: Nf3, Rxe5, Nbd2, R1e2, Qh4e1 (last one uncommon but valid format)
  m = san.match(/^([KQRBN])([a-h]?)([1-8]?)(x?)([a-h][1-8])$/);
  if (m) {
    const piece = m[1];
    const disFile = m[2] || null;
    const disRank = m[3] || null;
    const capture = m[4] === "x";
    const to = parseSquare(m[5]);

    const from = findPiece(board, piece, turn, {
      file: disFile,
      rank: disRank,
      target: to,
      capture
    });
    if (!from || !to) return false;
    movePiece(board, from, to);
    return true;
  }

  return false;
}
