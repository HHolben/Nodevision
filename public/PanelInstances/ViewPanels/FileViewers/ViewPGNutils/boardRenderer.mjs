const PIECES = {
  r:'♜', n:'♞', b:'♝', q:'♛', k:'♚', p:'♟',
  R:'♖', N:'♘', B:'♗', Q:'♕', K:'♔', P:'♙'
};

export function renderBoard(board, container) {
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
        </div>`;
    }
  }

  html += "</div>";
  container.innerHTML = html;
}
