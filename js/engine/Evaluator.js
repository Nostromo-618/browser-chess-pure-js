/**
 * Evaluator.js
 *
 * Static evaluation for chess positions.
 * - Material balance
 * - Piece-square tables
 * - Basic king safety / mobility bonuses
 *
 * Tuned for clarity, not engine competition strength.
 */

import { getColorOf, oppositeColor } from "./Board.js";

/**
 * Piece values (centipawns).
 */
const PIECE_VALUES = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 0,
};

/**
 * Simple piece-square tables for middlegame, from white's perspective.
 * Indexed 0..63 with a1 = 0. We mirror for black where sensible.
 * Values are in centipawns.
 */

const PST_PAWN = [
   0,  0,  0,  0,  0,  0,  0,  0,
  40, 50, 50, 60, 60, 50, 50, 40,
  10, 10, 20, 35, 35, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  5, 20, 20,  5,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_KNIGHT = [
 -50,-40,-30,-30,-30,-30,-40,-50,
 -40,-20,  0,  0,  0,  0,-20,-40,
 -30,  0, 10, 15, 15, 10,  0,-30,
 -30,  5, 15, 20, 20, 15,  5,-30,
 -30,  0, 15, 20, 20, 15,  0,-30,
 -30,  5, 10, 15, 15, 10,  5,-30,
 -40,-20,  0,  5,  5,  0,-20,-40,
 -50,-40,-30,-30,-30,-30,-40,-50,
];

const PST_BISHOP = [
 -20,-10,-10,-10,-10,-10,-10,-20,
 -10,  5,  0,  0,  0,  0,  5,-10,
 -10, 10, 10, 10, 10, 10, 10,-10,
 -10,  0, 10, 10, 10, 10,  0,-10,
 -10,  5,  5, 10, 10,  5,  5,-10,
 -10,  0,  5, 10, 10,  5,  0,-10,
 -10,  0,  0,  0,  0,  0,  0,-10,
 -20,-10,-10,-10,-10,-10,-10,-20,
];

const PST_ROOK = [
  0,  0,  5, 10, 10,  5,  0,  0,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
  5, 10, 10, 10, 10, 10, 10,  5,
  0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_QUEEN = [
 -20,-10,-10, -5, -5,-10,-10,-20,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -10,  5,  5,  5,  5,  5,  0,-10,
  -5,  0,  5,  5,  5,  5,  0, -5,
   0,  0,  5,  5,  5,  5,  0, -5,
 -10,  5,  5,  5,  5,  5,  0,-10,
 -10,  0,  5,  0,  0,  0,  0,-10,
 -20,-10,-10, -5, -5,-10,-10,-20,
];

const PST_KING = [
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -30,-40,-40,-50,-50,-40,-40,-30,
 -20,-30,-30,-40,-40,-30,-30,-20,
 -10,-20,-20,-20,-20,-20,-20,-10,
  20, 20,  0,  0,  0,  0, 20, 20,
  20, 30, 10,  0,  0, 10, 30, 20,
];

/**
 * Evaluate board from perspective of `color`.
 * Positive score = good for `color`.
 *
 * @param {Object} state
 * @param {string[]} state.board
 * @param {"white"|"black"} color
 * @returns {number} score in centipawns
 */
export function evaluate(state, color) {
  const { board } = state;
  let score = 0;

  for (let i = 0; i < 64; i += 1) {
    const piece = board[i];
    if (!piece) continue;
    const pc = getColorOf(piece);
    const type = piece[1];
    const base = PIECE_VALUES[type] || 0;
    let pst = 0;

    switch (type) {
      case "P":
        pst = PST_PAWN[pstIndex(i, pc)];
        break;
      case "N":
        pst = PST_KNIGHT[pstIndex(i, pc)];
        break;
      case "B":
        pst = PST_BISHOP[pstIndex(i, pc)];
        break;
      case "R":
        pst = PST_ROOK[pstIndex(i, pc)];
        break;
      case "Q":
        pst = PST_QUEEN[pstIndex(i, pc)];
        break;
      case "K":
        pst = PST_KING[pstIndex(i, pc)];
        break;
      default:
        break;
    }

    const pieceScore = base + pst;
    score += pc === color ? pieceScore : -pieceScore;
  }

  // Encourage mobility: difference in legal moves (lightweight)
  // This uses a capped factor to avoid expensive re-generation at deep nodes.
  // if (typeof state.generateLegalMoveCount === "function") {
  //   const myMob = state.generateLegalMoveCount(color);
  //   const oppMob = state.generateLegalMoveCount(oppositeColor(color));
  //   score += 2 * (myMob - oppMob);
  // }

  return score;
}

/**
 * Map index for PST; mirror ranks for black so tables are from white's view.
 * @param {number} index
 * @param {"white"|"black"} color
 */
function pstIndex(index, color) {
  if (color === "white") return index;
  const file = index % 8;
  const rank = Math.floor(index / 8);
  const mirroredRank = 7 - rank;
  return mirroredRank * 8 + file;
}

