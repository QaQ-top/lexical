/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * Bundle all the types transitively referenced by `src/index.ts` into
 * a single self-contained `lib/index.d.ts`.
 *
 * Why: The previous lib/index.d.ts re-exported from @lexical/*,
 * onchain-lexical-*, etc. so consumers of `onchain-rich-text-editor`
 * had to have those packages (and their .d.ts) resolvable just to
 * type-check their project. With the bundled file emitted here, the
 * published npm tarball carries all the types it needs.
 *
 * Why this script exists instead of using dts-bundle-generator:
 *   - This monorepo's source files reference ambient globals declared
 *     in `global.d.ts` and `libdefs/globals.d.ts` (`__DEV__`,
 *     `BaseComponentProps`, `VITE_IS_DEVELOPMENT`, `*.module.less`,
 *     etc.). TS only picks these up when the corresponding .d.ts
 *     files are part of the program; we add them explicitly to
 *     rootNames so the program recognises them.
 *   - dts-bundle-generator builds its program from the entry file
 *     alone, which leaves those ambient files out and fails the
 *     pre-emit diagnostics check.
 *
 * What it does:
 *   1. Builds a TS Program with `src/index.ts` as the entry plus the
 *      ambient-declaration files.
 *   2. Calls `program.emit(...)` to generate `.d.ts` content for every
 *      source file in the program.
 *   3. Walks the symbol graph from the entry to figure out which
 *      transitively used source files belong to packages whose types
 *      should be inlined into the bundle.
 *   4. Concatenates those generated `.d.ts` contents into one .d.ts,
 *      with imports from `@lexical/*` etc. rewritten to local
 *      relative paths so the final file is self-contained.
 *   5. Emits the entry file's declarations last so they sit on top of
 *      the inlined declarations they re-export.
 */

import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as ts from 'typescript';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  rewriteDefaultReexports,
  rewriteEntryReexports,
  stripLocalExportKeywords,
} = require('./rewriteDefaultReexports.cjs');

const PKG_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PKG_ROOT, '..', '..');
const ENTRY = path.join(PKG_ROOT, 'src', 'index.ts');
const OUTPUT = path.join(PKG_ROOT, 'lib', 'index.d.ts');
const TSCONFIG = path.join(REPO_ROOT, 'tsconfig.json');

/** Packages whose declarations should be inlined into the bundle. */
const INLINE_PACKAGES = new Set([
  '@lexical/react',
  '@lexical/file',
  '@lexical/history',
  '@lexical/html',
  '@lexical/mark',
  '@lexical/selection',
  '@lexical/table',
  '@lexical/text',
  '@lexical/utils',
  '@lexical/clipboard',
  '@lexical/code',
  '@lexical/hashtag',
  '@lexical/link',
  '@lexical/list',
  '@lexical/overflow',
  '@lexical/plain-text',
  '@lexical/rich-text',
  '@lexical/yjs',
  'lexical',
  'onchain-lexical-context',
  'onchain-lexical-instance',
  'onchain-lexical-markdown',
  'onchain-lexical-ui',
  'onchain-utility',
  'onchain-rich-text-editor',
]);

/**
 * Map a `packages/<dir>/` segment to its public package name. Needed
 * for directories whose directory name doesn't follow the
 * `@lexical/<dir>` convention — `lexical-instance/` is published as
 * `onchain-lexical-instance`, `lexical-onchain-markdown/` as
 * `onchain-lexical-markdown`, and `lexical-playground/` (the entry
 * package itself) as `onchain-rich-text-editor`. Without this,
 * `ownerPackageOf` returns `@lexical/instance` for
 * `packages/lexical-instance/...`, which never matches anything in
 * `INLINE_PACKAGES`, so those files silently fail to inline.
 */
const PACKAGE_DIR_TO_NAME = {
  'lexical-instance': 'onchain-lexical-instance',
  'lexical-onchain-markdown': 'onchain-lexical-markdown',
  'lexical-playground': 'onchain-rich-text-editor',
};

/** Read the root tsconfig.json with comments stripped out. */
function loadTsConfig(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  // Strip block + line comments so JSON.parse doesn't choke
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const parsed = JSON.parse(stripped);
  return {...parsed.compilerOptions};
}

/**
 * Resolve a module specifier as seen from `fromFile`, walking through
 * tsconfig path mappings and source extensions.
 */
function resolveModule(fromFile, spec, program) {
  const host = ts.createCompilerHost(program.getCompilerOptions());
  const cache = ts.createModuleResolutionCache(
    host.getCurrentDirectory(),
    host.getCanonicalFileName,
    program.getCompilerOptions(),
  );
  const r = ts.resolveModuleName(
    spec,
    fromFile,
    program.getCompilerOptions(),
    host,
    cache,
  );
  return r.resolvedModule ? r.resolvedModule.resolvedFileName : null;
}

/** Map a file path to its owning package name (e.g. '@lexical/react'). */
function ownerPackageOf(fileName) {
  const norm = fileName.replace(/\\/g, '/');
  const after = norm.split('/packages/');
  if (after.length === 2) {
    const rest = after[1];
    const seg = rest.split('/')[0];
    if (PACKAGE_DIR_TO_NAME[seg]) {return PACKAGE_DIR_TO_NAME[seg];}
    if (seg.startsWith('onchain-')) {return seg;}
    // The core `lexical` package lives at `packages/lexical/` but is
    // imported as the bare specifier `lexical` (not `@lexical/lexical`).
    // Keep that name aligned with `INLINE_PACKAGES` so its sources —
    // LexicalNode.ts, nodes/LexicalElementNode.ts, … — are recognised
    // and inlined; otherwise the bundle ships dangling references to
    // `ElementNode`, `LexicalNode`, `Klass`, etc.
    if (seg === 'lexical') {return 'lexical';}
    return '@lexical/' + seg.replace(/^lexical-/, '');
  }
  // Fallback for files resolved via pnpm's virtual node_modules path
  // (`node_modules/.pnpm/<name>@<ver>_<hash>/node_modules/<name>/...`).
  // TS sometimes returns this path for relative imports of pre-built
  // packages, even though the actual source lives under `packages/`.
  // Walk upward to the nearest `package.json` and use its `name`.
  const m = norm.match(
    /\/node_modules\/\.pnpm\/[^/]+\/node_modules\/([^/]+)\/(?:.*\/)?/,
  );
  if (m) {
    const candidate = m[1];
    if (INLINE_PACKAGES.has(candidate)) {return candidate;}
  }
  // Walk up looking for a `package.json` whose `name` is in INLINE_PACKAGES.
  let dir = path.dirname(norm);
  while (dir !== path.dirname(dir)) {
    const pkgJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const n = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).name;
        if (typeof n === 'string' && INLINE_PACKAGES.has(n)) {return n;}
      } catch { /* malformed pkg.json, keep walking up */ }
      // Stop at the first package.json — going above it would leave
      // this package's tree, and the parent `package.json` describes
      // a different package.
      return null;
    }
    dir = path.dirname(dir);
  }
  return null;
}

