/**
 * BoardView.js
 *
 * Pure UI component responsible for:
 * - Rendering an 8x8 board grid.
 * - Displaying pieces as Unicode glyphs.
 * - Highlighting selected square, legal moves, and last move.
 * - Emitting square selection events to the outside world.
 *
 * This module does NOT implement chess rules; it is presentation-only.
 */

const PIECE_TO_GLYPH = {
  wP: "♙",
  wN: "♘",
  wB: "♗",
  wR: "♖",
  wQ: "♕",
  wK: "♔",
  bP: "♟",
  bN: "♞",
  bB: "♝",
  bR: "♜",
  bQ: "♛",
  bK: "♚",
};

export class BoardView {
  /**
   * @param {HTMLElement} container - container element for the board.
   * @param {Object} callbacks
   * @param {(square: string) => void} callbacks.onSquareSelected
   */
  constructor(container, { onSquareSelected } = {}) {
    if (!container) {
      throw new Error("BoardView: container element is required.");
    }

    this.container = container;
    this.onSquareSelected = onSquareSelected || (() => {});

    /** @type {Map<string, HTMLElement>} */
    this.squareEls = new Map();

    this.selectedSquare = null;
    this.legalTargets = new Set();
    this.lastMove = null;

    this.handleSquareClick = this.handleSquareClick.bind(this);

    this.initBoard();
  }

  /**
   * Initialize board DOM once. Default orientation a1 bottom-left.
   */
  initBoard() {
    this.container.innerHTML = "";
    this.squareEls.clear();

    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    // Render rank 8 down to 1; orientation will be applied logically in render()
    for (let rank = 8; rank >= 1; rank -= 1) {
      for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
        const file = files[fileIndex];
        const square = `${file}${rank}`;

        const squareEl = document.createElement("div");
        squareEl.classList.add("chess-square");
        const isLight = (fileIndex + rank) % 2 === 0;
        squareEl.classList.add(isLight ? "light" : "dark");

        squareEl.dataset.square = square;
        squareEl.addEventListener("click", this.handleSquareClick);

        const pieceEl = document.createElement("div");
        pieceEl.classList.add("chess-piece");
        squareEl.appendChild(pieceEl);

        this.container.appendChild(squareEl);
        this.squareEls.set(square, squareEl);
      }
    }
  }

  /**
   * Render full board state.
   *
   * @param {Object.<string,string|null>} boardState - map from "a1".."h8" to piece codes ("wP", "bQ", etc.) or null.
   * @param {Object} options
   * @param {"white"|"black"} options.perspective - whose perspective to show.
   * @param {string|null} options.selected - currently selected square.
   * @param {string[]|Set<string>} options.legalMoves - legal target squares.
   * @param {{from: string, to: string}|null} options.lastMove - last move info.
   */
  render(boardState, { perspective, selected, legalMoves, lastMove }) {
    this.selectedSquare = selected || null;
    this.legalTargets =
      legalMoves instanceof Set
        ? new Set(legalMoves)
        : new Set(legalMoves || []);
    this.lastMove = lastMove || null;

    const ranks = perspective === "white" ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
    const files =
      perspective === "white"
        ? ["a","b","c","d","e","f","g","h"]
        : ["h","g","f","e","d","c","b","a"];

    // We reuse existing square elements; only update content and classes.
    // For orientation, we treat data-square as fixed coordinate and place pieces based on boardState.
    this.squareEls.forEach((squareEl, square) => {
      const pieceEl = squareEl.querySelector(".chess-piece");
      const code = boardState[square] || null;
      pieceEl.textContent = code ? (PIECE_TO_GLYPH[code] || "?") : "";

      squareEl.classList.remove(
        "highlight-selected",
        "highlight-legal",
        "highlight-last-move"
      );

      if (this.selectedSquare === square) {
        squareEl.classList.add("highlight-selected");
      }

      if (this.legalTargets.has(square)) {
        squareEl.classList.add("highlight-legal");
      }

      if (
        this.lastMove &&
        (this.lastMove.from === square || this.lastMove.to === square)
      ) {
        squareEl.classList.add("highlight-last-move");
      }
    });

    // Visual orientation: ensure CSS grid order follows desired ranks/files ordering.
    // Because we constructed DOM in a fixed order, we can dynamically set CSS order.
    let order = 0;
    for (const rank of ranks) {
      for (const file of files) {
        const coord = `${file}${rank}`;
        const squareEl = this.squareEls.get(coord);
        if (squareEl) {
          squareEl.style.order = String(order);
          order += 1;
        }
      }
    }
  }

  /**
   * Update only highlighting (selection / legal / last move).
   * @param {Object} options
   * @param {string|null} options.selected
   * @param {string[]|Set<string>} options.legalMoves
   * @param {{from: string, to: string}|null} options.lastMove
   */
  updateHighlights({ selected, legalMoves, lastMove }) {
    this.selectedSquare = selected || null;
    this.legalTargets =
      legalMoves instanceof Set
        ? new Set(legalMoves)
        : new Set(legalMoves || []);
    this.lastMove = lastMove || null;

    this.squareEls.forEach((squareEl, square) => {
      squareEl.classList.remove(
        "highlight-selected",
        "highlight-legal",
        "highlight-last-move"
      );

      if (this.selectedSquare === square) {
        squareEl.classList.add("highlight-selected");
      }

      if (this.legalTargets.has(square)) {
        squareEl.classList.add("highlight-legal");
      }

      if (
        this.lastMove &&
        (this.lastMove.from === square || this.lastMove.to === square)
      ) {
        squareEl.classList.add("highlight-last-move");
      }
    });
  }

  /**
   * Handle a user clicking a square.
   * Translates DOM event into algebraic square and forwards to callback.
   */
  handleSquareClick(event) {
    const squareEl = event.currentTarget;
    const square = squareEl.dataset.square;
    if (!square) return;
    this.onSquareSelected(square);
  }
}

