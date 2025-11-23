/**
 * Rules.js
 *
 * Generates legal moves for a given GameState-like snapshot.
 * Implements:
 * - All standard piece moves.
 * - Castling (both sides, both colors) with check constraints.
 * - En passant using enPassantTarget from state.
 * - Pawn promotions (to Q/R/B/N, defaulting to Q for engine).
 * - Check, checkmate, stalemate detection helpers.
 *
 * This module is pure w.r.t board + state arguments and contains no DOM logic.
 */

import {
  algebraicToIndex,
  indexToAlgebraic,
  indexToFR,
  getColorOf,
  oppositeColor,
} from "./Board.js";
import {
  createMove,
  createPromotionMove,
  createEnPassantMove,
  createCastleMove,
} from "./Move.js";

/**
 * @typedef {import("./Move.js").Move} Move
 */

/**
 * Generate all pseudo-legal moves (not filtered for leaving king in check).
 * @param {Object} state
 * @param {string[]} state.board length 64
 * @param {"white"|"black"} state.activeColor
 * @param {{white:{kingSide:boolean,queenSide:boolean},black:{kingSide:boolean,queenSide:boolean}}} state.castlingRights
 * @param {string|null} state.enPassantTarget - algebraic square behind pawn just moved two squares
 * @returns {Move[]}
 */