/** True if the source file is owned by one of the inlined packages. */
function isInlinedPackageFile(fileName) {
  const owner = ownerPackageOf(fileName);
  return owner !== null && INLINE_PACKAGES.has(owner);
}

/**
 * Collects the set of source files whose declarations will be inlined.
 * Starts from `entry`, follows `import` and re-exports, and gathers any
 * imported file that belongs to an inlined package.
 */
function collectInlinedFiles(program, entry) {
  const visited = new Set();
  const queue = [entry];
  const inlinedSources = new Set();
  while (queue.length) {
    const fileName = queue.shift();
    if (visited.has(fileName)) {continue;}
    visited.add(fileName);
    const sf = program.getSourceFile(fileName);
    if (!sf) {continue;}
    if (isInlinedPackageFile(fileName)) {
      inlinedSources.add(fileName);
    }
    for (const stmt of sf.statements) {
      if (
        ts.isImportDeclaration(stmt) ||
        (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier)
      ) {
        const spec = stmt.moduleSpecifier.text;
        const target = resolveModule(fileName, spec, program);
        if (target) {queue.push(target);}
      }
    }
  }
  return inlinedSources;
}

/**
 * Ambient `.d.ts` files declare types other files reference but
 * never `import` themselves, so `collectInlinedFiles` (which only
 * follows import edges) misses them. TS auto-loads sibling ambient
 * files into the program — they're in `program.getSourceFile()` —
 * but `program.emit()` still skips them unless they're in
 * `rootNames`. This returns the set of ambient files we want
 * inlined alongside the regular inlined sources: workspace-root
 * `*.d.ts`, plus `<inlined-pkg>/src/*.d.ts` siblings.
 *
 * Restricting to `isAmbientOwned` keeps us from sweeping in
 * every ambient file TS auto-loaded (e.g. `react/index.d.ts`),
 * which would shadow `@types/react` from the consumer.
 */
function collectAmbientInlinedFiles(inlinedFiles) {
  const out = new Set();
  // (a) workspace root *.d.ts — e.g. global.d.ts
  for (const f of fs.readdirSync(REPO_ROOT, {withFileTypes: true})) {
    if (f.isFile() && /\.d\.ts$/.test(f.name)) {
      out.add(path.join(REPO_ROOT, f.name));
    }
  }
  // (b) sibling *.d.ts next to every inlined *.ts / *.tsx source
  // (c) any *.d.ts directly under an inlined package's src/ dir
  //     — picks up ambient globals like `onchain-utility/src/global.d.ts`
  //     that don't have a sibling `.ts` to walk from. We also walk
  //     for inlined `*.d.ts` files (e.g. `dist/Tree/index.d.ts`)
  //     so the ambient sibling of the `src/` they belong to is
  //     picked up.
  const seenSrcDirs = new Set();
  for (const f of inlinedFiles) {
    if (/\.(ts|tsx)$/.test(f)) {
      const dts = f.replace(/\.(ts|tsx)$/, '.d.ts');
      if (fs.existsSync(dts) && isAmbientOwned(dts)) {
        out.add(dts);
      }
    }
    // Discover the source dir once per package — `onchain-utility/src/`
    // covers every ambient file the package owns. This works for
    // both `.ts`/`.tsx` inlined sources and `.d.ts` inlined sources
    // (e.g. `dist/Tree/index.d.ts` walks up to `onchain-utility/src/`).
    const srcDir = discoverInlinedSrcDir(f);
    if (srcDir && !seenSrcDirs.has(srcDir)) {
      seenSrcDirs.add(srcDir);
      if (fs.existsSync(srcDir)) {
        for (const entry of fs.readdirSync(srcDir, {withFileTypes: true})) {
          if (entry.isFile() && /\.d\.ts$/.test(entry.name)) {
            const candidate = path.join(srcDir, entry.name);
            if (isAmbientOwned(candidate)) {
              out.add(candidate);
            }
          }
        }
      }
    }
  }
  return out;
}

/**
 * Return the package's `src/` dir for an inlined source file —
 * either the workspace path (`packages/<dir>/src`) or the pnpm
 * shadow path (`node_modules/.pnpm/<name>@<ver>_<hash>/node_modules/<name>/src`).
 * For paths that end in `/dist/...`, fall back to the sibling `src/`.
 */
function discoverInlinedSrcDir(fileName) {
  const norm = fileName.replace(/\\/g, '/');
  let m = norm.match(/^.*\/packages\/[^/]+\/src(?=\/|$)/);
  if (m) {return m[0];}
  m = norm.match(/^.*\/packages\/[^/]+\/dist(?=\/|$)/);
  if (m) {return m[0].replace(/\/dist$/, '/src');}
  m = norm.match(/^.*\/node_modules\/\.pnpm\/[^/]+\/node_modules\/[^/]+\/src(?=\/|$)/);
  if (m) {return m[0];}
  m = norm.match(/^.*\/node_modules\/\.pnpm\/[^/]+\/node_modules\/[^/]+\/dist(?=\/|$)/);
  if (m) {return m[0].replace(/\/dist$/, '/src');}
  return null;
}

/**
 * Ambient files we want to inline must belong to either the
 * workspace root or an inlined package (workspace or pnpm shadow).
 */
function isAmbientOwned(fileName) {
  const norm = fileName.replace(/\\/g, '/');
  const repoRoot = REPO_ROOT.replace(/\\/g, '/');
  // Repo-root .d.ts (e.g. global.d.ts) — always in scope. Skip
  // anything under packages/ (handled by isInlinedPackageFile) and
  // anything under libdefs/ (runtime globals, not declarations).
  if (
    norm.startsWith(repoRoot + '/') &&
    !norm.includes('/packages/') &&
    !norm.includes('/libdefs/')
  ) {
    return true;
  }
  return isInlinedPackageFile(fileName);
}

/**
 * Concatenate inlined `.d.ts` text into a single output, rewriting
 * imports from inlined packages so they point to bundled local
 * sources instead of `@lexical/...` paths. Also concatenates the
 * entry file's emitted `.d.ts` so its `export *` statements still
 * appear at the end of the bundle.
 */
function buildBundle({
  inlinedSourceToDts,
  entryDts,
}) {
  const out = [];
  out.push('/**');
  out.push(' * THIS FILE IS AUTO-GENERATED by scripts/bundle-types.mjs.');
  out.push(' * It is a single self-contained declaration file for the');
  out.push(' * `onchain-rich-text-editor` package: all transitively');
  out.push(' * referenced types from @lexical/*, lexical,');
  out.push(' * onchain-lexical-*, shared/* and other workspace');
  out.push(' * packages are emitted here. Consumers of the published');
  out.push(' * package do not need any additional @lexical/* types.');
  out.push(' */');
  out.push('');

  for (const [fileName, dtsText] of inlinedSourceToDts) {
    const rel = path.relative(REPO_ROOT, fileName).replace(/\\/g, '/');
    out.push(`// ---------- from ${rel} ----------`);
    out.push(dtsText.trim());
    out.push('');
  }
  // The entry's .d.ts re-exports from `@lexical/...` already covered
  // by the inlined declarations above, so emit it last. Any imports
  // of inlined-package modules remain as TypeScript will pick the
  // symbols up from the global scope of this file.
  out.push('// ---------- entry: ' +
    path.relative(REPO_ROOT, ENTRY).replace(/\\/g, '/') + ' ----------');
  out.push(entryDts.trim());
  out.push('');

  return dedupeImports(out.join('\n'));
}

