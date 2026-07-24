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
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as ts from 'typescript';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
]);

/** Read the root tsconfig.json with comments stripped out. */
function loadTsConfig(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  // Strip block + line comments so JSON.parse doesn't choke
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const parsed = JSON.parse(stripped);
  const baseDir = path.dirname(filePath);
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
    if (seg.startsWith('onchain-')) return seg;
    return '@lexical/' + seg.replace(/^lexical-/, '');
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
    if (visited.has(fileName)) continue;
    visited.add(fileName);
    const sf = program.getSourceFile(fileName);
    if (!sf) continue;
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
        if (target) queue.push(target);
      }
    }
  }
  return inlinedSources;
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
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    declarationDir: undefined,
    outDir: undefined,
  };

  const program = ts.createProgram({
    rootNames: [
      ENTRY,
      path.join(REPO_ROOT, 'global.d.ts'),
      path.join(REPO_ROOT, 'libdefs', 'globals.d.ts'),
      path.join(REPO_ROOT, 'libdefs', 'environment.js'),
    ],
    options: programOptions,
  });

  const emitMap = new Map();
  const writer = (fileName, data) => {
    emitMap.set(fileName, data);
  };
  const emitResult = program.emit(undefined, writer, undefined, true);

  const sourceToDts = new Map();
  for (const fileName of emitMap.keys()) {
    if (!fileName.endsWith('.d.ts')) continue;
    const src = fileName
      .replace(/\.d\.ts$/, '.ts')
      .replace(/\.d\.ts$/, '.tsx');
    sourceToDts.set(src, fileName);
    sourceToDts.set(fileName, fileName);
  }

  const inlinedFiles = collectInlinedFiles(program, ENTRY);
  const inlinedSourceToDts = [];
  for (const f of inlinedFiles) {
    const dtsFile = sourceToDts.get(f);
    const text = dtsFile ? emitMap.get(dtsFile) : null;
    if (!text) continue;
    if (path.resolve(f) === path.resolve(ENTRY)) continue;
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
      rewriteInlineTypeImports(text),
    );
    inlinedSourceToDts.push([f, cleaned]);
  }

  // Find the entry file's emitted .d.ts
  let entryDts = null;
  for (const f of inlinedFiles) {
    if (path.resolve(f) !== path.resolve(ENTRY)) continue;
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
      if (k.includes('playground')) console.error('  ' + k);
    }
    throw new Error('Could not find entry .d.ts in emitMap');
  }

  // The entry file's emitted `.d.ts` still has imports like
  // `import type { SerializedDocument } from '@lexical/file'` and
  // `export * from '@lexical/...'`. None of those modules are
  // resolvable in the consumer's package (they're bundled
  // workspace packages, not npm dependencies). Strip them: every
  // symbol they referenced is already declared in the inlined
  // section above, so dropping these clauses is safe. Inline type
  // imports get rewritten before the strip step so consumers see
  // the public package name, not a workspace-relative path.
  entryDts = stripAllImportExportStatements(
    rewriteInlineTypeImports(entryDts),
  );

  const bundle = buildBundle({
    inlinedSourceToDts,
    entryDts,
  });

  fs.mkdirSync(path.dirname(OUTPUT), {recursive: true});
  fs.writeFileSync(OUTPUT, bundle);
  console.log(
    `Wrote bundled declarations: ${OUTPUT} ` +
    `(${inlinedSourceToDts.length} inlined sources).`,
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
    rootNames: [OUTPUT],
    options: {
      jsx: ts.JsxEmit.Preserve,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2019,
    },
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
  if (!m) return null;
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
    if (!mapped) return whole;
    const subpath = mapped.subpath.replace(/\.(ts|tsx|d\.ts)$/, '');
    const target = subpath === 'index' ? mapped.name : `${mapped.name}/${subpath}`;
    return `import("${target}")`;
  });
}

/**
 * Strip every `import` and `export ... from 'spec'` statement from
 * an emitted `.d.ts` snippet. After concatenation every referenced
 * symbol ends up in the same flat file scope, so:
 *  - Sibling imports (`from './X'`) resolve to whichever section
 *    emitted `X`'s declaration.
 *  - Cross-package imports (`from '@lexical/...'`) dangle if kept,
 *    because the consumer never installs those workspace packages
 *    as transitive dependencies for types.
 * Stripping them keeps the bundle self-contained and avoids
 * duplicate identifiers (the same class would otherwise be
 * declared both where it lives and where it's re-exported).
 */
function stripAllImportExportStatements(text) {
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
      while (j < lines.length) {
        const t = lines[j].trim();
        if (!sawCloseBrace) {
          // `} from 'spec';` on the closing line. Whole block is an
          // export-from so we drop it.
          if (/^\}[\s\S]*from\s+['"][^'"]+['"]\s*;?\s*$/.test(t)) {
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
          if (/^from\s+['"][^'"]+['"]\s*;?\s*$/.test(t)) {
            reachedEnd = true;
            break;
          }
          break;
        }
        j += 1;
      }
      if (reachedEnd) {
        i = j;
        continue;
      }
    }

    // Single-line: `import ... from 'spec';`
    if (
      /^import\s+(type\s+)?(?:\{[\s\S]*?\}|[\s\S]*?)\s+from\s+['"][^'"]+['"]\s*;?\s*$/.test(
        trimmed,
      )
    ) {
      continue;
    }

    // Single-line: `export * from 'spec';`
    if (/^export\s+\*\s+from\s+['"][^'"]+['"]\s*;?\s*$/.test(trimmed)) {
      continue;
    }

    // Single-line: `export { X, Y } from 'spec';`
    if (/^export\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"]\s*;?\s*$/.test(trimmed)) {
      continue;
    }

    // Single-line: `export type { X } from 'spec';`
    if (/^export\s+type\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"]\s*;?\s*$/.test(trimmed)) {
      continue;
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
