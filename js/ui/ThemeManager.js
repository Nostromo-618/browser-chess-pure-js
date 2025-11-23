/**
 * ThemeManager.js
 * Handles system / light / dark theme selection with persistence.
 */

export class ThemeManager {
  /**
   * @param {Object} options
   * @param {HTMLSelectElement} options.selectEl
   * @param {string} options.storageKey
   */
  constructor({ selectEl, storageKey }) {
    this.selectEl = selectEl;
    this.storageKey = storageKey;
    this.currentMode = "system";

    this.handleSelectChange = this.handleSelectChange.bind(this);
  }

  init() {
    const stored = window.localStorage.getItem(this.storageKey);
    if (stored === "light" || stored === "dark" || stored === "system") {
      this.currentMode = stored;
    } else {
      this.currentMode = "system";
    }

    this.applyThemeMode(this.currentMode);
    if (this.selectEl) {
      this.selectEl.value = this.currentMode;
      this.selectEl.addEventListener("change", this.handleSelectChange);
    }

    // React to system theme changes when in "system" mode
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", () => {
      if (this.currentMode === "system") {
        this.applyThemeMode("system");
      }
    });
  }

  handleSelectChange(event) {
    const value = event.target.value;
    if (!["system", "light", "dark"].includes(value)) return;

    this.currentMode = value;
    window.localStorage.setItem(this.storageKey, value);
    this.applyThemeMode(value);
  }

  /**
   * Apply theme mode by toggling root classes and using system when needed.
   * @param {"system"|"light"|"dark"} mode
   */
  applyThemeMode(mode) {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");

    if (mode === "light") {
      root.classList.add("theme-light");
    } else if (mode === "dark") {
      root.classList.add("theme-dark");
    } else {
      // System: no explicit theme class, rely on prefers-color-scheme + :root
      // Optionally, normalize by reflowing computed styles.
    }
  }
}