/**
 * Deduplicate `import { X, Y } from 'spec';` lines that appear in
 * multiple inlined sections. After concatenation, identical imports at the
 * top of a single flat `.d.ts` file would trigger TS2300
 * ("Duplicate identifier") because the symbols are re-introduced into
 * the same module scope. Merge into the first occurrence and drop the
 * rest. Type imports are merged into the surviving import so a
 * `MutableRefObject` brought in as `type` and again as a value still
 * lives on the value form (TypeScript drops the `type` modifier if
 * the binding is used as a value elsewhere).
 */
function dedupeImports(text) {
  // Track per spec:
  //   - at most one default-or-namespace import. If a default
  //     import and a namespace import both target the same spec,
  //     keep only the default form (it lets us also append `{ ... }`
  //     named imports to the same statement; a namespace import
  //     cannot be combined with named imports on one line).
  //   - the union of all named imports and their `type`-ness.
  const specToBinding = new Map(); // spec → {firstIndex, kind: 'default'|'ns', isType, name}
  const specToNamed = new Map(); // spec → {firstIndex, names, isType}
  const lines = text.split(/\r?\n/);
  // Match `import [type] (binding [, { ... }] | * as React | X) from 'spec';`.
  // Capture groups:
  //   1: optional leading `type` modifier on the whole statement
  //   2: optional `* as NAME` namespace import
  //   3: optional bare default binding NAME
  //   4: optional `{ ... }` named clause
  //   5: spec
  const importRe = /^import\s+(type\s+)?(?:(?:\*\s+as\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*))(?:\s*,\s*)?)?(?:\{([^}]*)\})?\s*from\s+['"]([^'"]+)['"]\s*;?\s*$/;
  // Pre-scan.
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(importRe);
    if (!m) {continue;}
    const [, typeMod, nsName, defName, named, spec] = m;
    const isType = Boolean(typeMod);
    if (named !== undefined) {
      const names = new Set();
      for (const rawName of named.split(',')) {
        let n = rawName.trim();
        if (!n) {continue;}
        if (n.startsWith('type ')) {n = n.slice(5).trim();}
        if (n) {names.add(n);}
      }
      if (!specToNamed.has(spec)) {
        specToNamed.set(spec, {firstIndex: i, isType, names});
      } else {
        const prev = specToNamed.get(spec);
        for (const n of names) {prev.names.add(n);}
        if (!isType) {prev.isType = false;}
      }
    }
    // If this line binds a default / namespace identifier, record
    // the FIRST occurrence. Default wins over namespace if both
    // show up — the namespace form (`import * as X`) can't be
    // combined with named imports on a single line, but the
    // default form (`import X`) can.
    if (nsName && !specToBinding.has(spec)) {
      specToBinding.set(spec, {
        firstIndex: i,
        isType,
        kind: 'ns',
        name: nsName,
      });
    } else if (defName && !specToBinding.has(spec)) {
      specToBinding.set(spec, {
        firstIndex: i,
        isType,
        kind: 'default',
        name: defName,
      });
    }
  }
  // Build the merged per-spec lines keyed by their surviving
  // source-line index.
  const replaceAt = new Map();
  for (const [spec, named] of specToNamed) {
    if (named.names.size === 0) {continue;}
    const sorted = Array.from(named.names).sort();
    const typeMod = named.isType ? 'type ' : '';
    const binding = specToBinding.get(spec);
    let line;
    if (binding && binding.kind === 'default' &&
        binding.firstIndex === named.firstIndex) {
      // The original line was already `import X, { ... } from ...`
      // — keep its shape, but use the merged name list.
      const leading = binding.isType ? 'type ' : '';
      line = `import ${leading}${binding.name}, ${typeMod}{ ${sorted.join(', ')} } from '${spec}';`;
      replaceAt.set(binding.firstIndex, line);
    } else if (binding) {
      // Default + named: emit on the binding's line.
      const leading = binding.isType ? 'type ' : '';
      line = `import ${leading}${binding.name}, ${typeMod}{ ${sorted.join(', ')} } from '${spec}';`;
      replaceAt.set(binding.firstIndex, line);
    } else {
      line = `import ${typeMod}{ ${sorted.join(', ')} } from '${spec}';`;
      replaceAt.set(named.firstIndex, line);
    }
  }
  for (const [spec, binding] of specToBinding) {
    if (replaceAt.has(binding.firstIndex)) {continue;}
    // Standalone binding (no merged named clause to add).
    const leading = binding.isType ? 'type ' : '';
    const body = binding.kind === 'ns'
      ? `* as ${binding.name}`
      : binding.name;
    replaceAt.set(binding.firstIndex, `import ${leading}${body} from '${spec}';`);
  }
  // Second pass: rewrite.
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (replaceAt.has(i)) {
      out.push(replaceAt.get(i));
      continue;
    }
    const m = lines[i].match(importRe);
    if (m) {
      // Duplicate import — drop it; its identifiers have been
      // folded into the surviving line above.
      continue;
    }
    out.push(lines[i]);
  }
  return out.join('\n');
}

