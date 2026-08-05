import type { EvalResult } from './types';

const DEFAULT_MAX_ENTRIES = 300;

/**
 * Reduces a FEN to the four fields that identify the position: piece placement,
 * side to move, castling rights, and the en-passant square. The halfmove clock
 * and fullmove number are deliberately dropped — they record how the position
 * was reached, not what it is, so keeping them makes a genuine transposition
 * miss. 1.Nf3 d5 2.d4 Nf6 3.c4 and 1.d4 d5 2.c4 Nf6 3.Nf3 reach the same board
 * with clocks of 0 and 2 respectively; that is the Queen's Gambit, which an
 * openings trainer hits constantly.
 *
 * The known cost: two positions that differ only in progress toward the
 * fifty-move rule now share an entry. Irrelevant at opening depths, and the
 * cache already ignores repetition history (a FEN never carried it).
 */
function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/**
 * Caches engine results by position so a position reached through two different
 * move orders is analysed once. The game tree deliberately keeps both nodes —
 * only the analysis is shared. See the vault's `Decisions/Transposition
 * Identity`.
 *
 * A `Map` preserves insertion order, which is what makes LRU eviction cheap:
 * re-inserting on read moves an entry to the end.
 */
export class EvalCache {
  private readonly entries = new Map<string, EvalResult>();

  constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {}

  get(fen: string): EvalResult | undefined {
    const key = positionKey(fen);
    const found = this.entries.get(key);
    if (!found) return undefined;
    this.entries.delete(key);
    this.entries.set(key, found);
    return found;
  }

  set(fen: string, result: EvalResult): void {
    const key = positionKey(fen);
    const existing = this.entries.get(key);
    // Streaming updates arrive shallow-first; never regress a deeper result.
    // An equal-depth write is not a regression and does overwrite: it is the
    // more recent answer for the same position. A rejected shallower write
    // deliberately leaves the key's LRU position untouched — it wasn't a real
    // read or a real update.
    if (existing && existing.depth > result.depth) return;

    this.entries.delete(key);
    this.entries.set(key, result);

    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}

/** The instance the app uses. One cache per page, like the shared Engine. */
export const sharedEvalCache = new EvalCache();
