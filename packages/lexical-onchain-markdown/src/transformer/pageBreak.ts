/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {LexicalNode} from 'lexical';
import {
  $createPageBreakNode,
  $isPageBreakNode,
  PageBreakNode,
} from 'onchain-lexical-instance';

import {ElementTransformer} from '../MarkdownTransformers';

export const PAGE_BREAK: ElementTransformer = {
  dependencies: [PageBreakNode],
  export: (node: LexicalNode) => {
    if ($isPageBreakNode(node)) {
      return `<!--***-->`;
    }
    return null;
  },
  regExp: /^<!--(---|\*\*\*|___)-->$/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createPageBreakNode();

    // TODO: Get rid of isImport flag
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }

    line.selectNext();
  },
  type: 'element',
};
