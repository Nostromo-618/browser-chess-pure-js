/**
 * AI.js
 *
 * Chess engine search implementation with 5 difficulty levels.
 * - Pure JS, no external dependencies.
 * - Uses:
 *   - Legal move generation from Rules.js
 *   - Static evaluation from Evaluator.js
 *   - Minimax with alpha-beta pruning
 *   - Simple move ordering and quiescence-like capture extensions
 *   - Slight randomness at all levels for variety
 *
 * Difficulty mapping (approx; depth is ply, not full moves):
 *   1: depth 1 (material + small noise, some randomness)
 *   2: depth 2
 *   3: depth 3
 *   4: depth 3 + quiescence and better ordering
 *   5: depth 4 + quiescence; may take several seconds in complex positions
 */

import { oppositeColor, cloneBoard } from "./Board.js";
import { generateLegalMoves, isInCheck } from "./Rules.js";
import { evaluate } from "./Evaluator.js";

/**
 * Piece values used for ordering / randomness bands.
 * Keep in sync with Evaluator.js values.
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
 * Internal representation wrapper for search.
 */
class SearchState {
  constructor(baseState) {
    // Minimal mutable copy suitable for search.
    this.board = cloneBoard(baseState.board);
    this.activeColor = baseState.activeColor;
    this.castlingRights = JSON.parse(JSON.stringify(baseState.castlingRights));
    this.enPassantTarget = baseState.enPassantTarget;
    this.halfmoveClock = baseState.halfmoveClock;
    this.fullmoveNumber = baseState.fullmoveNumber;

    // Mobility callback used by Evaluator.
    this.generateLegalMoveCount = (color) =>
      generateLegalMoves({
        board: this.board,
        activeColor: color,
        castlingRights: this.castlingRights,
        enPassantTarget: this.enPassantTarget,
      }).length;
  }

  clone() {
    const s = new SearchState(this);
    s.board = cloneBoard(this.board);
    s.activeColor = this.activeColor;
    s.castlingRights = JSON.parse(JSON.stringify(this.castlingRights));
    s.enPassantTarget = this.enPassantTarget;
    s.halfmoveClock = this.halfmoveClock;
    s.fullmoveNumber = this.fullmoveNumber;
    s.generateLegalMoveCount = this.generateLegalMoveCount;
    return s;
  }
}

/**
 * Apply a legal move on SearchState.
 * Lighter than full GameState.applyMove but consistent with rules.
 *
 * @param {SearchState} state
 * @param {import("./Move.js").Move} move
 * @param {"white"|"black"} mover
 */
function applyMoveSearch(state, move, mover) {
  const fromIndex = algebraicToIndexFast(move.from);
  const toIndex = algebraicToIndexFast(move.to);
  const movingPiece = state.board[fromIndex];
  const enemy = oppositeColor(mover);

  const isPawn = movingPiece && movingPiece[1] === "P";
  const isCapture = !!(move.captured || move.isEnPassant);

  // Halfmove clock
  if (isPawn || isCapture) {
    state.halfmoveClock = 0;
  } else {
    state.halfmoveClock += 1;
  }

  // Clear en passant
  state.enPassantTarget = null;

  state.board[fromIndex] = null;

  // En passant capture
  if (move.isEnPassant) {
    const dir = mover === "white" ? -1 : 1;
    const tf = toIndex % 8;
    const tr = Math.floor(toIndex / 8);
    const capIndex = (tr + dir) * 8 + tf;
    state.board[capIndex] = null;
  }

  // Castling: move rook
  if (move.isCastleKingSide || move.isCastleQueenSide) {
    const rank = mover === "white" ? 0 : 7;
    if (move.isCastleKingSide) {
      const rookFrom = rank * 8 + 7;
      const rookTo = rank * 8 + 5;
      state.board[rookTo] = state.board[rookFrom];
      state.board[rookFrom] = null;
    } else {
      const rookFrom = rank * 8 + 0;
      const rookTo = rank * 8 + 3;
      state.board[rookTo] = state.board[rookFrom];
      state.board[rookFrom] = null;
    }
  }

  // Promotion
  if (move.promotion) {
    const prefix = mover === "white" ? "w" : "b";
    state.board[toIndex] = `${prefix}${move.promotion}`;
  } else {
    state.board[toIndex] = movingPiece;
  }

  // En passant target for double pawn push
  if (isPawn) {
    const fromRank = Math.floor(fromIndex / 8);
    const toRank = Math.floor(toIndex / 8);
    if (Math.abs(toRank - fromRank) === 2) {
      const midRank = (fromRank + toRank) / 2;
      const file = toIndex % 8;
      const epIndex = midRank * 8 + file;
      state.enPassantTarget = indexToAlgebraicFast(epIndex);
    }
  }

  // Simplified castling rights update
  updateCastlingRightsSearch(state, move, fromIndex, toIndex, movingPiece);

  state.activeColor = enemy;
  if (mover === "black") {
    state.fullmoveNumber += 1;
  }
}

