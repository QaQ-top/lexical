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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

export type SerializedInternalNode = Spread<
  {
    parameters: Parameters;
  },
  SerializedTextDecoratorNode
>;
export class ParametersNode extends TextDecoratorNode<React.ReactNode> {
  /** 用于存储参数数据，保证每次读取能获取到最新值 */
  static collection = new Map<string, Parameters>();
  /** 初始化值 */
  __parameters: Parameters;

  /** 最新的值 */
  get parameters() {
    return (
      ParametersNode.collection.get(this.__parameters.number) ||
      this.__parameters
    );
  }

  static getType(): string {
    return 'Parameters';
  }

  static clone(node: ParametersNode) {
    return new ParametersNode(Object.assign({}, node.parameters), node.__key);
  }

  static importJSON(serializedNode: SerializedInternalNode): ParametersNode {
    return $createParametersNode(serializedNode.parameters).updateFromJSON(
      serializedNode,
    );
  }

  constructor(parameters: Parameters, key?: string) {
    super(key);
    this.__parameters = parameters;
  }

  exportJSON(): SerializedInternalNode {
    return {
      ...super.exportJSON(),
      parameters: this.parameters,
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

// export function updateParameters(parameters: Parameters) {
//   return ParametersNode.collection.set(parameters.number, parameters);
// }
