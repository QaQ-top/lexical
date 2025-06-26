/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {HeadingTagType} from '@lexical/rich-text';
import {
  $createBaseInstanceNode,
  $createInstanceHeadingNode,
  $isInstanceHeadingNode,
  $isInstanceNode,
  $isInstanceParagraphNode,
  $isInstanceTitleNode,
  InstanceHeadingNode,
  InstanceNode,
  InstanceParagraphNode,
  InstanceTitleNode,
} from 'onchain-lexical-instance';

import {createBlockNode, ElementTransformer} from '../MarkdownTransformers';
import {$convertToMarkdownString} from '../toMarkdownString';
import {TransFormerGather} from '.';
import {HEADING_REGEX, INS_SYMBOL, INSTANCE_START_REGEX} from './const';

export const InstanceTransformer: ElementTransformer = {
  dependencies: [InstanceNode],
  export: (node, exportChildren) => {
    if (!$isInstanceNode(node)) {
      return null;
    }
    const serialNumber = node.getSerialNumber();
    const level = serialNumber.split('-');
    const markdown =
      `<!--${INS_SYMBOL.repeat(level.length)}-->` +
      $convertToMarkdownString(TransFormerGather.value, node) +
      `\n<!---->`;
    return markdown;
  },
  regExp: INSTANCE_START_REGEX,
  replace: createBlockNode((match) => {
    return $createBaseInstanceNode();
  }),
  type: 'element',
};

export const InstanceHeadingTransformer: ElementTransformer = {
  dependencies: [InstanceHeadingNode, InstanceTitleNode, InstanceParagraphNode],
  export: (node, exportChildren) => {
    if ($isInstanceParagraphNode(node) && node.isTitle) {
      const str = $convertToMarkdownString(TransFormerGather.value, node);
      return str;
    } else {
      if (!$isInstanceHeadingNode(node)) {
        return null;
      }
      const level = Number(node.getTag().slice(1));
      let number = '';
      const instanceNode = $isInstanceTitleNode(node) && node.getInstanceNode();
      if (instanceNode && instanceNode.__instance) {
        number = `${instanceNode.__instance.number} / `;
      }
      return '#'.repeat(level) + ' ' + number + exportChildren(node);
    }
  },
  regExp: HEADING_REGEX,
  replace: createBlockNode((match) => {
    const tag = ('h' + match[1].length) as HeadingTagType;
    return $createInstanceHeadingNode(tag);
  }),
  type: 'element',
};