function updateCastlingRightsSearch(
  state,
  move,
  fromIndex,
  toIndex,
  movingPiece
) {
  const cr = state.castlingRights;
  const fromSq = indexToAlgebraicFast(fromIndex);
  const toSq = indexToAlgebraicFast(toIndex);

  if (movingPiece === "wK") {
    cr.white.kingSide = false;
    cr.white.queenSide = false;
  } else if (movingPiece === "bK") {
    cr.black.kingSide = false;
    cr.black.queenSide = false;
  }

  // Rook moves / captures
  if (fromSq === "h1" || toSq === "h1") cr.white.kingSide = false;
  if (fromSq === "a1" || toSq === "a1") cr.white.queenSide = false;
  if (fromSq === "h8" || toSq === "h8") cr.black.kingSide = false;
  if (fromSq === "a8" || toSq === "a8") cr.black.queenSide = false;
}

/* === Fast algebraic helpers (engine internal use) === */

function algebraicToIndexFast(sq) {
  const file = sq.charCodeAt(0) - 97; // 'a'
  const rank = sq.charCodeAt(1) - 49; // '1'
  return rank * 8 + file;
}

function indexToAlgebraicFast(index) {
  const file = String.fromCharCode(97 + (index % 8));
  const rank = String.fromCharCode(49 + Math.floor(index / 8));
  return file + rank;
}

/* === AI core === */

export class AI {
  constructor() {
    // Tunable randomness factor per level
    this.randomness = {
      1: 0.4,
      2: 0.25,
      3: 0.15,
      4: 0.08,
      5: 0.05,
    };

    this.depthForLevel = {
      1: 1,
      2: 2,
      3: 3,
      4: 3,
      5: 4,
    };
  }

  /**
   * Top-level API used by Game.
   *
   * @param {import("./GameState.js").GameState} gameState
   * @param {Object} options
   * @param {number} options.level 1..5
   * @param {"white"|"black"} options.forColor
   * @returns {Promise<import("./Move.js").Move|null>}
   */
  async findBestMove(gameState, { level, forColor, timeout = 10000 }) {
    const clampedLevel = Math.max(1, Math.min(5, Number(level) || 1));
    const depth = this.depthForLevel[clampedLevel];

    const baseState = new SearchState(gameState);
    const legalMoves = generateLegalMoves(baseState);
    if (legalMoves.length === 0) return null;

    // Level 1: lightweight, semi-random play.
    if (clampedLevel === 1) {
      return this.pickLevel1Move(baseState, legalMoves, forColor);
    }

    // Progressive deepening with time limits for higher levels to prevent UI freezing
    if (clampedLevel >= 2) { // Enable progressive deepening for all levels > 1 to respect timeout
      return this.progressiveDeepeningSearch(baseState, legalMoves, depth, forColor, clampedLevel, timeout);
    }

    // Synchronous search wrapped in Promise for async API.
    return new Promise((resolve) => {
      const move = this.searchRoot(baseState, legalMoves, depth, forColor, {
        level: clampedLevel,
      });
      resolve(move);
    });
  }

