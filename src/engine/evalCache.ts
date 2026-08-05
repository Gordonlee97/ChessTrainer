import type { EvalResult } from './types';

const DEFAULT_MAX_ENTRIES = 300;

/**
 * Caches engine results by FEN so a position reached through two different move
 * orders is analysed once. The game tree deliberately keeps both nodes — only
 * the analysis is shared. See the vault's `Decisions/Transposition Identity`.
 *
 * A `Map` preserves insertion order, which is what makes LRU eviction cheap:
 * re-inserting on read moves an entry to the end.
 */
export class EvalCache {
  private readonly entries = new Map<string, EvalResult>();

  constructor(private readonly maxEntries: number = DEFAULT_MAX_ENTRIES) {}

  get(fen: string): EvalResult | undefined {
    const found = this.entries.get(fen);
    if (!found) return undefined;
    this.entries.delete(fen);
    this.entries.set(fen, found);
    return found;
  }

  set(fen: string, result: EvalResult): void {
    const existing = this.entries.get(fen);
    // Streaming updates arrive shallow-first; never regress a deeper result.
    if (existing && existing.depth > result.depth) return;

    this.entries.delete(fen);
    this.entries.set(fen, result);

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