export function generatePseudoLegalMoves(state) {
  const moves = [];
  const { board, activeColor, castlingRights, enPassantTarget } = state;
  const enemy = oppositeColor(activeColor);

  const epIndex =
    enPassantTarget != null ? algebraicToIndex(enPassantTarget) : -1;

  for (let fromIndex = 0; fromIndex < 64; fromIndex += 1) {
    const piece = board[fromIndex];
    if (!piece) continue;
    const color = getColorOf(piece);
    if (color !== activeColor) continue;

    const fromSq = indexToAlgebraic(fromIndex);
    const { file, rank } = indexToFR(fromIndex);

    switch (piece[1]) {
      case "P":
        generatePawnMoves(
          state,
          fromIndex,
          fromSq,
          file,
          rank,
          color,
          enemy,
          epIndex,
          moves
        );
        break;
      case "N":
        generateKnightMoves(board, fromIndex, fromSq, color, moves);
        break;
      case "B":
        generateSlidingMoves(board, fromIndex, fromSq, color, moves, [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
        break;
      case "R":
        generateSlidingMoves(board, fromIndex, fromSq, color, moves, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]);
        break;
      case "Q":
        generateSlidingMoves(board, fromIndex, fromSq, color, moves, [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ]);
        break;
      case "K":
        generateKingMoves(board, fromIndex, fromSq, color, moves);
        generateCastlingMoves(
          state,
          fromIndex,
          fromSq,
          color,
          castlingRights,
          moves
        );
        break;
      default:
        break;
    }
  }

  return moves;
}

/**
 * Filter pseudo-legal moves to legal ones (king not left in check).
 * @param {Object} state
 * @returns {Move[]}
 */
export function generateLegalMoves(state) {
  const pseudoMoves = generatePseudoLegalMoves(state);
  const legal = [];

  for (const move of pseudoMoves) {
    if (!leavesKingInCheck(state, move)) {
      legal.push(move);
    }
  }

  return legal;
}

/**
 * Determine if the side to move is currently in check.
 * @param {Object} state
 * @param {"white"|"black"} [colorOverride] if provided, check that color instead
 * @returns {boolean}
 */
export function isInCheck(state, colorOverride) {
  const color = colorOverride || state.activeColor;
  const enemy = oppositeColor(color);
  const kingSquare = findKingSquare(state.board, color);
  if (!kingSquare) return false;
  return squareAttackedBy(state, kingSquare, enemy);
}

/**
 * Generate game status from legal moves and check state.
 * Used by GameState to derive checkmate/stalemate/draw states.
 *
 * @param {Object} state
 * @returns {{
 *   hasLegalMoves: boolean,
 *   isCheck: boolean
 * }}
 */
export function analyzePosition(state) {
  const legalMoves = generateLegalMoves(state);
  const isCheckFlag = isInCheck(state);
  return {
    hasLegalMoves: legalMoves.length > 0,
    isCheck: isCheckFlag,
  };
}

/* ===== Piece-specific generators ===== */

function generatePawnMoves(
  state,
  fromIndex,
  fromSq,
  file,
  rank,
  color,
  enemy,
  epIndex,
  moves
) {
  const { board } = state;
  const dir = color === "white" ? 1 : -1;
  const startRank = color === "white" ? 1 : 6;
  const promotionRank = color === "white" ? 6 : 1;
  const lastRank = color === "white" ? 7 : 0;

  const oneStepRank = rank + dir;
  if (oneStepRank >= 0 && oneStepRank <= 7) {
    const oneStepIndex = oneStepRank * 8 + file;
    if (!board[oneStepIndex]) {
      // Forward move
      addPawnAdvance(fromSq, fromIndex, oneStepIndex, color, promotionRank, lastRank, moves);

      // Two-step from starting rank
      if (rank === startRank) {
        const twoStepRank = rank + 2 * dir;
        const twoStepIndex = twoStepRank * 8 + file;
        if (!board[twoStepIndex]) {
          moves.push(
            createMove(fromSq, indexToAlgebraic(twoStepIndex), board[fromIndex])
          );
        }
      }
    }
  }

  // Captures (including promotion)
  const captureFiles = [file - 1, file + 1];
  for (const cf of captureFiles) {
    if (cf < 0 || cf > 7) continue;
    const targetRank = rank + dir;
    if (targetRank < 0 || targetRank > 7) continue;
    const targetIndex = targetRank * 8 + cf;
    const targetPiece = board[targetIndex];

    if (targetPiece && getColorOf(targetPiece) === enemy) {
      addPawnCapture(
        fromSq,
        fromIndex,
        targetIndex,
        color,
        targetPiece,
        promotionRank,
        lastRank,
        moves
      );
    }

    // En passant
    if (epIndex === targetIndex && !targetPiece) {
      const epPawnRank = rank;
      const epPawnIndex = epPawnRank * 8 + cf;
      const captured = board[epPawnIndex];
      if (captured && getColorOf(captured) === enemy) {
        moves.push(
          createEnPassantMove(
            fromSq,
            indexToAlgebraic(targetIndex),
            board[fromIndex],
            captured
          )
        );
      }
    }
  }
}

function addPawnAdvance(
  fromSq,
  fromIndex,
  toIndex,
  color,
  promotionRank,
  lastRank,
  moves
) {
  const piece = color === "white" ? "wP" : "bP";
  const toSq = indexToAlgebraic(toIndex);
  const { rank } = indexToFR(fromIndex);

  if (rank === promotionRank) {
    // Generate promotions to Q,R,B,N
    ["Q", "R", "B", "N"].forEach((promo) => {
      moves.push(createPromotionMove(fromSq, toSq, piece, promo));
    });
  } else {
    moves.push(createMove(fromSq, toSq, piece));
  }
}

function addPawnCapture(
  fromSq,
  fromIndex,
  toIndex,
  color,
  capturedPiece,
  promotionRank,
  lastRank,
  moves
) {
  const piece = color === "white" ? "wP" : "bP";
  const toSq = indexToAlgebraic(toIndex);
  const { rank } = indexToFR(fromIndex);

  if (rank === promotionRank) {
    ["Q", "R", "B", "N"].forEach((promo) => {
      moves.push(
        createPromotionMove(fromSq, toSq, piece, promo, capturedPiece)
      );
    });
  } else {
    moves.push(createMove(fromSq, toSq, piece, capturedPiece));
  }
}

function generateKnightMoves(board, fromIndex, fromSq, color, moves) {
  const { file, rank } = indexToFR(fromIndex);
  const jumps = [
    [1, 2],
    [2, 1],
    [2, -1],
    [1, -2],
    [-1, -2],
    [-2, -1],
    [-2, 1],
    [-1, 2],
  ];

  for (const [df, dr] of jumps) {
    const nf = file + df;
    const nr = rank + dr;
    if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
    const toIndex = nr * 8 + nf;
    const target = board[toIndex];
    if (!target || getColorOf(target) !== color) {
      moves.push(
        createMove(
          fromSq,
          indexToAlgebraic(toIndex),
          board[fromIndex],
          target || null
        )
      );
    }
  }
}

function generateSlidingMoves(board, fromIndex, fromSq, color, moves, dirs) {
  for (const [df, dr] of dirs) {
    let { file, rank } = indexToFR(fromIndex);
    while (true) {
      file += df;
      rank += dr;
      if (file < 0 || file > 7 || rank < 0 || rank > 7) break;
      const toIndex = rank * 8 + file;
      const target = board[toIndex];
      if (!target) {
        moves.push(
          createMove(
            fromSq,
            indexToAlgebraic(toIndex),
            board[fromIndex],
            null
          )
        );
      } else {
        if (getColorOf(target) !== color) {
          moves.push(
            createMove(
              fromSq,
              indexToAlgebraic(toIndex),
              board[fromIndex],
              target
            )
          );
        }
        break;
      }
    }
  }
}

function generateKingMoves(board, fromIndex, fromSq, color, moves) {
  const { file, rank } = indexToFR(fromIndex);
  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) continue;
      const nf = file + df;
      const nr = rank + dr;
      if (nf < 0 || nf > 7 || nr < 0 || nr > 7) continue;
      const toIndex = nr * 8 + nf;
      const target = board[toIndex];
      if (!target || getColorOf(target) !== color) {
        moves.push(
          createMove(
            fromSq,
            indexToAlgebraic(toIndex),
            board[fromIndex],
            target || null
          )
        );
      }
    }
  }
}