  pickLevel1Move(state, moves, color) {
    const scored = moves.map((m) => {
      const next = state.clone();
      applyMoveSearch(next, m, state.activeColor);
      const score = evaluate(next, color);
      return { move: m, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const keepCount = Math.max(1, Math.floor(scored.length * 0.4));
    const top = scored.slice(0, keepCount);
    return top[Math.floor(Math.random() * top.length)].move;
  }

  /**
   * Root search with alpha-beta, move ordering, and level-aware randomness.
   */
  searchRoot(state, legalMoves, depth, color, { level, timeout, startTime }) {
    const isMaximizing = state.activeColor === color;

    // Basic move ordering: captures first.
    const ordered = legalMoves.slice().sort((a, b) => {
      const ac = a.captured ? pieceValueApprox(a.captured) : 0;
      const bc = b.captured ? pieceValueApprox(b.captured) : 0;
      return bc - ac;
    });

    let bestMove = ordered[0];
    let bestScore = isMaximizing ? -Infinity : Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    for (const move of ordered) {
      // Check timeout before processing each move
      if (timeout && startTime && Date.now() - startTime >= timeout) {
        break;
      }

      const next = state.clone();
      applyMoveSearch(next, move, state.activeColor);
      const score = this.minimax(
        next,
        depth - 1,
        alpha,
        beta,
        color,
        !isMaximizing,
        level,
        timeout,
        startTime
      );

      // Check if timeout was exceeded (indicated by null return)
      if (score === null) {
        break;
      }

      if (isMaximizing) {
        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        if (score > alpha) alpha = score;
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestMove = move;
        }
        if (score < beta) beta = score;
      }

      if (beta <= alpha) break;
    }

    // Slight randomness: pick among moves near best score.
    // Skip if timeout was exceeded to avoid wasting time
    if (!(timeout && startTime && Date.now() - startTime >= timeout)) {
      const jitter = this.randomness[level] || 0;
      if (jitter > 0 && ordered.length > 1) {
        const candidates = [];
        for (const move of ordered) {
          // Check timeout during candidate evaluation
          if (timeout && startTime && Date.now() - startTime >= timeout) {
            break;
          }
          const next = state.clone();
          applyMoveSearch(next, move, state.activeColor);
          const score = evaluate(next, color);
          const delta = Math.abs(score - bestScore);
          if (delta <= PIECE_VALUES.P * jitter * 2) {
            candidates.push(move);
          }
        }
        if (candidates.length > 0) {
          return candidates[Math.floor(Math.random() * candidates.length)];
        }
      }
    }

    return bestMove;
  }

  /**
   * Minimax with alpha-beta and simple quiescence for higher levels.
   */
  minimax(state, depth, alpha, beta, rootColor, isMaximizing, level, timeout, startTime) {
    // Check timeout at the start of each recursive call
    if (timeout && startTime && Date.now() - startTime >= timeout) {
      return null; // Signal timeout
    }

    const legalMoves = generateLegalMoves(state);

    if (depth === 0 || legalMoves.length === 0) {
      let baseScore = evaluate(state, rootColor);

      // Checkmate / stalemate approximation
      if (legalMoves.length === 0) {
        const inCheck = isInCheck(state);
        if (inCheck) {
          baseScore =
            state.activeColor === rootColor ? -100000 : 100000;
        } else {
          baseScore = 0;
        }
      }

      // Quiescence on higher levels
      if (depth <= 0 && level >= 4) {
        const qScore = this.quiescence(state, alpha, beta, rootColor, baseScore, timeout, startTime);
        // Check if quiescence timed out
        if (qScore === null) {
          return baseScore; // Return stand-pat score if quiescence timed out
        }
        return qScore;
      }

      return baseScore;
    }

    // Order: captures/promotions first
    const ordered = legalMoves.slice().sort((a, b) => {
      const aScore =
        (a.captured ? pieceValueApprox(a.captured) : 0) +
        (a.promotion ? pieceValueApprox(a.promotion) : 0);
      const bScore =
        (b.captured ? pieceValueApprox(b.captured) : 0) +
        (b.promotion ? pieceValueApprox(b.promotion) : 0);
      return bScore - aScore;
    });

    if (isMaximizing) {
      let value = -Infinity;
      for (let i = 0; i < ordered.length; i++) {
        // Check timeout periodically (every 10 moves to avoid overhead)
        if (timeout && startTime && i % 10 === 0 && Date.now() - startTime >= timeout) {
          return null; // Signal timeout
        }

        const move = ordered[i];
        const next = state.clone();
        applyMoveSearch(next, move, state.activeColor);
        const child = this.minimax(
          next,
          depth - 1,
          alpha,
          beta,
          rootColor,
          false,
          level,
          timeout,
          startTime
        );

        // Check if child search timed out
        if (child === null) {
          return null; // Propagate timeout
        }

        if (child > value) value = child;
        if (value > alpha) alpha = value;
        if (alpha >= beta) break;
      }
      return value;
    }

    let value = Infinity;
    for (let i = 0; i < ordered.length; i++) {
      // Check timeout periodically (every 10 moves to avoid overhead)
      if (timeout && startTime && i % 10 === 0 && Date.now() - startTime >= timeout) {
        return null; // Signal timeout
      }

      const move = ordered[i];
      const next = state.clone();
      applyMoveSearch(next, move, state.activeColor);
      const child = this.minimax(
        next,
        depth - 1,
        alpha,
        beta,
        rootColor,
        true,
        level,
        timeout,
        startTime
      );

      // Check if child search timed out
      if (child === null) {
        return null; // Propagate timeout
      }

      if (child < value) value = child;
      if (value < beta) beta = value;
      if (alpha >= beta) break;
    }
    return value;
  }

  /**
   * Simple quiescence search: follow capture sequences.
   */
  quiescence(state, alpha, beta, rootColor, standPat, timeout, startTime) {
    // Check timeout at the start of quiescence search
    if (timeout && startTime && Date.now() - startTime >= timeout) {
      return null; // Signal timeout
    }

    let value = standPat;
    if (value > alpha) {
      alpha = value;
      if (alpha >= beta) return alpha;
    }

    const allMoves = generateLegalMoves(state);
    const captureMoves = allMoves.filter((m) => m.captured);

    const limited = captureMoves.slice(0, 16);

    for (let i = 0; i < limited.length; i++) {
      // Check timeout periodically during quiescence
      if (timeout && startTime && i % 5 === 0 && Date.now() - startTime >= timeout) {
        return value; // Return current best value if timeout
      }

      const move = limited[i];
      const next = state.clone();
      applyMoveSearch(next, move, state.activeColor);
      const score = -this.quiescence(
        next,
        -beta,
        -alpha,
        rootColor,
        evaluate(next, rootColor),
        timeout,
        startTime
      );

      // Check if recursive quiescence timed out
      if (score === null) {
        return value; // Return current best value
      }

      if (score > value) value = score;
      if (value > alpha) alpha = value;
      if (alpha >= beta) break;
    }
    return value;
  }

  /**
   * Progressive deepening search with time limits to prevent UI freezing.
   * Uses iterative deepening starting from lower depths and increasing
   * as time allows, yielding control to UI between iterations.
   */
  async progressiveDeepeningSearch(state, legalMoves, maxDepth, color, level, timeout = 10000) {
    const startTime = Date.now();
    let bestMove = legalMoves[0]; // Fallback move
    let currentDepth = 1;

    // Start with depth 1 and progressively increase
    while (currentDepth <= maxDepth) {
      // Check time budget before starting new depth
      if (Date.now() - startTime >= timeout) {
        break;
      }

      // Use setTimeout to yield control back to the UI/Worker loop
      await new Promise(resolve => setTimeout(resolve, 0));

      // Pass timeout and startTime to searchRoot so it can check during search
      const move = this.searchRoot(state, legalMoves, currentDepth, color, {
        level: level,
        timeout: timeout,
        startTime: startTime,
      });

      if (move) {
        bestMove = move;
      }

      // Check timeout again after search completes
      if (Date.now() - startTime >= timeout) {
        break;
      }

      currentDepth++;
    }

    return bestMove;
  }

}

/* === Utility: approximate piece value === */

function pieceValueApprox(piece) {
  if (!piece) return 0;
  const code = String(piece);
  const type = code[code.length - 1];
  return PIECE_VALUES[type] || 0;
}