function main() {
  const rawOptions = loadTsConfig(TSCONFIG);
  const converted = ts.convertCompilerOptionsFromJson(rawOptions, REPO_ROOT);
  if (converted.errors && converted.errors.length) {
    for (const err of converted.errors) {
      console.error(
        `tsconfig option error: ${
          ts.flattenDiagnosticMessageText(err.messageText, '\n')}`,
      );
    }
    process.exit(1);
  }

  const programOptions = {
    ...converted.options,
    declaration: true,
    declarationDir: undefined,
    emitDeclarationOnly: true,
    noEmit: false,
    outDir: undefined,
  };

  // `program.emit()` only emits files explicitly listed in
  // `rootNames` — files reached transitively through imports are
  // loaded into the program (so `program.getSourceFile()` finds
  // them) but they are NOT emitted. To inline a workspace
  // package's `.tsx`/`.ts` source into the flat `.d.ts` bundle we
  // need its emitted `.d.ts` text, which means every inlined file
  // must be in `rootNames` at emit time.
  //
  // Chicken/egg: we need the program to walk imports and find the
  // inlined files, but the program won't emit them unless they're
  // already in `rootNames`. Resolve it with a two-pass build:
  //   1. Build a discovery program with just the entry.
  //   2. Walk imports via `collectInlinedFiles` to enumerate every
  //      file we want inlined.
  //   3. Re-create the program with all of them as `rootNames` so
  //      `program.emit()` produces their `.d.ts` text.
  const baseRootNames = [
    ENTRY,
    path.join(REPO_ROOT, 'global.d.ts'),
    path.join(REPO_ROOT, 'libdefs', 'globals.d.ts'),
    path.join(REPO_ROOT, 'libdefs', 'environment.js'),
  ];
  const discoveryProgram = ts.createProgram({
    options: programOptions,
    rootNames: baseRootNames,
  });
  const inlinedFiles = collectInlinedFiles(discoveryProgram, ENTRY);
  const ambientFiles = collectAmbientInlinedFiles(inlinedFiles);
  const fullRootNames = [
    ...baseRootNames,
    ...Array.from(inlinedFiles).filter(
      (f) => !baseRootNames.includes(f),
    ),
    ...Array.from(ambientFiles).filter(
      (f) => !baseRootNames.includes(f),
    ),
  ];
  const program = ts.createProgram({
    options: programOptions,
    rootNames: fullRootNames,
  });

  const emitMap = new Map();
  const writer = (fileName, data) => {
    emitMap.set(fileName, data);
  };
  program.emit(undefined, writer, undefined, true);

  const sourceToDts = new Map();
  for (const fileName of emitMap.keys()) {
    if (!fileName.endsWith('.d.ts')) {continue;}
    // Map the emitted .d.ts back to BOTH the .ts and .tsx source
    // forms. Whichever exists in the program is the real source —
    // the prior implementation only chained `.ts` then `.tsx` on
    // the same string, so `.tsx` sources (e.g. React component
    // files) silently failed to inline because the lookup key
    // never matched.
    const withoutExt = fileName.slice(0, -'.d.ts'.length);
    sourceToDts.set(fileName, fileName);
    if (program.getSourceFile(withoutExt + '.ts')) {
      sourceToDts.set(withoutExt + '.ts', fileName);
    }
    if (program.getSourceFile(withoutExt + '.tsx')) {
      sourceToDts.set(withoutExt + '.tsx', fileName);
    }
  }

  const inlinedSourceToDts = [];
  for (const f of inlinedFiles) {
    if (path.resolve(f) === path.resolve(ENTRY)) {continue;}
    let text = null;
    if (f.endsWith('.d.ts')) {
      // `.d.ts` source files are already declarations; TS doesn't
      // re-emit them. Read the file text directly so workspace
      // packages whose public surface is declared in `.d.ts` (e.g.
      // `lexical-instance/src/types.d.ts` re-exporting `Instance`)
      // actually land in the bundle.
      try {
        text = fs.readFileSync(f, 'utf8');
      } catch {
        // file no longer on disk — skip
      }
    } else {
      const dtsFile = sourceToDts.get(f);
      text = dtsFile ? emitMap.get(dtsFile) : null;
    }
    if (!text) {continue;}
    // 1) Rewrite inline `import("packages/...")` type expressions
    //    to the equivalent public-package form.
    // 2) Strip every `import` / `export ... from 'spec'` line from
    //    the emitted .d.ts. After concatenation, all referenced
    //    types end up in the SAME file's top-level scope, so:
    //     - Sibling imports like `import { X } from './Y'` resolve
    //       to whatever section emitted `Y`'s declaration.
    //     - Cross-package imports like `import ... from
    //       '@lexical/...'` would otherwise dangle because the
    //       workspace packages are not installed as npm deps.
    //    Stripping them keeps the bundle self-contained.
    const cleaned = stripAllImportExportStatements(
      stripLocalExportKeywords(
        stripInlinedDefaultExports(rewriteInlineTypeImports(text)),
      ),
      INLINE_PACKAGES,
    );
    inlinedSourceToDts.push([f, cleaned]);
  }

  // Append ambient `.d.ts` files (workspace-root globals like
  // `global.d.ts` and sibling ambients next to inlined sources like
  // `onchain-utility/src/global.d.ts`). They were added to
  // `fullRootNames` above so `program.emit()` produces their text;
  // here we read the source directly (TS doesn't re-emit
  // `.d.ts → .d.ts`) and run the same cleanup pipeline as the
  // import-walked sources.
  const ambientSourceToDts = [];
  for (const f of ambientFiles) {
    let text = null;
    try {
      text = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    const cleaned = stripAllImportExportStatements(
      stripLocalExportKeywords(
        stripInlinedDefaultExports(rewriteInlineTypeImports(text)),
      ),
      INLINE_PACKAGES,
    );
    ambientSourceToDts.push([f, cleaned]);
  }

  // Resolve duplicate top-level identifiers across inlined
  // sections. The first section to declare `Foo` owns it; later
  // sections that re-declare `Foo` with the same body are dropped
  // (verbatim copies — common for playground forks of upstream
  // node classes), and later sections that re-declare `Foo` with a
  // different body are renamed with a semantic prefix from the
  // source file. See [[rename-style]].
  const dedupedSourceToDts = dedupeInlinedSections([
    ...inlinedSourceToDts,
    ...ambientSourceToDts,
  ]);

  // Collect every specifier the entry file uses, paired with the
  // set of names that spec actually exports. These feed the entry's
  // re-export rewrite (see `rewriteEntryReexports` below): every
  // `export * from 'spec'` for a workspace-inlined `spec` becomes a
  // concrete `export { A, B, … };` so the public API surface
  // survives the strip pass. Specs that resolve into
  // `INLINE_PACKAGES` are the only ones that need flattening —
  // external specs (`react`, `yjs`) stay verbatim so consumers can
  // resolve them from their own `node_modules`.
  const entrySourceFile = program.getSourceFile(ENTRY);
  const inlinedEntrySpecs = new Set();
  const specToExportedNames = new Map();
  // Walk a spec's source AST and collect every top-level exportable
  // name — both own declarations AND names re-exported via
  // `export { X } from './subpath'` / `export * from './subpath'`.
  // The previous version only counted own declarations, which left
  // pass-through modules like `lexical/src/index.ts` (whose entire
  // body is `export { … } from './caret/LexicalCaret'` etc.) with
  // empty name sets, so the entry's `export * from 'lexical'`
  // dropped every transitive type along with it.
  const visitedForNames = new Set();
  function collectExportedNames(sf, fromFile) {
    const names = new Set();
    if (!sf) {return names;}
    if (visitedForNames.has(sf.fileName)) {return names;}
    visitedForNames.add(sf.fileName);
    for (const inner of sf.statements) {
      if (
        ts.isVariableStatement(inner) ||
        ts.isFunctionDeclaration(inner) ||
        ts.isClassDeclaration(inner) ||
        ts.isInterfaceDeclaration(inner) ||
        ts.isTypeAliasDeclaration(inner) ||
        ts.isEnumDeclaration(inner)
      ) {
        const declarations = inner.declarationList
          ? inner.declarationList.declarations
          : [inner];
        for (const decl of declarations) {
          if (decl.name && ts.isIdentifier(decl.name)) {
            names.add(decl.name.text);
          }
        }
        // Local exports like `export function Foo()` are
        // already covered above; the `export` keyword is dropped
        // by the strip pass but the declaration stays.
      } else if (ts.isExportDeclaration(inner)) {
        if (inner.exportClause && inner.exportClause.kind ===
            ts.SyntaxKind.NamedExports) {
          for (const elt of inner.exportClause.elements) {
            const exportedName = elt.name.text;
            names.add(exportedName);
          }
        } else if (!inner.exportClause) {
          // `export * from './subpath'` — recurse into the
          // subpath's source and union in its exported names.
          const subSpec = inner.moduleSpecifier?.text;
          if (subSpec) {
            const subTarget = resolveModule(
              sf.fileName, subSpec, program,
            );
            if (subTarget) {
              const subSf = program.getSourceFile(subTarget);
              for (const n of collectExportedNames(subSf, subTarget)) {
                names.add(n);
              }
            }
          }
        }
      }
    }
    return names;
  }
  for (const stmt of entrySourceFile.statements) {
    const spec =
      ts.isImportDeclaration(stmt) ||
      (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier)
        ? stmt.moduleSpecifier.text
        : null;
    if (!spec) {
      continue;
    }
    const resolved = resolveModule(ENTRY, spec, program);
    if (!resolved) {
      continue;
    }
    if (!isInlinedPackageFile(resolved)) {
      continue;
    }
    inlinedEntrySpecs.add(spec);
    const resolvedSf = program.getSourceFile(resolved);
    const names = collectExportedNames(resolvedSf, resolved);
    specToExportedNames.set(spec, names);
  }

  // For every inlined spec, look up the file's default export's
  // identifier name (e.g. `./App` → `PlaygroundApp`). The default
  // re-export rewrite needs this so it can write
  // `declare const _X: typeof <DefaultName>;` instead of
  // `typeof import('./App').default` — the consumer's IDE can't
  // resolve `import('./App')` once the file is inlined into the
  // flat bundle.
  //
  // Reading the source AST is unreliable: `export default
  // React.memo(function ToolbarPlugin(...) {})` is emitted as
  // `declare const _default: ...; export default _default;` — the
  // `ToolbarPlugin` name is gone from the .d.ts. So we read the
  // EMITTED .d.ts text instead and regex out the name that
  // immediately precedes `export default <name>;`.
  const inlinedDefaultNames = new Map();
  const defaultNameInEmitted = (text) => {
    if (!text) {return undefined;}
    // Common emitted shape: `declare const _default: ...; export default _default;`
    let m = text.match(
      /^declare\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)\b[\s\S]*?^export\s+default\s+\1\s*;/m,
    );
    if (m) {return m[1];}
    // Fallback: the LAST `export default <id>;` in the file. The
    // emitted .d.ts typically has only one default export, so this
    // is the right identifier to reference.
    const all = [];
    const re = /^export\s+default\s+([A-Za-z_$][\w$]*)\s*;/gm;
    let mm;
    while ((mm = re.exec(text)) !== null) {
      all.push(mm[1]);
    }
    if (all.length > 0) {
      return all[all.length - 1];
    }
    return undefined;
  };
  for (const spec of inlinedEntrySpecs) {
    const resolved = resolveModule(ENTRY, spec, program);
    if (!resolved) {continue;}
    let emitted = null;
    if (resolved.endsWith('.d.ts')) {
      try {
        emitted = fs.readFileSync(resolved, 'utf8');
      } catch {
        // skip
      }
    } else {
      const dtsFile = sourceToDts.get(resolved);
      emitted = dtsFile ? emitMap.get(dtsFile) : null;
    }
    let name = defaultNameInEmitted(emitted);
    if (!name) {
      // Fallback to the source AST — needed when TS refused to emit
      // a .d.ts (e.g. the source has an error like a missing
      // `*.less` module declaration). The AST still has the
      // declaration form's name.
      const sf = program.getSourceFile(resolved);
      if (sf) {
        for (const stmt of sf.statements) {
          if (ts.isFunctionDeclaration(stmt) && stmt.modifiers) {
            const isDefault = stmt.modifiers.some(
              (m) => m.kind === ts.SyntaxKind.DefaultKeyword,
            );
            if (isDefault && stmt.name) {
              name = stmt.name.text;
              break;
            }
          }
          if (ts.isClassDeclaration(stmt) && stmt.modifiers) {
            const isDefault = stmt.modifiers.some(
              (m) => m.kind === ts.SyntaxKind.DefaultKeyword,
            );
            if (isDefault && stmt.name) {
              name = stmt.name.text;
              break;
            }
          }
          if (ts.isExportAssignment(stmt)) {
            if (ts.isIdentifier(stmt.expression)) {
              name = stmt.expression.text;
              break;
            }
            // Find named function expression in HOC wrappers
            // (e.g. `React.memo(function Foo(...) {})`).
            let cur = stmt.expression;
            while (cur) {
              if (
                ts.isCallExpression(cur) &&
                cur.arguments.length > 0
              ) {
                cur = cur.arguments[0];
              } else if (ts.isParenthesizedExpression(cur)) {
                cur = cur.expression;
              } else {
                break;
              }
            }
            if (ts.isFunctionExpression(cur) && cur.name) {
              name = cur.name.text;
              break;
            }
          }
        }
      }
    }
    if (name) {
      inlinedDefaultNames.set(spec, name);
    }
  }

  // Find the entry file's emitted .d.ts
  let entryDts = null;
  for (const f of inlinedFiles) {
    if (path.resolve(f) !== path.resolve(ENTRY)) {continue;}
    const dtsFile = sourceToDts.get(f);
    if (dtsFile && emitMap.has(dtsFile)) {
      entryDts = emitMap.get(dtsFile);
      break;
    }
  }
  if (!entryDts) {
    for (const key of emitMap.keys()) {
      if (
        /lexical-playground[\\\/]src[\\\/]index\.d\.ts$/.test(key)
      ) {
        entryDts = emitMap.get(key);
        break;
      }
    }
  }
  if (!entryDts) {
    console.error('Available emitMap keys (first 20):');
    for (const k of emitMap.keys()) {
      if (k.includes('playground')) {console.error('  ' + k);}
    }
    throw new Error('Could not find entry .d.ts in emitMap');
  }

  // The entry file's emitted `.d.ts` still has imports like
  // `import type { SerializedDocument } from '@lexical/file'` and
  // `export * from '@lexical/...'`. None of those modules are
  // resolvable in the consumer's package (they're bundled
  // workspace packages, not npm dependencies). Two passes prepare
  // the entry for the strip step:
  //   1. `rewriteDefaultReexports` rewrites
  //      `export { default as Editor } from './Editor'` into a
  //      `declare const _Editor: typeof import('./Editor').default;`
  //      block plus the matching `_Editor as Editor` re-export, so
  //      the default identity survives concatenation.
  //   2. `rewriteEntryReexports` flattens every `export * from 'spec'`
  //      and `export { X } from 'spec'` for workspace-inlined specs
  //      into a no-`from` `export { X };` form, so the public API
  //      surface survives the upcoming strip pass.
  // External imports (`react`, `yjs`) are kept verbatim by the
  // strip pass: it preserves lines whose spec is NOT in
  // `INLINE_PACKAGES`, so `import type { MutableRefObject } from
  // 'react'` and `import type { AbstractType } from 'yjs'` flow
  // through to the consumer's `node_modules`.
  entryDts = stripAllImportExportStatements(
    stripLocalExportKeywords(
      rewriteEntryReexports(
        rewriteDefaultReexports(
          rewriteInlineTypeImports(entryDts),
          inlinedDefaultNames,
        ),
        inlinedEntrySpecs,
        specToExportedNames,
      ),
    ),
    INLINE_PACKAGES,
  );

  const bundle = buildBundle({
    entryDts,
    inlinedSourceToDts: dedupedSourceToDts,
  });

  fs.mkdirSync(path.dirname(OUTPUT), {recursive: true});
  fs.writeFileSync(OUTPUT, bundle);
  console.log(
    `Wrote bundled declarations: ${OUTPUT} ` +
    `(${dedupedSourceToDts.length} inlined sources).`,
  );

  // Self-validate: run a noEmit `tsc` pass against the bundled
  // file so any unresolved identifier / dangling cross-package
  // import / orphan side-effect import surfaces immediately.
  // Returns non-zero if validation fails.
  runSelfValidation();
}

