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

/**
 * 自动生成 INLINE_PACKAGES。从两类源数据推出：
 *
 *   (1) playground 自己的 package.json 里所有 workspace deps——
 *       "必须集"。playground 显式声明要用的包一定得内联。
 *   (2) transitive spec 收集：扫所有 workspace 包的 src/，以及
 *       playground 自己 src/，提取 import / export 的 spec。
 *       不在 (1) 集合里的 spec = 隐式依赖，必须内联进 bundle——
 *       否则 inline 段里的 import 字符串残留、消费方 IDE 撞
 *       TS2307。这是上次踩 TS2307 的根因。
 *
 * playground 自身 (onchain-rich-text-editor) 不在 (1) 里（自己
 * 不出现在自己的 deps 里），且 (2) 故意跳过相对路径——所以显式
 * 在 (3) 把 PKG.name 加进去。这一步是 bundle 自洽的硬条件：
 * entry section 里的 `export { default as RichTextEditor } from
 * './App'` 必须让 `isInlinedPackageFile('./App')` 返回 true，
 * `rewriteDefaultReexports` 才能拿到 `inlinedDefaultNames.get('./App')`
 * 写出 `declare const _RichTextEditor: typeof <inlined default>;`
 * 而不是 fallback 的 `typeof import("./App").default`——后者在
 * 消费方的项目里 `./App` 不存在，会 TS2307。
 *
 * 只扫 workspace 包的 src/，不扫 examples/、website/、devtools
 * scripts/、测试文件——否则会把一堆 node_modules 引用（antd、
 * playwright、docusaurus、@rollup/*）扫进来，污染 INLINE_PACKAGES。
 *
 * 不取所有 workspace 包（按 packages 目录全集）：会多走
 * lexical-devtools / lexical-eslint-plugin 等无关包，bundle
 * 拖慢。
 */
function buildInlinePackages() {
  // (1) workspace.* deps
  const pkg = JSON.parse(
    fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'),
  );
  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.peerDependencies || {}),
  };
  const out = new Set(
    Object.entries(allDeps)
      .filter(([, v]) => typeof v === 'string' && v.startsWith('workspace:'))
      .map(([n]) => n),
  );
  // (2) transitive spec：扫 playground 自身 src/ + 所有 workspace 包的 src/
  collectTransitiveSpecs(path.join(PKG_ROOT, 'src'), out);
  for (const dir of workspacePackageDirs()) {
    collectTransitiveSpecs(path.join(dir, 'src'), out);
  }
  // (3) entry package 自身——见上面注释。
  out.add(pkg.name);
  return out;
}

/**
 * 列出 packages 目录下所有真 workspace 包的目录路径。判定方式：
 * 读对应目录 package.json 的 name 字段，且是非空字符串。
 *
 * 简化策略：当前 monorepo 里任何带 workspace name 的 packages
 * 子目录都算 workspace 包（pnpm workspace 协议保证）。examples
 * / lexical-website 等没有 package.json 的目录自然跳过。
 */
function workspacePackageDirs() {
  const pkgsDir = path.join(REPO_ROOT, 'packages');
  if (!fs.existsSync(pkgsDir)) {
    return [];
  }
  const dirs = [];
  for (const entry of fs.readdirSync(pkgsDir, {withFileTypes: true})) {
    if (!entry.isDirectory()) {
      continue;
    }
    const pkgJsonPath = path.join(pkgsDir, entry.name, 'package.json');
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    } catch {
      continue;
    }
    if (typeof pkg.name === 'string' && pkg.name.length > 0) {
      dirs.push(path.join(pkgsDir, entry.name));
    }
  }
  return dirs;
}

/**
 * 递归扫 `<root>` 下所有 .ts/.tsx，提取 import/export 的 spec，
 * spec owner 不在 `knownOwners` 里的加进 `knownOwners`。
 *
 * 跳过 `__tests__/`、`.test.` / `.spec.` 文件、d.ts（ambient 不
 * 走 import/export 解析路径，扫了反而把外部类型引用收进来）。
 *
 * 为什么不用 `program`：顶层模块作用域跑 buildInlinePackages
 * 时还没创建 TS program，自己 createSourceFile 单文件 parse
 * 完全够用——只关心 spec 字符串，不需要类型解析。
 */
function collectTransitiveSpecs(root, knownOwners) {
  if (!fs.existsSync(root)) {
    return;
  }
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === 'node_modules' ||
          entry.name === '__tests__' ||
          entry.name.startsWith('.')
        ) {
          continue;
        }
        stack.push(full);
      } else if (
        /\.tsx?$/.test(entry.name) &&
        !entry.name.endsWith('.d.ts') &&
        !/\.(test|spec)\./.test(entry.name)
      ) {
        collectSpecsFromFile(full, knownOwners);
      }
    }
  }
}

