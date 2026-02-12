const PIECES = {
  r:'♜', n:'♞', b:'♝', q:'♛', k:'♚', p:'♟',
  R:'♖', N:'♘', B:'♗', Q:'♕', K:'♔', P:'♙'
};

export function renderBoard(board, container) {
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  let html = `
    <div style="
      display:grid;
      grid-template-columns:24px repeat(8,minmax(0,1fr));
      grid-template-rows:repeat(8,minmax(0,1fr)) 24px;
      width:100%;
      height:100%;
      border:1px solid #999;
      box-sizing:border-box;
      font-family:monospace;
    ">
  `;

  for (let r = 0; r < 8; r++) {
    html += `
      <div style="
        display:flex;align-items:center;justify-content:center;
        font-size:12px;color:#444;background:#f7f7f7;
      ">
        ${ranks[r]}
      </div>
    `;

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

  html += `<div style="background:#f7f7f7;"></div>`;
  for (let c = 0; c < 8; c++) {
    html += `
      <div style="
        display:flex;align-items:center;justify-content:center;
        font-size:12px;color:#444;background:#f7f7f7;
      ">
        ${files[c]}
      </div>
    `;
  }

  html += "</div>";
  container.innerHTML = html;
}
