import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PURE_DIRS = ['src/chess', 'src/engine', 'src/tree'];
const FORBIDDEN = [/from ['"]react['"]/, /from ['"]react-dom/, /from ['"]zustand/];

function tsFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFilesIn(full);
    return full.endsWith('.ts') && !full.endsWith('.test.ts') && !full.endsWith('store.ts')
      ? [full]
      : [];
  });
}

describe('core module purity', () => {
  it('keeps chess/, engine/ and tree/ free of React and store imports', () => {
    const offenders: string[] = [];
    for (const dir of PURE_DIRS) {
      for (const file of tsFilesIn(dir)) {
        const source = readFileSync(file, 'utf8');
        if (FORBIDDEN.some((pattern) => pattern.test(source))) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
