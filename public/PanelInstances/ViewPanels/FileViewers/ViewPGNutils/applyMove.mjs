// Very simplified SAN handler for basic PGN moves.
// Assumes board is an 8×8 array of objects { piece: "P", color: "w" }

import { findPiece, movePiece, parseSquare } from "./boardUtils.mjs";

export function applyMove(board, san, turn) {
  san = san.trim();

  // 1. Handle castling
  if (san === "O-O" || san === "0-0") {
    const row = turn === "w" ? 7 : 0;
    movePiece(board, { r: row, c: 4 }, { r: row, c: 6 }); // king
    movePiece(board, { r: row, c: 7 }, { r: row, c: 5 }); // rook
    return;
  }
  if (san === "O-O-O" || san === "0-0-0") {
    const row = turn === "w" ? 7 : 0;
    movePiece(board, { r: row, c: 4 }, { r: row, c: 2 }); // king
    movePiece(board, { r: row, c: 0 }, { r: row, c: 3 }); // rook
    return;
  }

  // 2. Strip symbols
  san = san.replace(/[+#?!]/g, ""); // remove check, mate, annotations

  // 3. Detect captures
  const isCapture = san.includes("x");

  // 4. Pawn move (starts with file or pawn capture: e4, exd5)
  if (/^[a-h]/.test(san)) {
    let from, to;

    if (isCapture) {
      // Example: exd5 → pawn from 'e' file captures on d5
      const fromFile = san[0];
      const dest = san.slice(san.indexOf("x") + 1);
      to = parseSquare(dest);
      from = findPiece(board, "P", turn, {
        file: fromFile,
        target: to,
        capture: true,
      });
    } else {
      // Example: e4 → pawn advances
      to = parseSquare(san);
      from = findPiece(board, "P", turn, { target: to });
    }

    if (!from || !to) return;
    movePiece(board, from, to);
    return;
  }

  // 5. Piece moves: Nf3, Rxe5, Qh4
  const pieceLetter = san[0]; // N, B, R, Q, K
  const rest = san.slice(1);

  let destString = rest.includes("x")
    ? rest.split("x")[1]
    : rest;

  const to = parseSquare(destString);
  const from = findPiece(board, pieceLetter, turn, { target: to });

  if (!from || !to) return;

  movePiece(board, from, to);
}
