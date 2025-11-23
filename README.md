# Browser Chess - Pure JavaScript

A pure client-side chess game implementation that runs entirely in the browser. All computation happens on the client side, making it perfect for static hosting on GitHub Pages.

## Features

- **Full rules-compliant chess engine**: All standard chess rules including castling, en passant, pawn promotion, and draw detection
- **5 difficulty levels**: From beginner-friendly to challenging
- **Modern UI**: Responsive design with system/light/dark theme support
- **Zero dependencies**: Pure JavaScript, no frameworks or external libraries
- **Static hosting ready**: Works perfectly on GitHub Pages or any static file server

## Architecture

This is a client-side only version of the chess engine. All computation happens in the user's browser:

- **Engine**: Pure JavaScript chess engine in `js/engine/`
- **UI Components**: Modular UI components in `js/ui/`
- **Game Logic**: Game orchestration in `js/Game.js`
- **Main Entry**: Application initialization in `js/main.js`

The AI uses async computation with timeouts to prevent UI freezing, using progressive deepening and yielding control back to the browser between iterations.

## Getting Started

### Local Development

1. Clone or download this repository
2. Serve the files using any static file server:

   **Using Python:**
   ```bash
   python3 -m http.server 8000
   ```

   **Using Node.js (http-server):**
   ```bash
   npx http-server
   ```

   **Using PHP:**
   ```bash
   php -S localhost:8000
   ```

3. Open `http://localhost:8000` in your browser

## Browser Compatibility

This application uses ES modules and requires a modern browser that supports:
- ES6 modules (`import`/`export`)
- `async`/`await`
- `Promise`
- `Map` and `Set`

Compatible with:
- Chrome/Edge 61+
- Firefox 60+
- Safari 11+

## Project Structure

```
browser-chess-pure-js/
├── index.html          # Main HTML file
├── js/
│   ├── engine/         # Chess engine modules
│   │   ├── Board.js    # Board representation utilities
│   │   ├── Rules.js    # Move generation and legality
│   │   ├── GameState.js # Game state management
│   │   ├── Move.js     # Move structure
│   │   ├── Evaluator.js # Position evaluation
│   │   └── AI.js       # AI search implementation
│   ├── ui/             # UI components
│   │   ├── BoardView.js
│   │   ├── Controls.js
│   │   ├── GameEndModal.js
│   │   └── ThemeManager.js
│   ├── Game.js         # Game orchestration
│   └── main.js         # Application entry point
└── styles/
    ├── theme.css       # Theme variables
    └── layout.css      # Layout and component styles
```

## How It Works

1. **Game Initialization**: When you click "New Game", a new `Game` instance is created with your selected color and difficulty
2. **Move Handling**: Click a piece to select it, then click a destination square to move
3. **AI Computation**: When it's the computer's turn, the AI searches for the best move using minimax with alpha-beta pruning
4. **Progressive Deepening**: Higher difficulty levels use progressive deepening to respect time limits and prevent UI freezing
5. **Game End Detection**: The engine automatically detects checkmate, stalemate, and draws (50-move rule, threefold repetition, insufficient material)

## Difficulty Levels

- **Level 1**: Very Easy - Depth 1, high randomness
- **Level 2**: Easy - Depth 2
- **Level 3**: Medium - Depth 3
- **Level 4**: Hard - Depth 3 with quiescence search
- **Level 5**: Very Hard - Depth 4 with quiescence (may take several seconds in complex positions)

## Notes

- All computation happens in the browser - no server required
- Higher difficulty levels may cause brief UI pauses during AI thinking
- The "Thinking Time" setting controls the maximum time the AI can spend on a move
- Theme preference is saved in browser localStorage
- Works offline once loaded (no external dependencies)

## License

MIT License - see LICENSE file for details