/**
 * Spawn `tsc --noEmit` against the bundled file to catch any
 * symbol that didn't make it into the concatenation, any inline
 * `import("...")` referencing a module path that doesn't exist in
 * the consumer's environment, or any leftover side-effect import
 * whose target isn't installed.
 */
function runSelfValidation() {
  const program = ts.createProgram({
    options: {
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2019,
    },
    rootNames: [OUTPUT],
  });
  const diagnostics = [
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
    ...program.getDeclarationDiagnostics(),
  ];
  if (diagnostics.length === 0) {
    console.error('Self-validation: bundle resolves cleanly.');
    return;
  }
  const formatHost = {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => REPO_ROOT,
    getNewLine: () => '\n',
  };
  process.stderr.write(
    ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost),
  );
  process.stderr.write(
    `Self-validation: ${diagnostics.length} diagnostic(s).\n`,
  );
}

/**
 * Map a workspace-relative path like
 * `packages/lexical-onchain-markdown/src/instanceToSerializeNode`
 * to the public package name `onchain-lexical-markdown`. We use
 * this when rewriting inline `import("packages/...")` type
 * expressions in the bundle so downstream consumers — who don't
 * carry the monorepo's `packages/*` tree in their node_modules —
 * get a stable, package-name-based import to resolve.
 */
