/**
 * Controls.js
 *
 * Handles:
 * - Color selection (white / black / random)
 * - Difficulty selection (1-5)
 * - New game button
 *
 * Provides getters for current settings and notifies when a new game is requested.
 */

export class Controls {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.colorChoiceContainer
   * @param {HTMLSelectElement} options.difficultySelect
   * @param {HTMLButtonElement} options.newGameButton
   * @param {() => void} options.onNewGameRequested
   */
  constructor({
    colorChoiceContainer,
    difficultySelect,
    newGameButton,
    onNewGameRequested,
  }) {
    this.colorChoiceContainer = colorChoiceContainer;
    this.difficultySelect = difficultySelect;
    this.newGameButton = newGameButton;
    this.onNewGameRequested = onNewGameRequested || (() => { });

    this.selectedColor = "white"; // "white" | "black" | "random"

    this.handleColorClick = this.handleColorClick.bind(this);
    this.handleNewGameClick = this.handleNewGameClick.bind(this);

    this.init();
  }

  init() {
    if (this.colorChoiceContainer) {
      this.colorChoiceContainer.addEventListener(
        "click",
        this.handleColorClick
      );
      // Ensure one button is marked active initially
      const active = this.colorChoiceContainer.querySelector(
        'button[data-color="white"]'
      );
      if (active) {
        active.classList.add("active");
      }
    }

    if (this.newGameButton) {
      this.newGameButton.addEventListener("click", this.handleNewGameClick);
    }
  }

  /**
   * Handle clicks on color selection buttons.
   */
  handleColorClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;

    const color = target.getAttribute("data-color");
    if (!color || !["white", "black", "random"].includes(color)) return;

    this.selectedColor = color;

    // Update active styles
    const buttons = this.colorChoiceContainer.querySelectorAll("button");
    buttons.forEach((btn) => btn.classList.remove("active"));
    target.classList.add("active");
  }

  /**
   * Handle "New Game" button click.
   */
  handleNewGameClick() {
    this.onNewGameRequested();
  }

  /**
   * Get selected player color; resolves "random" to actual side at Game creation.
   * @returns {"white"|"black"|"random"}
   */
  getSelectedColor() {
    return this.selectedColor || "random";
  }

  /**
   * Get selected difficulty level.
   * @returns {number} 1-5
   */
  getDifficulty() {
    if (!this.difficultySelect) return 3;
    const val = Number(this.difficultySelect.value || 3);
    if (Number.isNaN(val) || val < 1 || val > 5) return 3;
    return val;
  }

  /**
   * Get configured thinking time in milliseconds.
   * @returns {number}
   */
  getThinkingTime() {
    const input = document.getElementById("thinking-time");
    if (!input) return 10000;
    const val = Number(input.value || 10);
    // Clamp between 1s and 60s
    return Math.max(1000, Math.min(60000, val * 1000));
  }
}

