/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  $applyNodeReplacement,
  DOMExportOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedTextDecoratorNode,
  Spread,
  TextDecoratorNode,
} from 'lexical';
import {ParameterUnified} from 'onchain-lexical-context/instanceConfig';
import {toBase64UTF8} from 'onchain-utility/base64';
import React from 'react';

import ParametersComponent from './parametersComponent';
import {Parameter, ParameterRef} from './types';

export type SerializedInternalNode = Spread<
  {
    parameter: Parameter;
  },
  SerializedTextDecoratorNode
>;
export class ParametersNode extends TextDecoratorNode<React.ReactNode> {
  /** 初始化值 */
  __parameter: {
    isolation: Parameter;
  };

  __ref = React.createRef<ParameterRef>();

  /** 最新的值 */
  get parameter() {
    return this.__parameter.isolation;
  }

  static getType(): string {
    return 'Parameter';
  }

  static clone(node: ParametersNode) {
    return new ParametersNode(Object.assign({}, node.parameter), node.__key);
  }

  static importJSON(serializedNode: SerializedInternalNode): ParametersNode {
    return $createParametersNode(serializedNode.parameter).updateFromJSON(
      serializedNode,
    );
  }

  constructor(parameter: Parameter, key?: string) {
    super(key);
    this.__parameter = {
      isolation: parameter,
    };
  }

  exportJSON(): SerializedInternalNode {
    return {
      ...super.exportJSON(),
      parameter: this.parameter,
    };
  }
  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const element = document.createElement('section');
    element.setAttribute('parameter', '');
    element.setAttribute(
      'data-parameter',
      toBase64UTF8(JSON.stringify(this.parameter)),
    );
    element.textContent = this.parameter.value;
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

export function $createParametersNode(parameters: Parameter): ParametersNode {
  return $applyNodeReplacement(new ParametersNode(parameters));
}

export function $isParametersNode(
  node: LexicalNode | null | undefined,
): node is ParametersNode {
  return node instanceof ParametersNode;
}

// export function updateParameters(parameters: Parameter) {
//   return ParametersNode.collection.set(parameters.number, parameters);
// }

export function $unifiedCreateParametersNode<T extends Record<string, any>>(
  unified: ParameterUnified<T>,
  parameter: T,
) {
  return $createParametersNode({
    insId: parameter.insId,
    number: parameter.number,
    value: unified.setParameter(parameter).getParameterValue(parameter),
  });
}