function workspacePathToPublicPackage(spec) {
  let m = spec.match(/^packages[\\/]+([^\\/]+)[\\/]+src[\\/]+(.*)$/);
  if (!m) {return null;}
  const dir = m[1];
  const rest = m[2];
  if (dir.startsWith('onchain-')) {
    return {name: dir, subpath: rest};
  }
  if (dir === 'lexical') {
    return {name: 'lexical', subpath: rest};
  }
  return {
    name: '@lexical/' + dir.replace(/^lexical-/, ''),
    subpath: rest,
  };
}

/**
 * In a bundled `.d.ts`, inline type expressions like
 * `import("packages/lexical-onchain-markdown/src/foo")` would
 * fail at the consumer's type-checker because the workspace's
 * directory layout doesn't exist outside the monorepo. Rewrite
 * those to the equivalent public-package import using the path
 * → package mapping above.
 */
function rewriteInlineTypeImports(text) {
  // Match `import("…")` tokens wherever they appear (return types,
  // parameter types, type aliases, etc.) and rewrite the inner
  // string. We deliberately keep this conservative to avoid
  // mangling unrelated quoted strings.
  return text.replace(/import\(\s*["']([^"']+)["']\s*\)/g, (whole, spec) => {
    if (!spec.startsWith('packages/') && !spec.startsWith('packages\\')) {
      return whole;
    }
    const mapped = workspacePathToPublicPackage(spec);
    if (!mapped) {return whole;}
    const subpath = mapped.subpath.replace(/\.(ts|tsx|d\.ts)$/, '');
    const target = subpath === 'index' ? mapped.name : `${mapped.name}/${subpath}`;
    return `import("${target}")`;
  });
}

/**
 * Remove the `export default` clause from an inlined section's
 * emitted `.d.ts`. The flat bundle can have at most ONE
 * `export default` (the entry's own), so every `export default`
 * from a workspace package file must be either dropped or turned
 * into a plain top-level declaration:
 *
 *   - `export default function Foo(...): T;`
 *     → `function Foo(...): T;`  (then `stripLocalExportKeywords`
 *       rewrites it to `declare function Foo(...): T;`)
 *   - `export default class Foo {}`
 *     → `class Foo {}`  (then `declare class Foo {}`)
 *   - `export default <Identifier>;`  (alias of a local decl)
 *     → drop the line entirely. The local `declare const <Id>;`
 *       that the alias referred to stays in the file, so the
 *       entry's already-rewritten `declare const _X: typeof <Id>;`
 *       still resolves to the inlined declaration.
 *
 * The entry's own `export default` (e.g. `export default
 * RichTextEditor;`) is processed by the entry pipeline, NOT this
 * helper, so the public re-exports survive.
 */
function stripInlinedDefaultExports(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // `export default <Identifier>;` — alias form. Drop the line.
    if (/^export\s+default\s+[A-Za-z_$][\w$]*\s*;?\s*$/.test(trimmed)) {
      continue;
    }
    // `export default function Foo(...)` — `default` is a modifier
    // here, not a separate identifier. Strip both `export ` and
    // `default ` so the result is `function Foo(...): T;` (then
    // `stripLocalExportKeywords` rewrites to `declare function`).
    if (/^export\s+default\s+function\b/.test(trimmed)) {
      out.push(
        lines[i].replace(/^(\s*)export\s+default\s+/, '$1'),
      );
      continue;
    }
    // `export default class Foo ...` — same treatment.
    if (/^export\s+default\s+class\b/.test(trimmed)) {
      out.push(
        lines[i].replace(/^(\s*)export\s+default\s+/, '$1'),
      );
      continue;
    }
    out.push(lines[i]);
  }
  return out.join('\n');
}

/**
 * Extract the top-level declaration names from a cleaned `.d.ts`
 * snippet. Used to detect collisions between inlined sections
 * (e.g. two files both declaring `type Position`).
 *
 * @param {string} text
 * @returns {string[]} names in source order
 */
function topLevelDeclNames(text) {
  const names = [];
  // `interface Foo`, `type Foo`, `class Foo`, `function Foo`,
  // `enum Foo`, `const Foo`, `let Foo`, `var Foo` — each prefixed
  // by an optional `declare`. The `^` plus `m` flag scopes each
  // match to its own line.
  const re =
    /^(?:declare\s+)?(?:interface|type|class|function|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    names.push(m[1]);
  }
  return names;
}