function generateCastlingMoves(
  state,
  kingIndex,
  kingSq,
  color,
  castlingRights,
  moves
) {
  const { board } = state;
  const rights = castlingRights[color];
  const rank = color === "white" ? 0 : 7;
  const kingStartIndex = rank * 8 + 4;
  if (kingIndex !== kingStartIndex) return;

  const enemy = oppositeColor(color);

  // Ensure king is not currently in check
  if (squareAttackedBy(state, kingSq, enemy)) return;

  // King-side
  if (rights.kingSide) {
    const fIndex = rank * 8 + 5;
    const gIndex = rank * 8 + 6;
    if (!board[fIndex] && !board[gIndex]) {
      const fSq = indexToAlgebraic(fIndex);
      const gSq = indexToAlgebraic(gIndex);
      if (
        !squareAttackedBy(state, fSq, enemy) &&
        !squareAttackedBy(state, gSq, enemy)
      ) {
        moves.push(
          createCastleMove(
            kingSq,
            gSq,
            board[kingIndex],
            true // king side
          )
        );
      }
    }
  }

  // Queen-side
  if (rights.queenSide) {
    const dIndex = rank * 8 + 3;
    const cIndex = rank * 8 + 2;
    const bIndex = rank * 8 + 1;
    if (!board[dIndex] && !board[cIndex] && !board[bIndex]) {
      const dSq = indexToAlgebraic(dIndex);
      const cSq = indexToAlgebraic(cIndex);
      if (
        !squareAttackedBy(state, dSq, enemy) &&
        !squareAttackedBy(state, cSq, enemy)
      ) {
        moves.push(
          createCastleMove(
            kingSq,
            cSq,
            board[kingIndex],
            false // queen side
          )
        );
      }
    }
  }
}

/* ===== Attack / check helpers ===== */

function findKingSquare(board, color) {
  const kingCode = color === "white" ? "wK" : "bK";
  for (let i = 0; i < 64; i += 1) {
    if (board[i] === kingCode) return indexToAlgebraic(i);
  }
  return null;
}

/**
 * Whether a given square is attacked by a specific color.
 * Uses piece-specific patterns for efficiency.
 */
