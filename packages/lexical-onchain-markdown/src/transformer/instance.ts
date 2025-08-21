/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {HeadingTagType} from '@lexical/rich-text';
import {
  $createFragmentNode,
  $createInstanceHeadingNode,
  $createInstanceParagraphNode,
  $createTitleOnlyInstanceNode,
  $isInstanceHeadingNode,
  $isInstanceNode,
  $isInstanceParagraphNode,
  $isInstanceTitleNode,
  Instance,
  InstanceHeadingNode,
  InstanceNode,
  InstanceParagraphNode,
  InstanceTitleNode,
} from 'onchain-lexical-instance';

import {$convertFromMarkdownString} from '../fromMarkdownString';
import {
  createBlockNode,
  ElementTransformer,
  MultilineElementTransformer,
} from '../MarkdownTransformers';
import {$convertToMarkdownString} from '../toMarkdownString';
import {TransFormerGather} from '.';
import {
  HEADING_REGEX,
  INS_SYMBOL,
  INSTANCE_END_REGEX,
  INSTANCE_START_REGEX,
} from './const';

export const InstanceTransformer: MultilineElementTransformer = {
  dependencies: [InstanceNode],
  export: (node, exportChildren) => {
    if (!$isInstanceNode(node)) {
      return null;
    }
    const serialNumber = node.getSerialNumber();
    const level = serialNumber.split('-');
    const markdown =
      `<!--${INS_SYMBOL.repeat(level.length)}-->\n` +
      $convertToMarkdownString(TransFormerGather.value, node) +
      `\n<!---->`;
    return markdown;
  },
  regExpEnd: {
    optional: true,
    regExp: INSTANCE_END_REGEX,
  },
  regExpStart: INSTANCE_START_REGEX,
  replace: (
    rootNode,
    children,
    startMatch,
    endMatch,
    linesInBetween,
    isImport,
    instanceMap,
  ) => {
    if (linesInBetween) {
      let instance: Instance | undefined;
      const [number, insDesc] = linesInBetween[1]
        .replace(/^#+/g, '')
        .trim()
        .split(' / ');
      if (instanceMap && instanceMap.has(number)) {
        instance = instanceMap.get(number)!;
      } else if (number) {
        instance = {
          insDesc,
          number,
        } as Instance;
      }
      const node = $createTitleOnlyInstanceNode(instance);
      const fragment = $createFragmentNode();
      $convertFromMarkdownString(
        linesInBetween.slice(1, Infinity).join('\n'),
        TransFormerGather.value,
        fragment,
      );
      const children = fragment.getChildren();
      const nodes = children.slice(2, Infinity);
      const count = InstanceNode.DEFAULT_PARAGRAPHS - 1;
      for (let index = 0; index < count; index++) {
        const node = nodes[0];
        if (!node /**  || !$isInstanceParagraphNode(node) */) {
          children.splice(index, 0, $createInstanceParagraphNode());
        }
      }
      node.append(...children);
      rootNode.append(node);
    }
  },
  type: 'multiline-element',
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
      if (instanceNode && instanceNode.__instance.value) {
        number = `${instanceNode.__instance.value.number} / `;
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