/**
 * Resolve duplicate top-level identifiers across the inlined
 * sections of the bundle.
 *
 *   - First-source-wins: the first section that declares a name
 *     owns it; later sections that re-declare the same name either
 *     (a) drop the duplicate declaration entirely if the text is
 *     identical (verbatim copies — common for playground forks of
 *     upstream node classes), or (b) rename with a semantic prefix
 *     derived from the source file when the bodies differ.
 *
 *   - Sections whose every declaration is already owned by an
 *     earlier section AND match exactly (verbatim copy) are dropped
 *     from the bundle entirely. This is what handles
 *     `lexical-instance/src/image/InlineImageNode/index.tsx` and
 *     `lexical-playground/src/nodes/InlineImageNode/InlineImageNode.tsx`
 *     declaring the same `Position` / `InlineImageNode` /
 *     `SerializedInlineImageNode` — only the first section is kept.
 *
 *   - When a section has SOME duplicate and SOME new names, the
 *     new names are kept under their original identifiers and the
 *     duplicate declarations are renamed. The rename suffix is the
 *     source file's basename (no hash) per
 *     `[[rename-style]]`.
 *
 * @param {Array<[string, string]>} inlinedSourceToDts
 *   (fileName, cleanedDtsText) pairs
 * @returns {Array<[string, string]>} filtered + renamed
 */
function dedupeInlinedSections(inlinedSourceToDts) {
  const out = [];
  // Maps we build up as we walk the sections in order.
  const seenBodies = new Map(); // name → first source's text snippet
  const ownerSource = new Map(); // name → first source that declared it
  for (const [fileName, dtsText] of inlinedSourceToDts) {
    const lines = dtsText.split(/\r?\n/);
    const trimmed = lines.map((l) => l.trim());
    const decls = topLevelDeclNames(dtsText);
    // Within a single section, a name can appear more than once
    // because of TS declaration merging (e.g. `interface TextNode`
    // + `class TextNode extends LexicalNode` in the same file).
    // Each appearance of the same name in the same file is the
    // SAME declaration, not a duplicate — they collapse into one
    // symbol after emit. We process each unique name once per
    // section so the second `TextNode` doesn't get a rename.
    const seenInSection = new Set();
    const sectionBodyFor = (name) => {
      // Locate the first decl in the section with this name and
      // slice the body forward from there.
      const re = new RegExp(
        `^(?:declare\\s+)?(?:interface|type|class|function|enum|const|let|var)\\s+${escapeRegExp(name)}\\b`,
      );
      let startIdx = -1;
      for (let i = 0; i < trimmed.length; i++) {
        if (re.test(trimmed[i])) {
          startIdx = i;
          break;
        }
      }
      if (startIdx < 0) {return '';}
      return sliceDeclBody(trimmed);
    };
    // Per-name verdict: 'keep' (no rename), 'drop' (already
    // declared with identical body — verbatim copy), 'rename' (need
    // a new name to avoid collision).
    const verdicts = new Map();
    for (const name of decls) {
      if (seenInSection.has(name)) {continue;}
      seenInSection.add(name);
      if (!ownerSource.has(name)) {
        ownerSource.set(name, fileName);
        seenBodies.set(name, sectionBodyFor(name));
        verdicts.set(name, {action: 'keep'});
        continue;
      }
      const bodyHere = sectionBodyFor(name);
      const bodyThere = seenBodies.get(name);
      if (bodyHere && bodyThere && bodyHere === bodyThere) {
        verdicts.set(name, {action: 'drop'});
      } else {
        const stem = path
          .basename(fileName)
          .replace(/\.(d\.ts|ts|tsx)$/, '')
          .replace(/[^A-Za-z0-9_]/g, '');
        const renamed = `${stem}_${name}`;
        // If the proposed rename itself collides (rare), append a
        // numeric suffix until it doesn't. We don't want to silently
        // overwrite another section's declaration.
        let finalName = renamed;
        let n = 2;
        while (ownerSource.has(finalName)) {
          finalName = `${renamed}_${n}`;
          n += 1;
        }
        ownerSource.set(finalName, fileName);
        verdicts.set(name, {action: 'rename', newName: finalName});
      }
    }
    // Rewrite the section: drop 'drop' declarations, rename
    // 'rename' declarations.
    const rewritten = rewriteSectionDecls(dtsText, verdicts);
    if (rewritten.trim() === '') {
      // Section is fully redundant (verbatim copy of everything in
      // an earlier section). Skip the whole section.
      continue;
    }
    if (topLevelDeclNames(rewritten).length === 0) {
      // Every top-level declaration in this section was a
      // duplicate that got dropped. The remaining text is just
      // license comments and external type imports (which the
      // entry pipeline's `INLINE_PACKAGES` strip already handled
      // — these are not in `INLINE_PACKAGES`, so they survived).
      // Skip the whole section; nothing of value is left.
      continue;
    }
    out.push([fileName, rewritten]);
  }
  return out;
}

/**
 * For the line in `trimmed` whose top-level declaration starts at
 * the first non-blank token, return the text from that line until
 * the next top-level declaration (or end of text). This is the
 * coarse body comparison used to decide whether two declarations
 * of the same name are verbatim copies.
 */
function sliceDeclBody(trimmed) {
  // Find first index of a top-level decl line.
  const re =
    /^(?:declare\s+)?(?:interface|type|class|function|enum|const|let|var)\s+[A-Za-z_$][\w$]*\b/;
  let startIdx = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (re.test(trimmed[i])) {
      startIdx = i;
      break;
    }
  }
  if (startIdx < 0) {return '';}
  // Find the next top-level decl line (line whose first non-blank
  // token is a TS keyword starting a declaration, or one of the
  // modifier-only lines we care about).
  const nextRe =
    /^(?:declare\s+)?(?:interface|type|class|function|enum|const|let|var)\s+[A-Za-z_$][\w$]*\b/;
  let endIdx = trimmed.length;
  for (let j = startIdx + 1; j < trimmed.length; j++) {
    if (nextRe.test(trimmed[j])) {
      endIdx = j;
      break;
    }
  }
  return trimmed.slice(startIdx, endIdx).join('\n');
}

/**
 * Apply per-declaration verdicts to a section's text: drop
 * declarations marked 'drop', rename those marked 'rename'. All
 * in-file references to the renamed identifier are updated so the
 * section remains internally consistent.
 */
