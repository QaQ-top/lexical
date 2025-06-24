/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {Instance} from '@onchain/lexical-instance';
import {ElementNode} from 'lexical';

import {createMarkdownImport} from './MarkdownImport';
import {normalizeMarkdown, Transformer} from './MarkdownTransformers';
import {TransFormerGather} from './transformer';

/**
 * Renders markdown from a string. The selection is moved to the start after the operation.
 *
 *  @param {boolean} [shouldPreserveNewLines] By setting this to true, new lines will be preserved between conversions
 *  @param {boolean} [shouldMergeAdjacentLines] By setting this to true, adjacent non empty lines will be merged according to commonmark spec: https://spec.commonmark.org/0.24/#example-177. Not applicable if shouldPreserveNewLines = true.
 */
export function $convertFromMarkdownString(
  markdown: string,
  transformers: Array<Transformer> = TransFormerGather.value,
  node?: ElementNode,
  shouldPreserveNewLines = false,
  shouldMergeAdjacentLines = false,
  instanceMap?: Map<string, Instance>,
): void {
  const sanitizedMarkdown = shouldPreserveNewLines
    ? markdown
    : normalizeMarkdown(markdown, shouldMergeAdjacentLines);
  const importMarkdown = createMarkdownImport(
    transformers,
    shouldPreserveNewLines,
    instanceMap,
  );
  return importMarkdown(sanitizedMarkdown, node);
}
