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
  LexicalNode,
  SerializedTextDecoratorNode,
  Spread,
  TextDecoratorNode,
} from 'lexical';
import React from 'react';

import ParametersComponent from './parametersComponent';

export interface Parameters {
  value: string;
  number: string;
}

export type SerializedInternalNode = Spread<
  {
    parameters: Parameters;
  },
  SerializedTextDecoratorNode
>;
export class ParametersNode extends TextDecoratorNode<React.ReactNode> {
  __parameters: Parameters;
  static getType(): string {
    return 'Parameters';
  }

  static clone(node: ParametersNode) {
    return new ParametersNode(node.__parameters, node.__key);
  }

  static importJSON(serializedNode: SerializedInternalNode): ParametersNode {
    return $createParametersNode(serializedNode.parameters).updateFromJSON(
      serializedNode,
    );
  }

  constructor(number: Parameters, key?: string) {
    super(key);
    this.__parameters = number;
  }

  exportJSON(): SerializedInternalNode {
    return {
      ...super.exportJSON(),
      parameters: this.__parameters,
    };
  }

  createDOM(config: EditorConfig, editor?: LexicalEditor): HTMLElement {
    const span = super.createDOM(config, editor);
    span.setAttribute('ignorecontenteditable', '');
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
    return <ParametersComponent nodeKey={this.getKey()} />;
  }
}

export function $createParametersNode(parameters: Parameters): ParametersNode {
  return $applyNodeReplacement(new ParametersNode(parameters));
}

export function $isParametersNode(
  node: LexicalNode | null | undefined,
): node is ParametersNode {
  return node instanceof ParametersNode;
}