function squareAttackedBy(state, targetSq, attackerColor) {
  const { board } = state;
  const targetIndex = algebraicToIndex(targetSq);
  const { file: tf, rank: tr } = indexToFR(targetIndex);

  // Scan all attacker pieces and see if any has a legal capture on targetSq.
  for (let i = 0; i < 64; i += 1) {
    const piece = board[i];
    if (!piece || getColorOf(piece) !== attackerColor) continue;
    const type = piece[1];
    const fromSq = indexToAlgebraic(i);
    const { file, rank } = indexToFR(i);

    switch (type) {
      case "P": {
        const dir = attackerColor === "white" ? 1 : -1;
        const captureRanks = rank + dir;
        if (captureRanks === tr && Math.abs(file - tf) === 1) {
          // Pawns attack diagonally forward; ignore occupancy details here.
          return true;
        }
        break;
      }
      case "N": {
        const df = Math.abs(file - tf);
        const dr = Math.abs(rank - tr);
        if ((df === 1 && dr === 2) || (df === 2 && dr === 1)) {
          return true;
        }
        break;
      }
      case "B":
      case "R":
      case "Q": {
        const df = tf - file;
        const dr = tr - rank;
        const adf = Math.abs(df);
        const adr = Math.abs(dr);
        let stepF = 0;
        let stepR = 0;

        if (type === "B" || type === "Q") {
          if (adf === adr && adf > 0) {
            stepF = df > 0 ? 1 : -1;
            stepR = dr > 0 ? 1 : -1;
          }
        }
        if (type === "R" || type === "Q") {
          if (df === 0 && adr > 0) {
            stepF = 0;
            stepR = dr > 0 ? 1 : -1;
          } else if (dr === 0 && adf > 0) {
            stepF = df > 0 ? 1 : -1;
            stepR = 0;
          }
        }

        if (stepF !== 0 || stepR !== 0) {
          let f = file + stepF;
          let r = rank + stepR;
          let blocked = false;
          while (f !== tf || r !== tr) {
            if (f < 0 || f > 7 || r < 0 || r > 7) {
              blocked = true;
              break;
            }
            if (board[r * 8 + f]) {
              blocked = true;
              break;
            }
            f += stepF;
            r += stepR;
          }
          if (!blocked && f === tf && r === tr) {
            return true;
          }
        }
        break;
      }
      case "K": {
        if (Math.max(Math.abs(file - tf), Math.abs(rank - tr)) === 1) {
          return true;
        }
        break;
      }
      default:
        break;
    }

    // fromSq is unused but kept for clarity of pattern.
    void fromSq;
  }

  return false;
}

/**
 * Check if applying a move leaves own king in check.
 * Used to filter pseudo-legal moves.
 * @param {Object} state
 * @param {Move} move
 */
function leavesKingInCheck(state, move) {
  const clone = {
    board: state.board.slice(),
    activeColor: state.activeColor,
    castlingRights: JSON.parse(JSON.stringify(state.castlingRights)),
    enPassantTarget: state.enPassantTarget,
  };

  // Apply move minimally; GameState has full application logic,
  // but for legality we only need piece placements + king location.
  const fromIndex = algebraicToIndex(move.from);
  const toIndex = algebraicToIndex(move.to);

  clone.board[fromIndex] = null;

  if (move.isEnPassant) {
    // Remove captured pawn behind target square
    const dir = getColorOf(move.piece) === "white" ? -1 : 1;
    const { file: tf, rank: tr } = indexToFR(toIndex);
    const capIndex = (tr + dir) * 8 + tf;
    clone.board[capIndex] = null;
  }

  if (move.promotion) {
    const color = getColorOf(move.piece) === "white" ? "w" : "b";
    clone.board[toIndex] = `${color}${move.promotion}`;
  } else {
    clone.board[toIndex] = move.piece;
  }

  // Castling: move rook for attack map correctness.
  if (move.isCastleKingSide || move.isCastleQueenSide) {
    const color = getColorOf(move.piece);
    const rank = color === "white" ? 0 : 7;
    if (move.isCastleKingSide) {
      const rookFrom = rank * 8 + 7;
      const rookTo = rank * 8 + 5;
      clone.board[rookTo] = clone.board[rookFrom];
      clone.board[rookFrom] = null;
    } else {
      const rookFrom = rank * 8 + 0;
      const rookTo = rank * 8 + 3;
      clone.board[rookTo] = clone.board[rookFrom];
      clone.board[rookFrom] = null;
    }
  }

  const moverColor = state.activeColor;
  const enemy = oppositeColor(moverColor);
  const kingSq = findKingSquare(clone.board, moverColor);
  if (!kingSq) {
    // Should not happen in valid chess, but treat as illegal.
    return true;
  }
  return squareAttackedBy(
    {
      board: clone.board,
      activeColor: enemy,
      castlingRights: clone.castlingRights,
      enPassantTarget: clone.enPassantTarget,
    },
    kingSq,
    enemy
  );
}

