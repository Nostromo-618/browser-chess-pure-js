/**
 * Move.js
 *
 * Defines the Move structure and helper constructors.
 *
 * A Move is a plain object with:
 * - from: string (e.g. "e2")
 * - to: string (e.g. "e4")
 * - piece: string (e.g. "wP")
 * - captured?: string | null
 * - promotion?: "Q"|"R"|"B"|"N"
 * - isEnPassant?: boolean
 * - isCastleKingSide?: boolean
 * - isCastleQueenSide?: boolean
 *
 * This model is intentionally verbose for readability and explicitness.
 */

/**
 * @typedef {Object} Move
 * @property {string} from
 * @property {string} to
 * @property {string} piece
 * @property {string|null|undefined} [captured]
 * @property {"Q"|"R"|"B"|"N"|undefined} [promotion]
 * @property {boolean|undefined} [isEnPassant]
 * @property {boolean|undefined} [isCastleKingSide]
 * @property {boolean|undefined} [isCastleQueenSide]
 */

/**
 * Create a basic move.
 * @param {string} from
 * @param {string} to
 * @param {string} piece
 * @param {string|null} [captured]
 * @returns {Move}
 */
export function createMove(from, to, piece, captured = null) {
  return { from, to, piece, captured: captured || null };
}

/**
 * Create a promotion move.
 * @param {string} from
 * @param {string} to
 * @param {string} piece
 * @param {"Q"|"R"|"B"|"N"} promotion
 * @param {string|null} [captured]
 * @returns {Move}
 */
export function createPromotionMove(from, to, piece, promotion, captured = null) {
  return {
    from,
    to,
    piece,
    captured: captured || null,
    promotion,
  };
}

/**
 * Create an en passant capture move.
 * @param {string} from
 * @param {string} to
 * @param {string} piece
 * @param {string} captured
 * @returns {Move}
 */
export function createEnPassantMove(from, to, piece, captured) {
  return {
    from,
    to,
    piece,
    captured,
    isEnPassant: true,
  };
}

/**
 * Create a castling move.
 * Note: rook movement is handled by GameState when applying.
 *
 * @param {string} from
 * @param {string} to
 * @param {string} piece
 * @param {boolean} kingSide
 * @returns {Move}
 */
export function createCastleMove(from, to, piece, kingSide) {
  return {
    from,
    to,
    piece,
    isCastleKingSide: !!kingSide,
    isCastleQueenSide: !kingSide,
  };
}

