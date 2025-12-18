/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  $applyNodeReplacement,
  BaseSelection,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedTextDecoratorNode,
  Spread,
  TextDecoratorNode,
} from 'lexical';
import React from 'react';

import {$getInstanceNodeByNumber, getLatestValue} from '../utils';
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

  // get contentEditable() {
  //   return 'true'
  // }

  exportJSON(): SerializedInternalNode {
    return {
      ...super.exportJSON(),
      number: this.__number,
    };
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement('section');
    element.setAttribute('internal-link', '');
    element.setAttribute('data-internal-link-number', this.__number);
    element.textContent = this.getTextContent();
    return {element};
  }

  createDOM(config: EditorConfig, editor?: LexicalEditor): HTMLElement {
    const span = super.createDOM(config, editor);
    span.setAttribute('ignoreusable', '');
    span.setAttribute('decorator', 'text');
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

  isSelected(selection?: null | BaseSelection): boolean {
    return true;
  }

  getTextContent(): string {
    const insNode = $getInstanceNodeByNumber(this.__number);
    if (insNode) {
      return getLatestValue(insNode.__instance.value, 'insDesc') || '';
    }
    return '';
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
  node: LexicalNode | null | undefined,
): node is InternalLinkNode {
  return node instanceof InternalLinkNode;
}