function rewriteSectionDecls(text, verdicts) {
  const renames = [];
  for (const [name, v] of verdicts) {
    if (v.action === 'rename') {
      renames.push([name, v.newName]);
    }
  }
  if (renames.length === 0 && [...verdicts.values()].every((v) => v.action === 'keep')) {
    return text;
  }
  const lines = text.split(/\r?\n/);
  const out = [];
  const declHeaderRe =
    /^(\s*)(?:declare\s+)?(interface|type|class|function|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/;
  // Tracks brace depth for class/interface/enum bodies so we know
  // when a declaration ends.
  let braceDepth = 0;
  let skipping = false;
  let skipName = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (skipping) {
      if (skipName && /\b(skipName)\b/.test(trimmed) === false && braceDepth <= 0) {
        // already past the dropped decl
      }
      // Track braces for both class/interface/enum bodies and
      // function bodies so we don't end the skip too early.
      for (const ch of line) {
        if (ch === '{') {braceDepth += 1;}
        else if (ch === '}') {braceDepth -= 1;}
      }
      if (braceDepth <= 0 && /[;}]/.test(trimmed)) {
        skipping = false;
        skipName = null;
      }
      continue;
    }
    const m = trimmed.match(declHeaderRe);
    if (m) {
      const name = m[3];
      const verdict = verdicts.get(name);
      if (verdict && verdict.action === 'drop') {
        // Skip this declaration through its end. For block bodies
        // (class/interface/enum) the closing brace brings depth
        // back to 0; for `;`-terminated decls the trailing `;`
        // marks the end.
        for (const ch of line) {
          if (ch === '{') {braceDepth += 1;}
          else if (ch === '}') {braceDepth -= 1;}
        }
        if (braceDepth <= 0 && /[;{}]/.test(trimmed)) {
          // single-line drop, no body to walk
        } else {
          skipping = true;
          skipName = name;
        }
        continue;
      }
    }
    let newLine = line;
    if (renames.length > 0) {
      for (const [from, to] of renames) {
        // Word-boundary rename — only match identifier-shaped
        // occurrences, leave strings and comments alone.
        newLine = newLine.replace(
          new RegExp(`\\b${escapeRegExp(from)}\\b`, 'g'),
          to,
        );
      }
    }
    out.push(newLine);
  }
  return out.join('\n');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract the package name (owner) from a module specifier. For
 * `@scope/name/sub/path` returns `@scope/name`; for `name/sub/path`
 * returns `name`; for `./relative` or `../relative` returns the
 * spec verbatim.
 *
 * @param {string} spec
 * @returns {string}
 */
function specOwner(spec) {
  if (spec.startsWith('@')) {
    const slash = spec.indexOf('/');
    if (slash < 0) {return spec;}
    const secondSlash = spec.indexOf('/', slash + 1);
    return secondSlash < 0 ? spec : spec.slice(0, secondSlash);
  }
  if (spec.startsWith('.') || spec.startsWith('/')) {return spec;}
  const slash = spec.indexOf('/');
  return slash < 0 ? spec : spec.slice(0, slash);
}

/**
 * Strip every `import` and `export ... from 'spec'` statement from
 * an emitted `.d.ts` snippet, *except* for specs that resolve to
 * external npm packages the consumer is expected to install
 * themselves (`react`, `yjs`, etc.). Those imports are KEPT so
 * that the consumer's TypeScript can resolve type names like
 * `AbstractType` from their own `node_modules`.
 *
 * After concatenation every inlined symbol ends up in the same
 * flat file scope, so:
 *  - Sibling imports (`from './X'`) resolve to whichever section
 *    emitted `X`'s declaration.
 *  - Cross-package imports (`from '@lexical/...'`) dangle if kept,
 *    because the consumer never installs those workspace packages
 *    as transitive dependencies for types.
 * Stripping those keeps the bundle self-contained and avoids
 * duplicate identifiers (the same class would otherwise be
 * declared both where it lives and where it's re-exported).
 *
 * @param {string} text
 * @param {Set<string>} inlinedPackageNames owner names that the
 *   bundle has inlined (e.g. `lexical`, `@lexical/react`,
 *   `onchain-lexical-context`). A spec's owner being in this set
 *   means the import is safe to drop.
 * @returns {string}
 */
function stripAllImportExportStatements(text, inlinedPackageNames) {
  const isInlinedSpec = (spec) => {
    if (spec.startsWith('.') || spec.startsWith('/')) {return true;}
    return inlinedPackageNames.has(specOwner(spec));
  };
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Multi-line `export {\n  ...\n} from 'spec';` opener
    if (/^export\s*\{/.test(trimmed)) {
      let j = i + 1;
      let sawCloseBrace = false;
      let reachedEnd = false;
      let blockSpec = null;
      while (j < lines.length) {
        const t = lines[j].trim();
        if (!sawCloseBrace) {
          // `} from 'spec';` anywhere on the closing line. The
          // brace and `from` clause can land on the same line as
          // the last re-export item (e.g.
          // `/** @deprecated */ Foo, } from 'spec';`), so allow
          // arbitrary prefix text before the closing brace.
          const closeMatch = t.match(
            /\}\s*from\s+['"]([^'"]+)['"]\s*;?\s*$/,
          );
          if (closeMatch) {
            blockSpec = closeMatch[1];
            reachedEnd = true;
            break;
          }
          if (t === '}') {
            sawCloseBrace = true;
            j += 1;
            continue;
          }
          // Anything inside the braces that doesn't look like part
          // of a re-export block — bail out and keep emitting.
          if (
            t !== '' &&
            !/^\(?\*|^\s*[\w$]+\s*,?\s*$/.test(t) &&
            !/^\/\*\*?/.test(t) &&
            !/^\*\//.test(t)
          ) {
            break;
          }
        } else {
          // After a `}`, expect `from 'spec';` on its own line.
          const fromMatch = t.match(/^from\s+['"]([^'"]+)['"]\s*;?\s*$/);
          if (fromMatch) {
            blockSpec = fromMatch[1];
            reachedEnd = true;
            break;
          }
          break;
        }
        j += 1;
      }
      if (reachedEnd && blockSpec && isInlinedSpec(blockSpec)) {
        i = j;
        continue;
      }
    }

    // Single-line: `import ... from 'spec';`
    {
      const m = trimmed.match(
        /^import\s+(type\s+)?(?:\{[\s\S]*?\}|[\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/,
      );
      if (m && isInlinedSpec(m[2])) {
        continue;
      }
    }

    // Single-line: `export * from 'spec';`
    {
      const m = trimmed.match(
        /^export\s+\*\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/,
      );
      if (m && isInlinedSpec(m[1])) {
        continue;
      }
    }

    // Single-line: `export type * from 'spec';`
    {
      const m = trimmed.match(
        /^export\s+type\s+\*\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/,
      );
      if (m && isInlinedSpec(m[1])) {
        continue;
      }
    }

    // Single-line: `export { X, Y } from 'spec';`
    {
      const m = trimmed.match(
        /^export\s+\{[\s\S]*?\}\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/,
      );
      if (m && isInlinedSpec(m[1])) {
        continue;
      }
    }

    // Single-line: `export type { X } from 'spec';`
    {
      const m = trimmed.match(
        /^export\s+type\s+\{[\s\S]*?\}\s+from\s+['"]([^'"]+)['"]\s*;?\s*$/,
      );
      if (m && isInlinedSpec(m[1])) {
        continue;
      }
    }

    // Empty `export {};` left behind when we stripped a multi-line
    // export block from the same position.
    if (/^export\s*\{\s*\}\s*;?\s*$/.test(trimmed)) {
      continue;
    }

    out.push(line);
  }
  return out.join('\n');
}

main();
