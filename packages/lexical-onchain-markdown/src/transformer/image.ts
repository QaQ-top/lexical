/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  $createImageNode,
  $isImageNode,
  ImageNode,
} from 'onchain-lexical-instance';

import {TextMatchTransformer} from '../MarkdownTransformers';

export const IMAGE: TextMatchTransformer = {
  dependencies: [ImageNode],
  export: (node) => {
    if ($isImageNode(node)) {
      return `![${node.getAltText()}](${node.getSrc()})`;
    }
    return null;
  },
  importRegExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))/,
  regExp: /!(?:\[([^[]*)\])(?:\(([^(]+)\))$/,
  replace: (textNode, match) => {
    const [, altText, src] = match;
    const imageNode = $createImageNode({
      altText,
      maxWidth: 800,
      src,
    });
    textNode.replace(imageNode);
  },
  sort: 0.9,
  trigger: ')',
  type: 'text-match',
};
