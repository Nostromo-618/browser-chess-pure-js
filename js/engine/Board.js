/**
 * Board.js
 *
 * Core board representation utilities.
 * - 8x8 board indexed 0..63, a1 = 0, h8 = 63.
 * - Piece codes: "wP","wN","wB","wR","wQ","wK","bP","bN","bB","bR","bQ","bK".
 * - Pure functions for mapping between index and algebraic notation.
 * - Lightweight helpers used by GameState, Rules, and AI.
 */

/** Files and ranks helpers */
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

/**
 * Create initial chess position.
 * @returns {string[]} board[64] piece codes or null
 */
export function createStartingBoard() {
  const b = new Array(64).fill(null);

  const place = (square, piece) => {
    b[algebraicToIndex(square)] = piece;
  };

  // White pieces
  ["a1","h1"].forEach((sq) => place(sq, "wR"));
  ["b1","g1"].forEach((sq) => place(sq, "wN"));
  ["c1","f1"].forEach((sq) => place(sq, "wB"));
  place("d1", "wQ");
  place("e1", "wK");
  for (const f of FILES) place(`${f}2`, "wP");

  // Black pieces
  ["a8","h8"].forEach((sq) => place(sq, "bR"));
  ["b8","g8"].forEach((sq) => place(sq, "bN"));
  ["c8","f8"].forEach((sq) => place(sq, "bB"));
  place("d8", "bQ");
  place("e8", "bK");
  for (const f of FILES) place(`${f}7`, "bP");

  return b;
}

/**
 * Convert (file, rank) to index, where a1 = 0, h1 = 7, a8 = 56.
 * @param {number} file 0-7
 * @param {number} rank 0-7
 */
export function frToIndex(file, rank) {
  return rank * 8 + file;
}

/**
 * Convert index to (file, rank).
 * @param {number} index 0-63
 * @returns {{file:number,rank:number}}
 */
export function indexToFR(index) {
  return {
    file: index % 8,
    rank: Math.floor(index / 8),
  };
}

/**
 * Convert index to algebraic coordinate, e.g. 0 -> "a1".
 * @param {number} index
 * @returns {string}
 */
export function indexToAlgebraic(index) {
  const { file, rank } = indexToFR(index);
  return `${FILES[file]}${rank + 1}`;
}

/**
 * Convert algebraic like "e4" to index.
 * @param {string} sq
 * @returns {number}
 */
export function algebraicToIndex(sq) {
  if (!sq || typeof sq !== "string" || sq.length !== 2) {
    throw new Error(`Invalid square: ${sq}`);
  }
  const fileChar = sq[0];
  const rankChar = sq[1];
  const file = FILES.indexOf(fileChar);
  const rank = Number(rankChar) - 1;
  if (file < 0 || rank < 0 || rank > 7) {
    throw new Error(`Invalid square: ${sq}`);
  }
  return frToIndex(file, rank);
}

/**
 * Get piece color.
 * @param {string|null} piece
 * @returns {"white"|"black"|null}
 */
export function getColorOf(piece) {
  if (!piece) return null;
  return piece[0] === "w" ? "white" : "black";
}

/**
 * Mirror color.
 * @param {"white"|"black"} color
 * @returns {"white"|"black"}
 */
export function oppositeColor(color) {
  return color === "white" ? "black" : "white";
}

/**
 * Clone board array (shallow, sufficient since elements are primitives).
 * @param {string[]} board
 * @returns {string[]}
 */
export function cloneBoard(board) {
  return board.slice();
}

/**
 * Build a map from algebraic squares to piece codes.
 * Useful for UI rendering.
 * @param {string[]} board
 * @returns {Record<string,string|null>}
 */
export function boardToMap(board) {
  const map = {};
  for (let i = 0; i < 64; i += 1) {
    map[indexToAlgebraic(i)] = board[i] || null;
  }
  return map;
}