function collectSpecsFromFile(filePath, knownOwners) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }
  const sf = ts.createSourceFile(filePath, text, ts.ScriptTarget.ES2019, true);
  for (const stmt of sf.statements) {
    let spec = null;
    if (ts.isImportDeclaration(stmt) || ts.isExportDeclaration(stmt)) {
      spec = stmt.moduleSpecifier?.text;
    }
    if (!spec || spec.startsWith('.') || spec.startsWith('/')) {
      continue;
    }
    // 自动收集只覆盖 workspace 范围内（@lexical/* / onchain-* / lexical）
    // 的 transitive spec。第三方 npm 包（katex、react、yjs、@types/*、
    // @ant-design/*、@rollup/* 等）的 d.ts 处理逻辑复杂且消费方自
    // 己会装，把它们收进 INLINE_PACKAGES 会让 bundle 出 TS1109 /
    // TS2307 等解析错。
    if (!isWorkspaceSpec(spec)) {
      continue;
    }
    const owner = specOwner(spec);
    if (owner && !knownOwners.has(owner)) {
      knownOwners.add(owner);
    }
  }
}

/** True iff the spec refers to a package owned by this monorepo. */
function isWorkspaceSpec(spec) {
  if (spec.startsWith('@lexical/')) {
    return true;
  }
  if (spec.startsWith('onchain-')) {
    return true;
  }
  if (spec === 'lexical') {
    return true;
  }
  return false;
}

/** Packages whose declarations should be inlined into the bundle. */
const INLINE_PACKAGES = buildInlinePackages();

/** Consumer usages contract file. Generated by PLM-RIA-Frontend's
 *  scripts/dump-onchain-rich-text-editor-usages.mjs and copied here
 *  before running this script. Missing → consumer-contract check
 *  is skipped (INFO log), not a hard failure. */
