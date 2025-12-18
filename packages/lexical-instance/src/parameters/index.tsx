/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedTextDecoratorNode,
  SerializedTextNode,
  Spread,
  TextDecoratorNode,
  TextNode,
} from 'lexical';
import {toBase64UTF8} from 'onchain-utility/base64';
import React from 'react';

import ParametersComponent from './parametersComponent';
import {ParametersRef} from './types';

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

  __ref = React.createRef<ParametersRef>();

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
  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement('section');
    element.setAttribute('parameter', '');
    element.setAttribute(
      'data-parameter',
      toBase64UTF8(JSON.stringify(this.parameters)),
    );
    element.textContent = this.parameters.value;
    return {element};
  }

  createDOM(config: EditorConfig, editor?: LexicalEditor): HTMLElement {
    const span = super.createDOM(config, editor);
    span.setAttribute('ignoreusable', '');
    span.setAttribute('key', this.getKey());
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

  getTextContent(): string {
    return this.__ref.current?.getValue() || '';
  }

  decorate(editor: LexicalEditor, config: EditorConfig): JSX.Element {
    return <ParametersComponent ref={this.__ref} nodeKey={this.getKey()} />;
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

class TestNode extends TextNode {
  static getType(): string {
    return 'Parameters';
  }
  static clone(node: TestNode): TestNode {
    return new TestNode(node.__text, node.__key);
  }

  static importDOM(): DOMConversionMap | null {
    return TextNode.importDOM();
  }

  static importJSON(serializedNode: SerializedTextNode): TextNode {
    return $createTestNode().updateFromJSON(serializedNode);
  }
}

export function $createTestNode(text = ''): TestNode {
  return $applyNodeReplacement(new TestNode(text));
}

export function $isTestNode(
  node: LexicalNode | null | undefined,
): node is TestNode {
  return node instanceof TestNode;
}
