import type { RawInfo } from './types';

/**
 * Parses a UCI `info` line into structured data.
 * Returns null for any line that does not carry a principal variation —
 * `bestmove`, `readyok`, `currmove`-only progress lines, and so on.
 */
export function parseInfoLine(line: string): RawInfo | null {
  if (!line.startsWith('info ')) return null;

  const tokens = line.split(/\s+/);
  const pvIndex = tokens.indexOf('pv');
  if (pvIndex === -1 || pvIndex === tokens.length - 1) return null;

  const readNumberAfter = (key: string): number | null => {
    const index = tokens.indexOf(key);
    if (index === -1 || index + 1 >= tokens.length) return null;
    const value = Number(tokens[index + 1]);
    return Number.isFinite(value) ? value : null;
  };

  const depth = readNumberAfter('depth');
  if (depth === null) return null;

  const scoreIndex = tokens.indexOf('score');
  let cp: number | null = null;
  let mate: number | null = null;
  if (scoreIndex !== -1) {
    const kind = tokens[scoreIndex + 1];
    const value = Number(tokens[scoreIndex + 2]);
    if (kind === 'cp' && Number.isFinite(value)) cp = value;
    if (kind === 'mate' && Number.isFinite(value)) mate = value;
  }

  return {
    depth,
    multipv: readNumberAfter('multipv') ?? 1,
    cp,
    mate,
    pv: tokens.slice(pvIndex + 1).filter((token) => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(token)),
  };
}
