/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {ElementNode} from 'lexical';

import {createMarkdownExport} from './MarkdownExport';
import {Transformer} from './MarkdownTransformers';
import {TransFormerGather} from './transformer';

export function $convertToMarkdownString(
  transformers: Array<Transformer> = TransFormerGather.value,
  node?: ElementNode,
  shouldPreserveNewLines: boolean = false,
): string {
  const exportMarkdown = createMarkdownExport(
    transformers,
    shouldPreserveNewLines,
  );
  return exportMarkdown(node);
}
