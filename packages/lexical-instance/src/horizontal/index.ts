/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  HorizontalRuleNode,
  SerializedHorizontalRuleNode,
} from '@lexical/react/LexicalHorizontalRuleNode';
import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  LexicalNode,
} from 'lexical';
import {JSX} from 'react';

import {$createInstanceParagraphNode} from '../paragraph';

export class InstanceHorizontalRuleNode extends HorizontalRuleNode {
  static getType(): string {
    return 'HorizontalRule';
  }

  static clone(node: InstanceHorizontalRuleNode): InstanceHorizontalRuleNode {
    return new InstanceHorizontalRuleNode(node.__key);
  }

  static importJSON(
    serializedNode: SerializedHorizontalRuleNode,
  ): InstanceHorizontalRuleNode {
    return $createInstanceHorizontalRuleNode().updateFromJSON(serializedNode);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      hr: () => ({
        conversion: $convertHorizontalRuleElement,
        priority: 0,
      }),
    };
  }
  decorate(): JSX.Element {
    return super.decorate();
  }

  remove(preserveEmptyParent?: boolean): void {
    const node = $createInstanceParagraphNode();
    this.replace(node);
    node.select();
  }
}

function $convertHorizontalRuleElement(): DOMConversionOutput {
  return {node: $createInstanceHorizontalRuleNode()};
}

export function $createInstanceHorizontalRuleNode(): HorizontalRuleNode {
  return $applyNodeReplacement(new InstanceHorizontalRuleNode());
}

export function $isInstanceHorizontalRuleNode(
  node: LexicalNode | null | undefined,
): node is InstanceHorizontalRuleNode {
  return node instanceof InstanceHorizontalRuleNode;
}
