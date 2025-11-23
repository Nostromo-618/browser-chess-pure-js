import { GameState } from "./engine/GameState.js";
import { AI } from "./engine/AI.js";
import { generateLegalMoves } from "./engine/Rules.js";

/**
 * Game.js
 *
 * Orchestrates GameState (rules engine) with UI-facing callbacks.
 * This module:
 * - Configures initial side (white/black/random).
 * - Delegates rule validation and move generation to GameState.
 * - Delegates AI move search to AI.
 * - Exposes high-level methods used by the frontend.
 */

export class Game {
  /**
   * @param {Object} options
   * @param {"white"|"black"|"random"} options.playerColor
   * @param {number} options.difficulty - 1..5
   * @param {(snapshot: import("./engine/GameState.js").GameSnapshot) => void} options.onUpdate
   */
  constructor({ playerColor, difficulty, onUpdate }) {
    this.ai = new AI();
    this.onUpdate = onUpdate || (() => { });

    const resolvedPlayerColor =
      playerColor === "white" || playerColor === "black"
        ? playerColor
        : Math.random() < 0.5
          ? "white"
          : "black";

    this.state = GameState.createStarting(resolvedPlayerColor);

    this.setDifficulty(difficulty || 3);
    this.notify();
  }

  /**
   * Update AI difficulty.
   * @param {number} level 1..5
   */
  setDifficulty(level) {
    const clamped = Math.max(1, Math.min(5, Number(level) || 3));
    this.difficulty = clamped;
  }

  /**
   * Get underlying board representation for UI.
   * @returns {Record<string,string|null>}
   */
  getBoard() {
    return this.state.getBoardMap();
  }

  /**
   * Get the side the human is playing.
   * @returns {"white"|"black"}
   */
  getPlayerColor() {
    return this.state.playerColor;
  }

  /**
   * Current turn color.
   * @returns {"white"|"black"}
   */
  getCurrentTurn() {
    return this.state.activeColor;
  }

  /**
   * Whether the game is over.
   * @returns {boolean}
   */
  isGameOver() {
    return this.state.isGameOver();
  }

  /**
   * Get serialized game state for AI/API.
   * @returns {Object}
   */
  getGameState() {
    return this.state.serialize();
  }

  /**
   * Snapshot for UI.
   * @returns {import("./engine/GameState.js").GameSnapshot}
   */
  getSnapshot() {
    return this.state.getSnapshot();
  }

  /**
   * Handle user clicking a square as part of a potential move.
   * This method encapsulates selection + move confirmation behavior.
   *
   * @param {string} square - algebraic coordinate, e.g. "e2"
   * @returns {{
   *   changed: boolean,
   *   selected: string|null,
   *   legalTargets: string[],
   *   lastMove: {from:string,to:string}|null
   * }}
   */
  getLegalMovesForSquare(square) {
    if (this.isGameOver()) return [];
    const allLegal = generateLegalMoves(this.state.asRulesState());
    return allLegal
      .filter(m => m.from === square)
      .map(m => m.to);
  }

  /**
   * Handle user clicking a square as part of a potential move.
   * @param {string} square - algebraic coordinate, e.g. "e2"
   * @returns {{
   *   changed: boolean,
   *   selected: string|null,
   *   legalTargets: string[],
   *   lastMove: {from:string,to:string}|null
   * }}
   */
  handlePlayerSquareSelection(square) {
    if (this.isGameOver()) {
      return {
        changed: false,
        selected: null,
        legalTargets: [],
        lastMove: this.state.lastMove,
      };
    }

    const color = this.getPlayerColor();
    const result = this.state.handleSelection(square, color);
    if (result.moved) {
      this.notify();
    }
    return {
      changed: result.moved,
      selected: result.selectedSquare,
      legalTargets: result.legalTargets,
      lastMove: this.state.lastMove,
    };
  }

  /**
   * Handle a direct move request (e.g. from API).
   * @param {import("./engine/Move.js").Move} move
   * @returns {{ success: boolean, move?: import("./engine/Move.js").Move, error?: string }}
   */
  handlePlayerMove(move) {
    if (this.isGameOver()) {
      return { success: false, error: "Game is over" };
    }

    if (this.getCurrentTurn() !== this.getPlayerColor()) {
      return { success: false, error: "Not your turn" };
    }

    const legalMoves = generateLegalMoves(this.state.asRulesState());
    const validMove = legalMoves.find(m =>
      m.from === move.from &&
      m.to === move.to &&
      (!move.promotion || m.promotion === move.promotion)
    );

    if (!validMove) {
      return { success: false, error: "Illegal move" };
    }

    this.state.applyMove(validMove);
    this.notify();
    return { success: true, move: validMove };
  }

  /**
   * Ask AI to compute best move given current state and difficulty.
   * Uses async to avoid blocking UI; actual search is synchronous within.
   *
   * @returns {Promise<import("./engine/Move.js").Move|null>}
   */
  async computeAIMove() {
    if (this.isGameOver()) return null;
    const aiColor = this.getCurrentTurn();
    return this.ai.findBestMove(this.state, {
      level: this.difficulty,
      forColor: aiColor,
    });
  }

  /**
   * Apply an AI move that was computed earlier.
   * @param {import("./engine/Move.js").Move} move
   */
  applyAIMove(move) {
    if (!move) return;
    this.state.applyMove(move);
    this.notify();
  }

  /**
   * Internal: recompute status strings and invoke callback.
   */
  notify() {
    this.state.updateStatusText();
    this.onUpdate(this.state.getSnapshot());
  }
}

