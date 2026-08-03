import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const PURE_DIRS = ['src/chess', 'src/engine', 'src/tree'];
const FORBIDDEN_PACKAGES = ['react', 'react-dom', 'zustand'];

// Matches every form a forbidden package could be pulled in by: a static
// `from '<pkg>'` (with or without a subpath, e.g. 'react/jsx-runtime'), a
// bare side-effect `import '<pkg>'`, `require('<pkg>')`, and a dynamic
// `import('<pkg>')`. None of FORBIDDEN_PACKAGES contain regex-special
// characters, so they're safe to interpolate directly.
function packagePatterns(pkg: string): RegExp[] {
  const subpath = `(/[^'"]*)?`;
  return [
    new RegExp(`from ['"]${pkg}${subpath}['"]`),
    new RegExp(`import ['"]${pkg}${subpath}['"]`),
    new RegExp(`require\\(['"]${pkg}${subpath}['"]\\)`),
    new RegExp(`import\\(['"]${pkg}${subpath}['"]\\)`),
  ];
}

const FORBIDDEN = FORBIDDEN_PACKAGES.flatMap(packagePatterns);

// The Zustand binding layer over the pure game tree. This one file is allowed
// to import zustand; everything else under PURE_DIRS must stay framework-free.
// Built with `join` (not a literal) so it matches regardless of the path
// separator `tsFilesIn`'s walk produces on the current platform.
const STORE_EXEMPTION = join('src', 'tree', 'store.ts');

function isScannableSourceFile(path: string): boolean {
  const isSource = path.endsWith('.ts') || path.endsWith('.tsx');
  const isTest = path.endsWith('.test.ts') || path.endsWith('.test.tsx');
  return isSource && !isTest && path !== STORE_EXEMPTION;
}

function tsFilesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsFilesIn(full);
    return isScannableSourceFile(full) ? [full] : [];
  });
}

function findOffenders(dirs: string[]): { offenders: string[]; scanned: number } {
  const offenders: string[] = [];
  let scanned = 0;
  for (const dir of dirs) {
    const files = tsFilesIn(dir);
    scanned += files.length;
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      if (FORBIDDEN.some((pattern) => pattern.test(source))) offenders.push(file);
    }
  }
  return { offenders, scanned };
}

describe('core module purity', () => {
  it('keeps chess/, engine/ and tree/ free of React and store imports', () => {
    const { offenders, scanned } = findOffenders(PURE_DIRS);
    // A guarded directory that was renamed or moved would otherwise return
    // an empty file list and pass having scanned nothing at all.
    expect(scanned).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it('fails loudly rather than silently passing when a guarded directory does not exist', () => {
    const { scanned, offenders } = findOffenders(['src/this-directory-does-not-exist']);
    expect(offenders).toEqual([]);
    expect(scanned).toBe(0);
  });
});

describe('purity guard scanning rules (regression fixtures)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'purity-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('scans .tsx files, not just .ts', () => {
    writeFileSync(join(dir, 'Component.tsx'), `import { useState } from 'react';\n`);
    const { offenders, scanned } = findOffenders([dir]);
    expect(scanned).toBe(1);
    expect(offenders).toEqual([join(dir, 'Component.tsx')]);
  });

  it('excludes .test.tsx files from scanning, matching the existing .test.ts exclusion', () => {
    writeFileSync(join(dir, 'Component.test.tsx'), `import { useState } from 'react';\n`);
    const { scanned, offenders } = findOffenders([dir]);
    expect(scanned).toBe(0);
    expect(offenders).toEqual([]);
  });

  const forbiddenImportForms: Array<[string, string]> = [
    ["require('react')", `const react = require('react');\n`],
    ["dynamic import('react')", `async function f() { await import('react'); }\n`],
    ["bare import 'react'", `import 'react';\n`],
    ["from 'react/jsx-runtime'", `import { jsx } from 'react/jsx-runtime';\n`],
    ["from 'react-dom'", `import ReactDOM from 'react-dom';\n`],
    ["from 'react-dom/client'", `import { createRoot } from 'react-dom/client';\n`],
    ["from 'zustand'", `import { create } from 'zustand';\n`],
  ];

  it.each(forbiddenImportForms)('detects %s', (_label, source) => {
    writeFileSync(join(dir, 'offender.ts'), source);
    const { offenders } = findOffenders([dir]);
    expect(offenders).toEqual([join(dir, 'offender.ts')]);
  });

  it('does not flag an unrelated package whose name merely starts with a guarded one', () => {
    writeFileSync(join(dir, 'fine.ts'), `import Chessboard from 'react-chessboard';\n`);
    const { offenders } = findOffenders([dir]);
    expect(offenders).toEqual([]);
  });
});