const USAGES_FILE = path.join(PKG_ROOT, 'onchain-rich-text-editor.usages.json');

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
    // 单一真相源：读 packages/<seg>/package.json 的 name 字段。
    // 过去用 PACKAGE_DIR_TO_NAME 手写 3 条映射（目录名 ≠ 包名），
    // 现在从 package.json 直接拿，目录重命名/包改名自动跟上。
    const pkgJsonPath = path.join(REPO_ROOT, 'packages', seg, 'package.json');
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (typeof pkg.name === 'string') {
        return pkg.name;
      }
    } catch {
      /* 兜底：非 workspace 包或 package.json 缺失 */
    }
    if (seg.startsWith('onchain-')) {
      return seg;
    }
    // The core `lexical` package lives at `packages/lexical/` but is
    // imported as the bare specifier `lexical` (not `@lexical/lexical`).
    // Keep that name aligned with `INLINE_PACKAGES` so its sources —
    // LexicalNode.ts, nodes/LexicalElementNode.ts, … — are recognised
    // and inlined; otherwise the bundle ships dangling references to
    // `ElementNode`, `LexicalNode`, `Klass`, etc.
    if (seg === 'lexical') {
      return 'lexical';
    }
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
    if (INLINE_PACKAGES.has(candidate)) {
      return candidate;
    }
  }
  // Walk up looking for a `package.json` whose `name` is in INLINE_PACKAGES.
  let dir = path.dirname(norm);
  while (dir !== path.dirname(dir)) {
    const pkgJsonPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const n = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).name;
        if (typeof n === 'string' && INLINE_PACKAGES.has(n)) {
          return n;
        }
      } catch {
        /* malformed pkg.json, keep walking up */
      }
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
    if (visited.has(fileName)) {
      continue;
    }
    visited.add(fileName);
    const sf = program.getSourceFile(fileName);
    if (!sf) {
      continue;
    }
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
        if (target) {
          queue.push(target);
        }
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
  if (m) {
    return m[0];
  }
  m = norm.match(/^.*\/packages\/[^/]+\/dist(?=\/|$)/);
  if (m) {
    return m[0].replace(/\/dist$/, '/src');
  }
  m = norm.match(
    /^.*\/node_modules\/\.pnpm\/[^/]+\/node_modules\/[^/]+\/src(?=\/|$)/,
  );
  if (m) {
    return m[0];
  }
  m = norm.match(
    /^.*\/node_modules\/\.pnpm\/[^/]+\/node_modules\/[^/]+\/dist(?=\/|$)/,
  );
  if (m) {
    return m[0].replace(/\/dist$/, '/src');
  }
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
function buildBundle({inlinedSourceToDts, entryDts}) {
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
  out.push(
    '// ---------- entry: ' +
      path.relative(REPO_ROOT, ENTRY).replace(/\\/g, '/') +
      ' ----------',
  );
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
  const importRe =
    /^import\s+(type\s+)?(?:(?:\*\s+as\s+([A-Za-z_$][\w$]*)|([A-Za-z_$][\w$]*))(?:\s*,\s*)?)?(?:\{([^}]*)\})?\s*from\s+['"]([^'"]+)['"]\s*;?\s*$/;
  // Pre-scan.
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(importRe);
    if (!m) {
      continue;
    }
    const [, typeMod, nsName, defName, named, spec] = m;
    const isType = Boolean(typeMod);
    if (named !== undefined) {
      const names = new Set();
      for (const rawName of named.split(',')) {
        let n = rawName.trim();
        if (!n) {
          continue;
        }
        if (n.startsWith('type ')) {
          n = n.slice(5).trim();
        }
        if (n) {
          names.add(n);
        }
      }
      if (!specToNamed.has(spec)) {
        specToNamed.set(spec, {firstIndex: i, isType, names});
      } else {
        const prev = specToNamed.get(spec);
        for (const n of names) {
          prev.names.add(n);
        }
        if (!isType) {
          prev.isType = false;
        }
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
    if (named.names.size === 0) {
      continue;
    }
    const sorted = Array.from(named.names).sort();
    const typeMod = named.isType ? 'type ' : '';
    const binding = specToBinding.get(spec);
    let line;
    if (
      binding &&
      binding.kind === 'default' &&
      binding.firstIndex === named.firstIndex
    ) {
      // The original line was already `import X, { ... } from ...`
      // — keep its shape, but use the merged name list.
      const leading = binding.isType ? 'type ' : '';
      line = `import ${leading}${binding.name}, ${typeMod}{ ${sorted.join(
        ', ',
      )} } from '${spec}';`;
      replaceAt.set(binding.firstIndex, line);
    } else if (binding) {
      // Default + named: emit on the binding's line.
      const leading = binding.isType ? 'type ' : '';
      line = `import ${leading}${binding.name}, ${typeMod}{ ${sorted.join(
        ', ',
      )} } from '${spec}';`;
      replaceAt.set(binding.firstIndex, line);
    } else {
      line = `import ${typeMod}{ ${sorted.join(', ')} } from '${spec}';`;
      replaceAt.set(named.firstIndex, line);
    }
  }
  for (const [spec, binding] of specToBinding) {
    if (replaceAt.has(binding.firstIndex)) {
      continue;
    }
    // Standalone binding (no merged named clause to add).
    const leading = binding.isType ? 'type ' : '';
    const body = binding.kind === 'ns' ? `* as ${binding.name}` : binding.name;
    replaceAt.set(
      binding.firstIndex,
      `import ${leading}${body} from '${spec}';`,
    );
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
        `tsconfig option error: ${ts.flattenDiagnosticMessageText(
          err.messageText,
          '\n',
        )}`,
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
    ...Array.from(inlinedFiles).filter((f) => !baseRootNames.includes(f)),
    ...Array.from(ambientFiles).filter((f) => !baseRootNames.includes(f)),
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
    if (!fileName.endsWith('.d.ts')) {
      continue;
    }
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
    if (path.resolve(f) === path.resolve(ENTRY)) {
      continue;
    }
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
    if (!text) {
      continue;
    }
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
  // Cache is keyed on source file path and stores the actual set
  // of names discovered. The previous implementation used a
  // `Set<string>` and returned an empty set on re-hit; that turned
  // every "second look at the same file" into a silent wipe when
  // the caller stored the result into a map (which then dropped
  // the entry's `export * from 'spec'` because the map's value had
  // been overwritten with `[]`). Caching the populated set makes
  // the function idempotent across calls — re-hits return the
  // exact same names, so any downstream `Map.set(spec, names)` is
  // a no-op instead of a wipe.
  const exportedNamesCache = new Map();
  function collectExportedNames(sf, fromFile) {
    const names = new Set();
    if (!sf) {
      return names;
    }
    if (exportedNamesCache.has(sf.fileName)) {
      return exportedNamesCache.get(sf.fileName);
    }
    // Insert the in-progress set BEFORE recursing so a cyclic
    // `export *` graph (a → b → a) doesn't infinite-loop. The set
    // is empty at this point; the outer call will mutate it as it
    // discovers names, and any re-entrant call during that walk
    // sees the partial view (which still terminates the cycle).
    exportedNamesCache.set(sf.fileName, names);
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
        if (
          inner.exportClause &&
          inner.exportClause.kind === ts.SyntaxKind.NamedExports
        ) {
          for (const elt of inner.exportClause.elements) {
            const exportedName = elt.name.text;
            names.add(exportedName);
          }
        } else if (!inner.exportClause) {
          // `export * from './subpath'` — recurse into the
          // subpath's source and union in its exported names.
          const subSpec = inner.moduleSpecifier?.text;
          if (subSpec) {
            const subTarget = resolveModule(sf.fileName, subSpec, program);
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
    // `collectExportedNames` keeps a `visitedForNames` cache keyed
    // on `sf.fileName`, so calling it twice with the same spec
    // returns an empty set on the second hit. We must NOT let that
    // empty set overwrite the populated one — otherwise a later
    // `export * from 'onchain-lexical-instance'` (which the entry
    // also has a `import type { ... } from 'onchain-lexical-instance'`
    // for) gets dropped at re-export time, since
    // `rewriteEntryReexports` deletes `export * from 'spec'` clauses
    // whose `specToExportedNames` map has an empty entry.
    if (specToExportedNames.has(spec)) {
      continue;
    }
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
    if (!text) {
      return undefined;
    }
    // Common emitted shape: `declare const _default: ...; export default _default;`
    let m = text.match(
      /^declare\s+(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)\b[\s\S]*?^export\s+default\s+\1\s*;/m,
    );
    if (m) {
      return m[1];
    }
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
    if (!resolved) {
      continue;
    }
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
              if (ts.isCallExpression(cur) && cur.arguments.length > 0) {
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
    if (path.resolve(f) !== path.resolve(ENTRY)) {
      continue;
    }
    const dtsFile = sourceToDts.get(f);
    if (dtsFile && emitMap.has(dtsFile)) {
      entryDts = emitMap.get(dtsFile);
      break;
    }
  }
  if (!entryDts) {
    for (const key of emitMap.keys()) {
      if (/lexical-playground[\\\/]src[\\\/]index\.d\.ts$/.test(key)) {
        entryDts = emitMap.get(key);
        break;
      }
    }
  }
  if (!entryDts) {
    console.error('Available emitMap keys (first 20):');
    for (const k of emitMap.keys()) {
      if (k.includes('playground')) {
        console.error('  ' + k);
      }
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

  // Public-surface check: every name the entry's `export *` /
  // `export { X } from` clauses pull in must end up in the entry
  // section's `export { ... }` lines. The `tsc --noEmit` pass above
  // can't catch this — it only sees the bundle's own types, not
  // what consumers `import { ... } from 'onchain-rich-text-editor'`.
  // See [[bundle-types-collectexportednames-cache-overwrite]].
  verifyPublicSurface();
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
 * 验证 entry 段的公开 API 表面，对照 `REQUIRED_PUBLIC_NAMES` 与
 * `REQUIRED_DEFAULT_REEXPORTS` 两个白名单逐一断言。
 *
 * 为什么需要这一步：`tsc --noEmit` 自检只能发现 bundle 内部的类型
 * 错误（找不到标识符、悬挂的 import 等）。它发现不了"声明在
 * bundle 里但 entry 没导出"这种错误——正是 `collectExportedNames`
 * 缓存覆盖 bug 的故障模式：entry 的 `export * from
 * 'onchain-lexical-instance'` 被丢掉，`$isInstanceNode` /
 * `InstanceNode` / `INSERT_PARAMETERS` / `useContentEditable` 等
 * 声明躺在内联段里没被 export，消费者那边 import 时拿到 TS2459
 * / TS2724，但脚本内部一切看起来都正常。
 *
 * 本函数能捕获的回归：
 *   - 任意 `export * from 'spec'`（spec 在 INLINE_PACKAGES 中）没
 *     被展开成 entry 段的 `export { ... };`。
 *   - 任意 `export { X } from 'spec'` 丢失了要导出的名字。
 *   - 默认重导出 `export { default as X }` 变成 `export { _X as X };`
 *     ——通过 `REQUIRED_DEFAULT_REEXPORTS` 验证。
 *
 * 本函数**不能**捕获的回归：
 *   - 消费者要 import 但 entry 从来没打算导出的符号。给 entry 加新
 *     公开导出时，记得同步更新下面的两个白名单。
 *
 * 维护说明：
 *   - `REQUIRED_PUBLIC_NAMES` 的 key 是 entry 文件里的 import /
 *     export spec 字面量（不一定是包名，可以是 `./commenting`
 *     这样的相对路径）。value 是消费者通过 `import { ... } from
 *     'onchain-rich-text-editor'` 会用到的名字数组。增删 entry
 *     里的 export 时同步增删这里。
 *   - `REQUIRED_DEFAULT_REEXPORTS` 的 key 是 `export { default as X }
 *     from 'spec'` 里的 spec，value 是 X。脚本会把这条 rewrite 成
 *     `declare const _X; export { _X as X };`，所以这里断言 X
 *     出现在 entry 的 `export {` 行里。
 *   - 两张表都按 key 的 ASCII 顺序排列，便于 review。
 *
 * 自生成层（A）：parseEntryReexports 自动从 src/index.ts AST 提取
 * 每个 spec 的 namedRequired / defaultRequired。下面两个白名单
 * 留作 fallback / 文档；verifyPublicSurface 优先用 parseEntryReexports
 * 的输出。
 */
/**
 * 扫 entry 文件 AST，输出两份表：
 *   - defaultRequired: Map<spec, Set<X>>
 *     - `export { default as X } from 'spec'` → X
 *   - namedRequired: Map<spec, Set<对外名>>
 *     - `export { A, B } from 'spec'`              → A、B
 *     - `export * from 'spec'`                     → 递归子 spec AST，收集全部具名导出
 *     - `export type { X } from 'spec'`            → X
 *     - `import type { X } from 'spec'`            → X（import type 把名字引入
 *       作用域，需要 entry 公开才能被消费方透传）
 *
 * "对外名"是消费方 `import { Y } from 'onchain-rich-text-editor'` 看到
 * 的名字——`{ A as B }` 这种 alias 取右边的 B。
 *
 * 独立模块作用域函数——自己 build 一个轻量 TS program（基于 tsconfig）
 * + 自己的 collectExportedNames 闭包（独立 cache），不污染 main() 里
 * 的缓存。多花 1-3 秒但语义最干净，不需要把 main() 的 program 透出来。
 */
function parseEntryReexports() {
  const rawOptions = loadTsConfig(TSCONFIG);
  const converted = ts.convertCompilerOptionsFromJson(rawOptions, REPO_ROOT);
  const program = ts.createProgram({
    options: {
      ...converted.options,
      noEmit: true,
      skipLibCheck: true,
    },
    // 加 ambient 文件，跟 main() 保持一致——workspace 包引用
    // `__DEV__` / `VITE_IS_DEVELOPMENT` 等 ambient 全局，没这些
    // 文件的 program 解析某些 spec 会失败。
    rootNames: [
      ENTRY,
      path.join(REPO_ROOT, 'global.d.ts'),
      path.join(REPO_ROOT, 'libdefs', 'globals.d.ts'),
      path.join(REPO_ROOT, 'libdefs', 'environment.js'),
    ],
  });
  const entrySf = program.getSourceFile(ENTRY);

  // 独立 cache，不共享 main() 里的 exportedNamesCache。
  // 当前 parseEntryReexports 的主分支不调用 _collectNames（export *
  // 已改成 skip）；保留它以便未来要展开子 spec 时直接复用。
  const namesCache = new Map();
  function _collectNames(sf) {
    const names = new Set();
    if (!sf) {
      return names;
    }
    if (namesCache.has(sf.fileName)) {
      return namesCache.get(sf.fileName);
    }
    namesCache.set(sf.fileName, names);
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
      } else if (ts.isExportDeclaration(inner)) {
        if (
          inner.exportClause &&
          inner.exportClause.kind === ts.SyntaxKind.NamedExports
        ) {
          for (const elt of inner.exportClause.elements) {
            const exportedName = elt.name.text;
            names.add(exportedName);
          }
        } else if (!inner.exportClause) {
          const subSpec = inner.moduleSpecifier?.text;
          if (subSpec) {
            const subTarget = resolveModule(sf.fileName, subSpec, program);
            if (subTarget) {
              const subSf = program.getSourceFile(subTarget);
              for (const n of _collectNames(subSf)) {
                names.add(n);
              }
            }
          }
        }
      }
    }
    return names;
  }

  const defaultRequired = new Map();
  const namedRequired = new Map();
  const starRequired = new Map();
  const addNamed = (spec, name) => {
    if (!namedRequired.has(spec)) {
      namedRequired.set(spec, new Set());
    }
    namedRequired.get(spec).add(name);
  };
  const addDefault = (spec, name) => {
    if (!defaultRequired.has(spec)) {
      defaultRequired.set(spec, new Set());
    }
    defaultRequired.get(spec).add(name);
  };
  const addStar = (spec, name) => {
    if (!starRequired.has(spec)) {
      starRequired.set(spec, new Set());
    }
    starRequired.get(spec).add(name);
  };
  if (!entrySf) {
    return {defaultRequired, namedRequired, starRequired};
  }
  for (const stmt of entrySf.statements) {
    if (ts.isExportDeclaration(stmt)) {
      const spec = stmt.moduleSpecifier?.text;
      if (!spec) {
        continue;
      }
      if (
        stmt.exportClause &&
        stmt.exportClause.kind === ts.SyntaxKind.NamedExports
      ) {
        for (const elt of stmt.exportClause.elements) {
          // elt.name = 对外名；elt.propertyName = 源端名（alias 左边）。
          const exportedName =
            elt.name && ts.isIdentifier(elt.name) ? elt.name.text : null;
          if (!exportedName) {
            continue;
          }
          if (
            elt.propertyName &&
            ts.isIdentifier(elt.propertyName) &&
            elt.propertyName.text === 'default'
          ) {
            addDefault(spec, exportedName);
          } else {
            addNamed(spec, exportedName);
          }
        }
      } else if (!stmt.exportClause) {
        // `export * from 'spec'`：entry 段把这条保留为 `export * from`
        // 不展平（见 rewriteEntryReexports），但消费方能通过它拿到子 spec
        // 的全部具名导出。所以收集到 starRequired，供 verifyPublicSurface
        // 消费方契约层放行用——避免"消费方用了 X，但 entry 没显式 export"
        // 误报。
        const resolved = resolveModule(entrySf.fileName, spec, program);
        if (resolved) {
          const subSf = program.getSourceFile(resolved);
          for (const n of _collectNames(subSf)) {
            addStar(spec, n);
          }
        }
      }
    } else if (ts.isImportDeclaration(stmt)) {
      // `import type { X } from 'spec'`：X 引入作用域，entry 必须公开
      // 才能让消费方透传。`import X from 'spec'` 不计入。
      const spec = stmt.moduleSpecifier?.text;
      if (!spec) {
        continue;
      }
      if (
        stmt.importClause &&
        stmt.importClause.namedBindings &&
        stmt.importClause.namedBindings.kind === ts.SyntaxKind.NamedImports
      ) {
        for (const elt of stmt.importClause.namedBindings.elements) {
          if (elt.name && ts.isIdentifier(elt.name)) {
            addNamed(spec, elt.name.text);
          }
        }
      }
    }
  }
  return {defaultRequired, namedRequired, starRequired};
}

function verifyPublicSurface() {
  const entryText = fs.readFileSync(OUTPUT, 'utf8');
  // 只看 entry 段的 `export { ... }` / `export type { ... }` 行：
  // buildBundle 把 entry 段写在最后，前面是所有内联段。
  const entryMarkerRegex = /\/\/ ---------- entry: /;
  const entryStart = entryText.search(entryMarkerRegex);
  if (entryStart < 0) {
    console.error(
      '[public-surface] FAIL: 找不到 entry 段标记。bundle-types.mjs 不再写 ' +
        '"// ---------- entry: ..." 分隔头了——需要同步更新 verifyPublicSurface。',
    );
    process.exit(1);
  }
  const entrySection = entryText.slice(entryStart);
  const entryExports = new Set();
  // 匹配 `export { A, B as C, ... };` 和 `export type { A, B };`。
  // `X as Y` 这种形式：左边 X 是源端名字，右边 Y 是对外名字——消费
  // 者 `import { Y }` 时看到的是 Y，所以这里把 Y 收进集合。
  const exportRe = /export\s+(?:type\s+)?\{([^}]*)\}\s*;?/g;
  let m;
  while ((m = exportRe.exec(entrySection)) !== null) {
    for (const raw of m[1].split(',')) {
      const item = raw.trim();
      if (!item) {
        continue;
      }
      const asMatch = item.match(/^(.+?)\s+as\s+(.+)$/);
      entryExports.add(asMatch ? asMatch[2].trim() : item);
    }
  }

  // (A) 自生成：parseEntryReexports 自己 build 一个轻量 program
  //     + 自己有 collectExportedNames 闭包（独立 cache），不污染
  //     main() 里的缓存。多花 1-3 秒但语义最干净。
  const {defaultRequired, namedRequired, starRequired} = parseEntryReexports();

  const failures = [];
  for (const [spec, names] of namedRequired) {
    for (const name of names) {
      if (!entryExports.has(name)) {
        failures.push(`  - ${spec}: 缺少公开导出 "${name}"`);
      }
    }
  }
  for (const [spec, names] of defaultRequired) {
    for (const name of names) {
      if (!entryExports.has(name)) {
        failures.push(`  - ${spec}: 缺少默认重导出 "${name}"`);
      }
    }
  }

  // (B) 消费方契约：叠加 PLM-RIA-Frontend 提供的 usages.json；缺
  //     失不强制 exit（INFO），避免消费方忘了 dump 就 block CI。
  //     entry 通过 `export * from 'spec'` 间接公开的名字也算可达——
  //     starRequired 把每个 spec 的全部具名展开后并集允许放行。
  const starUnion = new Set();
  for (const names of starRequired.values()) {
    for (const n of names) {
      starUnion.add(n);
    }
  }
  if (fs.existsSync(USAGES_FILE)) {
    const usages = JSON.parse(fs.readFileSync(USAGES_FILE, 'utf8'));
    const consumerNames = new Set(usages.names || []);
    // rawNames 是消费方 alias 引入时的源端名（`import { X as Y }` 的 X）。
    // entry 暴露的是 X，消费方代码里写 Y——entryExports 只有 X，所以
    // 把 rawNames 也并入放行集合。
    const consumerRawNames = new Set(usages.rawNames || []);
    // aliases: 对外名 Y → 原始名 X。Y 缺失时，只要 X 出现在 entry 就放行
    // （这是消费方侧的别名引入，entry 不需要再额外导出 Y）。
    const aliases = usages.aliases || {};
    const allowed = new Set([
      ...entryExports,
      ...starUnion,
      ...consumerRawNames,
    ]);
    let aliasRescued = 0;
    for (const name of consumerNames) {
      if (allowed.has(name)) {
        continue;
      }
      const raw = aliases[name];
      if (raw && (entryExports.has(raw) || starUnion.has(raw))) {
        aliasRescued++;
        continue;
      }
      failures.push(
        `  - 消费方导入了 "${name}"，但 entry 未公开。` +
          ` 在 src/index.ts 加 export { ${name} } 或更新 usages.json。`,
      );
    }
    console.error(
      `[public-surface] 消费方契约: ${consumerNames.size} 个名字已校验` +
        `（${USAGES_FILE}；star 间接公开 ${starUnion.size} 个、` +
        `消费方 alias 源端 ${consumerRawNames.size} 个、` +
        `alias 重定向放行 ${aliasRescued} 个）。`,
    );
  } else {
    console.error(
      `[public-surface] INFO: 未找到 ${USAGES_FILE}，` +
        `跳过消费方契约校验。在 PLM-RIA-Frontend 跑 ` +
        `scripts/dump-onchain-rich-text-editor-usages.mjs 生成。`,
    );
  }

  if (failures.length > 0) {
    console.error(
      '[public-surface] FAIL: bundle 缺失以下公开导出。\n' +
        '通常是某条 `export * from "spec"` 被 rewriteEntryReexports 丢掉——' +
        '查 collectExportedNames 缓存和 exportFrom 解析。\n' +
        failures.join('\n'),
    );
    process.exit(1);
  }
  console.error(
    `[public-surface] OK: entry 段共 ${entryExports.size} 个名字，` +
      `所有声明与消费方契约均通过。`,
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
  if (!m) {
    return null;
  }
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
    if (!mapped) {
      return whole;
    }
    const subpath = mapped.subpath.replace(/\.(ts|tsx|d\.ts)$/, '');
    const target =
      subpath === 'index' ? mapped.name : `${mapped.name}/${subpath}`;
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
      out.push(lines[i].replace(/^(\s*)export\s+default\s+/, '$1'));
      continue;
    }
    // `export default class Foo ...` — same treatment.
    if (/^export\s+default\s+class\b/.test(trimmed)) {
      out.push(lines[i].replace(/^(\s*)export\s+default\s+/, '$1'));
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
 * Only counts truly top-level names — declarations inside
 * `declare global { ... }` are GLOBAL AUGMENTATIONS, not module
 * declarations. Multiple sections can each declare
 * `declare global { interface Window { ... } }` and TypeScript
 * merges them naturally; the dedup logic must NOT rename or drop
 * those, otherwise the augmentation stops augmenting.
 *
 * Returns names declared both at top level and inside
 * `declare global { ... }` blocks. Callers that need to decide
 * between the two should use `topLevelOnlyDeclNames` /
 * `globalAugmentationNames` instead.
 *
 * @param {string} text
 * @returns {string[]} names in source order
 */
function topLevelDeclNames(text) {
  const top = topLevelOnlyDeclNames(text);
  const global = globalAugmentationNames(text);
  return [...top, ...global];
}

/**
 * Names declared at the actual top level of the snippet
 * (`interface Foo`, `type Foo`, `class Foo`, etc., at column 0).
 * Excludes anything inside `declare global { ... }` blocks — those
 * are global augmentations that merge in TS, not module-local
 * declarations that would collide if renamed.
 */
function topLevelOnlyDeclNames(text) {
  const names = [];
  const re =
    /^(?:declare\s+)?(?:interface|type|class|function|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    names.push(m[1]);
  }
  return names;
}

/**
 * Names declared inside `declare global { ... }` blocks. These are
 * global augmentations (e.g. `interface Window`,
 * `interface HTMLElement`) and merge naturally across sections —
 * the dedup logic must leave them alone.
 */
function globalAugmentationNames(text) {
  const names = [];
  let m;
  const blockRe = /declare\s+global\s*\{/g;
  while ((m = blockRe.exec(text)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
      }
      i += 1;
    }
    const inner = text.slice(start, i - 1);
    // `\s*` matches the indentation of declarations inside
    // `declare global { ... }`.
    const innerRe = /^\s*(?:declare\s+)?(?:interface|type|class|function|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
    let mm;
    while ((mm = innerRe.exec(inner)) !== null) {
      names.push(mm[1]);
    }
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
    // Dedup only top-level module declarations. Names declared
    // inside `declare global { ... }` are global augmentations
    // (`interface Window`, `interface HTMLElement`, …) — TS merges
    // those automatically across sections, so renaming or dropping
    // here would stop them from augmenting the real globals.
    const decls = topLevelOnlyDeclNames(dtsText);
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
        `^(?:declare\\s+)?(?:interface|type|class|function|enum|const|let|var)\\s+${escapeRegExp(
          name,
        )}\\b`,
      );
      let startIdx = -1;
      for (let i = 0; i < trimmed.length; i++) {
        if (re.test(trimmed[i])) {
          startIdx = i;
          break;
        }
      }
      if (startIdx < 0) {
        return '';
      }
      return sliceDeclBody(trimmed);
    };
    // Per-name verdict: 'keep' (no rename), 'drop' (already
    // declared with identical body — verbatim copy), 'rename' (need
    // a new name to avoid collision).
    const verdicts = new Map();
    for (const name of decls) {
      if (seenInSection.has(name)) {
        continue;
      }
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
  if (startIdx < 0) {
    return '';
  }
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
  if (
    renames.length === 0 &&
    [...verdicts.values()].every((v) => v.action === 'keep')
  ) {
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
      if (
        skipName &&
        /\b(skipName)\b/.test(trimmed) === false &&
        braceDepth <= 0
      ) {
        // already past the dropped decl
      }
      // Track braces for both class/interface/enum bodies and
      // function bodies so we don't end the skip too early.
      for (const ch of line) {
        if (ch === '{') {
          braceDepth += 1;
        } else if (ch === '}') {
          braceDepth -= 1;
        }
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
          if (ch === '{') {
            braceDepth += 1;
          } else if (ch === '}') {
            braceDepth -= 1;
          }
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
    if (slash < 0) {
      return spec;
    }
    const secondSlash = spec.indexOf('/', slash + 1);
    return secondSlash < 0 ? spec : spec.slice(0, secondSlash);
  }
  if (spec.startsWith('.') || spec.startsWith('/')) {
    return spec;
  }
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
    if (spec.startsWith('.') || spec.startsWith('/')) {
      return true;
    }
    return inlinedPackageNames.has(specOwner(spec));
  };
  const lines = text.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Multi-line `export {\n  ...\n} from 'spec';` opener. Only
    // enter when the current line has an unbalanced opening brace
    // (more `{` than `}`) — a balanced single-line `export { X }`
    // has its block fully closed and must NOT be treated as the
    // opener of a multi-line block, otherwise the next iteration
    // will greedily slurp the following line's `} from 'spec';`
    // as this block's close and strip unrelated re-exports.
    const openCount = (trimmed.match(/\{/g) || []).length;
    const closeCount = (trimmed.match(/\}/g) || []).length;
    if (/^export\s*\{/.test(trimmed) && openCount > closeCount) {
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
          const closeMatch = t.match(/\}\s*from\s+['"]([^'"]+)['"]\s*;?\s*$/);
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
