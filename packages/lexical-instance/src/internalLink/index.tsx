/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  $applyNodeReplacement,
  EditorConfig,
  LexicalEditor,
  SerializedTextDecoratorNode,
  Spread,
  TextDecoratorNode,
} from 'lexical';
import React from 'react';

import InternalLinkComponent from './internalLinkComponent';

export type SerializedInternalNode = Spread<
  {
    number: string;
  },
  SerializedTextDecoratorNode
>;
export class InternalLinkNode extends TextDecoratorNode<React.ReactNode> {
  __number: string;
  static getType(): string {
    return 'InternalLink';
  }

  static clone(node: InternalLinkNode) {
    return new InternalLinkNode(node.__number, node.__key);
  }

  static importJSON(serializedNode: SerializedInternalNode): InternalLinkNode {
    return $createInternalLinkNode(serializedNode.number).updateFromJSON(
      serializedNode,
    );
  }

  constructor(number: string, key?: string) {
    super(key);
    this.__number = number;
  }

  exportJSON(): SerializedInternalNode {
    return {
      ...super.exportJSON(),
      number: this.__number,
    };
  }

  createDOM(config: EditorConfig, editor?: LexicalEditor): HTMLElement {
    const span = super.createDOM(config, editor);
    span.setAttribute('ignoreusable', '');
    return span;
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    return super.updateDOM(prevNode, dom, config);
  }

  collapseAtStart(): true {
    return true;
  }

  isInline(): boolean {
    return true;
  }

  decorate(editor: LexicalEditor, config: EditorConfig): JSX.Element {
    return (
      <InternalLinkComponent
        editor={editor}
        config={config}
        self={this}
        number={this.__number}
        nodeKey={this.getKey()}
      />
    );
  }
}

export function $createInternalLinkNode(number: string): InternalLinkNode {
  return $applyNodeReplacement(new InternalLinkNode(number));
}

export function $isInternalLinkNode(
  node: InternalLinkNode | null | undefined,
): node is InternalLinkNode {
  return node instanceof InternalLinkNode;
}
