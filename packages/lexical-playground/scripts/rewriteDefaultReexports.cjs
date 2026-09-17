/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
'use strict';

/**
 * Helpers for the entry's `.d.ts` bundle.
 *
 * `rewriteDefaultReexports` runs *before* the strip pass so that
 * `export { default as X } from 'spec'` items survive as
 * `declare const _X: typeof import('spec').default;` lines.
 *
 * CJS so both `bundle-types.mjs` (via createRequire) and Jest
 * (`scripts/__tests__/unit/rewriteDefaultReexports.test.js`) can
 * consume the same source of truth.
 */

/**
 * Find every `export { ... } from 'spec';` (single- or multi-line)
 * in `text` and return an array of matches with their character
 * ranges.
 *
 * @param {string} text
 * @returns {Array<{start: number, end: number, inner: string, spec: string}>}
 */
function findExportFromBlocks(text) {
  const blocks = [];
  const re = /export\s+(?:type\s+)?\{/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const openIdx = m.index;
    const openBraceEnd = openIdx + m[0].length;
    let depth = 1;
    let i = openBraceEnd;
    while (i < text.length && depth > 0) {
      const ch = text[i];
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
      }
      i += 1;
    }
    if (depth !== 0) {
      continue;
    }
    const closeBraceEnd = i;
    const tail = text.slice(closeBraceEnd);
    const tailMatch = tail.match(/^\s*from\s*(['"])([^'"\n]+)\1\s*;?/);
    if (!tailMatch) {
      continue;
    }
    const spec = tailMatch[2];
    const inner = text.slice(openBraceEnd, closeBraceEnd - 1);
    // `export type { X } from 'spec'` — the block-level `type`
    // modifier means every surviving item is a type, even if
    // individual items don't carry a leading `type`. Preserve the
    // flag through to the re-emit so the rewrite keeps the type
    // semantics intact.
    const typeOnly = /\bexport\s+type\s*\{/.test(
      text.slice(openIdx, openBraceEnd),
    );
    blocks.push({
      end: closeBraceEnd + tailMatch[0].length,
      inner,
      spec,
      start: openIdx,
      typeOnly,
    });
    re.lastIndex = closeBraceEnd;
  }
  return blocks;
}

/**
 * Parse the inside of an `export { ... }` block into individual
 * spec items. Each item is one of:
 *   - `{kind: 'plain', name, as}` for `X`
 *   - `{kind: 'alias', name, as}` for `X as Y`
 *   - `{kind: 'default', as}` for `default as X`
 *   - `{kind: 'type-alias', name, as}` for `type X as Y`
 * Whitespace and trailing commas are tolerated.
 *
 * @param {string} inner
 * @returns {Array<
 *   | {kind: 'plain', name: string, as: string}
 *   | {kind: 'alias', name: string, as: string}
 *   | {kind: 'default', as: string}
 *   | {kind: 'type-alias', name: string, as: string}
 * >}
 */
function parseExportSpecItems(inner) {
  const items = [];
  const parts = inner.split(',');
  for (const raw of parts) {
    const piece = raw.trim();
    if (!piece) {
      continue;
    }
    let m;
    if ((m = piece.match(/^type\s+(\S+)\s+as\s+(\S+)$/))) {
      items.push({as: m[2], kind: 'type-alias', name: m[1]});
    } else if ((m = piece.match(/^default\s+as\s+(\S+)$/))) {
      items.push({as: m[1], kind: 'default'});
    } else if ((m = piece.match(/^(\S+)\s+as\s+(\S+)$/))) {
      items.push({as: m[2], kind: 'alias', name: m[1]});
    } else if ((m = piece.match(/^type\s+(\S+)$/))) {
      items.push({as: m[1], kind: 'type-alias', name: m[1]});
    } else if ((m = piece.match(/^(\S+)$/))) {
      items.push({as: m[1], kind: 'plain', name: m[1]});
    }
  }
  return items;
}

/**
 * Rewrite `export { default as X, ... } from 'spec';` so that
 * `default` items become
 * `declare const _X: typeof <Default>;` lines (or
 * `typeof import('spec').default` for specs NOT inlined into the
 * bundle), while the remaining plain / alias items are re-emitted
 * as a normal `export { ... } from 'spec';` (which the strip pass
 * will then remove).
 *
 * Why the inlined-vs-not split matters: the consumer's IDE cannot
 * resolve `import('./App')` once the bundle is shipped — `./App`
 * doesn't exist in their project. When `spec` resolves into a
 * workspace package whose source is inlined into the same flat
 * file, the default's actual name is already in scope; we point
 * the alias at that name directly.
 *
 * @param {string} text
 * @param {Map<string, string>} [inlinedDefaultNames] spec → inlined
 *   default export's identifier name (e.g. `'./App'` → `'PlaygroundApp'`).
 *   When a `default as X` block's `spec` is a key, the generated
 *   `declare const _X` references the inlined name; otherwise it
 *   falls back to `typeof import('spec').default`.
 * @returns {string}
 */
function rewriteDefaultReexports(text, inlinedDefaultNames) {
  const blocks = findExportFromBlocks(text);
  if (blocks.length === 0) {
    return text;
  }
  blocks.sort((a, b) => b.start - a.start);
  let out = text;
  for (const block of blocks) {
    const items = parseExportSpecItems(block.inner);
    const declareLines = [];
    const remaining = [];
    const inlinedName = inlinedDefaultNames
      ? inlinedDefaultNames.get(block.spec)
      : undefined;
    for (const item of items) {
      if (item.kind === 'default') {
        if (inlinedName) {
          declareLines.push(
            `declare const _${item.as}: typeof ${inlinedName};`,
          );
        } else {
          declareLines.push(
            `declare const _${item.as}: typeof import(${JSON.stringify(
              block.spec,
            )}).default;`,
          );
        }
        declareLines.push(`export { _${item.as} as ${item.as} };`);
      } else if (item.kind === 'type-alias') {
        remaining.push(`type ${item.name} as ${item.as}`);
      } else {
        remaining.push(
          `${item.name}${item.as === item.name ? '' : ` as ${item.as}`}`,
        );
      }
    }
    let replacement = '';
    if (declareLines.length > 0) {
      replacement += declareLines.join('\n') + '\n';
    }
    if (remaining.length > 0) {
      const cleaned = remaining.map((p) => p.replace(/^type\s+/, ''));
      const body = cleaned.join(', ');
      replacement += block.typeOnly
        ? `export type { ${body} } from ${JSON.stringify(block.spec)};\n`
        : `export { ${body} } from ${JSON.stringify(block.spec)};\n`;
    }
    if (replacement === '') {
      replacement = '\n';
    }
    out = out.slice(0, block.start) + replacement + out.slice(block.end);
  }
  return out;
}

/**
 * Flatten every `export { ... } from 'spec';` (single- or
 * multi-line, plain or `export type`) and `export * from 'spec';`
 * whose target lives in `inlinedSpecs` into a no-`from`
 * `export { ... };` form so the entry's re-exports survive the
 * upcoming import/export strip pass. The flat bundle otherwise
 * loses every named re-export — `export { LexicalComposer } from
 * '@lexical/react/LexicalComposer'` would be dropped, leaving
 * downstream consumers unable to `import { LexicalComposer }`
 * from the package even though `LexicalComposer` is declared in
 * the bundle's inlined section.
 *
 *   - `export { A, B as C } from 'spec';`  →  `export { A, B as C };`
 *   - `export type { A } from 'spec';`    →  `export type { A };`
 *   - `export * from 'spec';`             →  `export { <all names from spec> };`
 *
 * Specs not in `inlinedSpecs` are left alone (the strip pass
 * keeps them verbatim when the consumer's `node_modules` is
 * expected to resolve them — e.g. `react`, `yjs`).
 *
 * @param {string} text
 * @param {Set<string>} inlinedSpecs
 * @param {Map<string, Set<string>>} specToExportedNames
 * @returns {string}
 */
function rewriteEntryReexports(text, inlinedSpecs, specToExportedNames) {
  if (inlinedSpecs.size === 0) {
    return text;
  }
  const blocks = findExportFromBlocks(text);
  if (blocks.length === 0) {
    return text;
  }
  blocks.sort((a, b) => b.start - a.start);
  let out = text;
  for (const block of blocks) {
    // Flatten any block whose spec is owned by an inlined package —
    // including relative paths like './App' (owned by the entry
    // package itself, which is always in `inlinedSpecs`). Skipping
    // relative paths here leaves `export { buildImportMap } from
    // "./App";` in the entry segment, which the upcoming strip pass
    // then drops wholesale — the consumer's TS sees TS2307 for
    // `./App`.
    const isRelative = block.spec.startsWith('./') || block.spec.startsWith('/') || block.spec.startsWith('../');
    if (!isRelative && !inlinedSpecs.has(block.spec)) {
      continue;
    }
    const items = parseExportSpecItems(block.inner);
    if (items.length === 0) {
      continue;
    }
    const rendered = items.map((it) => {
      switch (it.kind) {
        case 'default':
          // `default as X` was already rewritten to a
          // `declare const _X` block by `rewriteDefaultReexports`,
          // but if a caller invokes this without that pass first,
          // render `X` (the alias) as a plain named export.
          return it.as;
        case 'type-alias':
          return it.as === it.name ? it.name : `${it.name} as ${it.as}`;
        case 'alias':
          return `${it.name} as ${it.as}`;
        case 'plain':
        default:
          return it.name;
      }
    });
    const body = rendered.join(', ');
    const replacement = block.typeOnly
      ? `export type { ${body} };\n`
      : `export { ${body} };\n`;
    out = out.slice(0, block.start) + replacement + out.slice(block.end);
  }
  // Now handle the `export * from 'spec';` lines that
  // `findExportFromBlocks` skips (no brace block). For each inlined
  // spec, expand `*` into its set of exported names.
  const starRe = /export\s+\*\s+from\s*(['"])([^'"\n]+)\1\s*;?/g;
  let m;
  const matches = [];
  while ((m = starRe.exec(out)) !== null) {
    matches.push({
      end: m.index + m[0].length,
      spec: m[2],
      start: m.index,
      text: m[0],
    });
  }
  matches.sort((a, b) => b.start - a.start);
  for (const match of matches) {
    const isRelative = match.spec.startsWith('./') || match.spec.startsWith('/') || match.spec.startsWith('../');
    if (!isRelative && !inlinedSpecs.has(match.spec)) {
      continue;
    }
    const names = specToExportedNames.get(match.spec);
    if (!names || names.size === 0) {
      // No names known — drop the clause. (Anything this re-exported
      // would be in the bundle's inlined section anyway.)
      out = out.slice(0, match.start) + '\n' + out.slice(match.end);
      continue;
    }
    const sorted = Array.from(names).sort();
    out =
      out.slice(0, match.start) +
      `export { ${sorted.join(', ')} };\n` +
      out.slice(match.end);
  }
  return out;
}

/**
 * Strip the leading `export ` keyword from standalone declaration
 * lines (`export declare const X`, `export type X`,
 * `export interface X`, `export function X`, …) in an emitted
 * `.d.ts` snippet. The entry file's `export *` /
 * `export { ... } from` expansion re-exports every public symbol
 * via its own `export { X }` block, so inlined declarations don't
 * need to carry `export` themselves. Keeping `export` here causes
 * TypeScript's TS2323 ("Cannot redeclare exported variable 'X'")
 * the moment both copies land at the top of the same flat file.
 *
 * `export default`, `export { … }`, `export *`, and
 * `export type { … } from 'spec'` are left alone — the dedicated
 * strip pass in `bundle-types.mjs` handles those.
 */
function stripLocalExportKeywords(text) {
  return text.replace(
    /^(\s*)export\s+(?=(?:declare\s+)?(?:const|let|var|function|class|enum|namespace|module|interface|type)\b(?!\s*\{)(?!\s*\*\s+from))/gm,
    '$1',
  );
}

module.exports = {
  findExportFromBlocks,
  parseExportSpecItems,
  rewriteDefaultReexports,
  rewriteEntryReexports,
  stripLocalExportKeywords,
};
