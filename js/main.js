import { ThemeManager } from "./ui/ThemeManager.js";
import { BoardView } from "./ui/BoardView.js";
import { Controls } from "./ui/Controls.js";
import { GameEndModal } from "./ui/GameEndModal.js";
import { Game } from "./Game.js";

/**
 * Main entry point for client-side chess application
 * 
 * This version runs entirely in the browser with no server dependencies.
 * All chess engine computation happens client-side.
 */

const dom = {
  boardContainer: document.getElementById("board-container"),
  themeSelect: document.getElementById("theme-select"),
  colorChoice: document.getElementById("color-choice"),
  difficultySelect: document.getElementById("difficulty-select"),
  newGameBtn: document.getElementById("new-game-btn"),
  statusText: document.getElementById("status-text"),
  turnIndicator: document.getElementById("turn-indicator"),
  lastMoveIndicator: document.getElementById("last-move-indicator"),
  moveHistory: document.getElementById("move-history"),
  gameEndModalContainer: document.getElementById("game-end-modal-container"),
};

// Initialize theme system
const themeManager = new ThemeManager({
  selectEl: dom.themeSelect,
  storageKey: "kilo-polaris-chess-theme",
});

// Initialize board view
const boardView = new BoardView(dom.boardContainer, {
  onSquareSelected: handleSquareSelected,
});

// Initialize controls
const controls = new Controls({
  colorChoiceContainer: dom.colorChoice,
  difficultySelect: dom.difficultySelect,
  newGameButton: dom.newGameBtn,
  onNewGameRequested: handleNewGameRequested,
});

// Initialize game end modal
const gameEndModal = new GameEndModal(dom.gameEndModalContainer, handleNewGameRequested);

// Game state
let game = null;
let isProcessingMove = false;

/**
 * Initialize new game with current control settings
 */
async function initializeGame() {
  // Hide modal if visible
  gameEndModal.hide();
  // Reset game over tracking
  previousGameOver = false;

  const playerColor = controls.getSelectedColor();
  const difficulty = controls.getDifficulty();

  try {
    game = new Game({
      playerColor,
      difficulty,
      onUpdate: syncUIWithGame,
    });

    const snapshot = game.getSnapshot();

    boardView.render(game.getBoard(), {
      perspective: game.getPlayerColor(),
      lastMove: snapshot.lastMove,
      legalMoves: [],
      selected: null,
    });

    syncUIWithGame(snapshot);

    // If AI should move first
    if (game.getCurrentTurn() !== game.getPlayerColor() && !game.isGameOver()) {
      requestAnimationFrame(() => {
        if (!game || game.isGameOver()) return;
        if (game.getCurrentTurn() !== game.getPlayerColor()) {
          triggerAIMove();
        }
      });
    }
  } catch (error) {
    console.error('Game initialization error:', error);
    dom.statusText.textContent = "Failed to initialize game. Please refresh and try again.";
  }
}

/**
 * Handle new game request
 */
async function handleNewGameRequested() {
  if (isProcessingMove) return;
  await initializeGame();
}

/**
 * Handle board square selection
 */
async function handleSquareSelected(square) {
  if (isProcessingMove) return;
  if (!game || isProcessingMove) return;
  if (game.getCurrentTurn() !== game.getPlayerColor()) return;
  if (game.isGameOver()) return;

  const result = game.handlePlayerSquareSelection(square);

  // Only selection changed (no move yet)
  if (!result.changed) {
    boardView.updateHighlights({
      selected: result.selected,
      legalMoves: result.legalTargets,
      lastMove: result.lastMove,
    });
    return;
  }

  // Move executed
  const snapshot = game.getSnapshot();
  syncUIWithGame(snapshot);

  boardView.render(game.getBoard(), {
    perspective: game.getPlayerColor(),
    selected: null,
    legalMoves: [],
    lastMove: snapshot.lastMove,
  });

  if (!game.isGameOver()) {
    requestAnimationFrame(() => {
      if (!game || game.isGameOver()) return;
      if (game.getCurrentTurn() !== game.getPlayerColor()) {
        triggerAIMove();
      }
    });
  }
}

/**
 * Trigger AI move
 */
async function triggerAIMove() {
  if (!game || game.isGameOver()) return;
  if (game.getCurrentTurn() === game.getPlayerColor()) return;

  isProcessingMove = true;
  syncBusyState(true);

  try {
    const aiMove = await game.computeAIMove();
    if (!aiMove) {
      syncUIWithGame(game.getSnapshot());
      return;
    }

    game.applyAIMove(aiMove);
    const snapshot = game.getSnapshot();
    syncUIWithGame(snapshot);

    boardView.render(game.getBoard(), {
      perspective: game.getPlayerColor(),
      selected: null,
      legalMoves: [],
      lastMove: snapshot.lastMove,
    });
  } catch (error) {
    console.error("AI move error:", error);
    dom.statusText.textContent = "An error occurred while computing AI move.";
  } finally {
    isProcessingMove = false;
    syncBusyState(false);
  }
}

// Track previous game over state to detect transitions
let previousGameOver = false;

/**
 * Synchronize UI with game snapshot
 */
function syncUIWithGame(snapshot) {
  if (!snapshot) return;

  dom.statusText.textContent = snapshot.statusText || '';
  dom.turnIndicator.textContent = snapshot.turnText || '';
  dom.lastMoveIndicator.textContent = snapshot.lastMoveText || '';

  // Move history
  dom.moveHistory.innerHTML = "";
  (snapshot.history || []).forEach((entry, index) => {
    const li = document.createElement("li");
    li.textContent = entry;
    li.dataset.index = String(index);
    dom.moveHistory.appendChild(li);
  });

  // Check for game end transition
  const isGameOver = snapshot.gameOver || false;
  if (isGameOver && !previousGameOver && snapshot.result) {
    // Game just ended - show modal
    const playerColor = snapshot.playerColor;
    gameEndModal.show(snapshot.result, playerColor);
  }
  previousGameOver = isGameOver;
}

/**
 * Visual busy state for when AI is thinking
 */
function syncBusyState(isBusy) {
  if (isBusy) {
    dom.statusText.classList.add("busy");
    dom.statusText.textContent = "Computer is thinking...";
  } else {
    dom.statusText.classList.remove("busy");
    // Restore status text from current game state if available
    if (game) {
      syncUIWithGame(game.getSnapshot());
    }
  }
}

// Initialize the application
async function main() {
  // Initialize theme
  themeManager.init();

  // Start the game
  dom.statusText.textContent = "Ready. Select settings and click 'New Game' to start.";
}

// Start the application
main().catch(error => {
  console.error('Application initialization failed:', error);
  dom.statusText.textContent = "Failed to initialize application. Please refresh and try again.";
});

