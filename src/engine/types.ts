export interface UciTransport {
  send(cmd: string): void;
  onLine(cb: (line: string) => void): () => void;
  terminate(): void;
}

export interface PvLine {
  /** The first move of the line, in SAN. */
  san: string;
  /** Score in centipawns from the side-to-move's perspective. Null if mate. */
  cp: number | null;
  /** Moves to mate, signed. Null if not a mate line. */
  mate: number | null;
  /** The principal variation in SAN, first move included. */
  pv: string[];
}

export interface EvalResult {
  depth: number;
  lines: PvLine[];
}

export interface AnalyzeRequest {
  fen: string;
  depth: number;
  multiPV: number;
  /** Called with each deeper result as the search streams. */
  onUpdate?: (result: EvalResult) => void;
  signal?: AbortSignal;
}

export interface RawInfo {
  depth: number;
  multipv: number;
  cp: number | null;
  mate: number | null;
  /** Principal variation in UCI long algebraic form, e.g. ['e2e4', 'e7e5']. */
  pv: string[];
}
