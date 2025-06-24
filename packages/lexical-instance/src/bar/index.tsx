/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type React from 'react';

import {
  $applyNodeReplacement,
  BaseSelection,
  DecoratorNode,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import {$createInstanceNode} from '../base';
import Styles from './styles.module.less';

export type SerializedPlaceholderDecoratorNode = Spread<
  {
    __text: string;
  },
  SerializedLexicalNode
>;

export class BarDecoratorNode extends DecoratorNode<JSX.Element> {
  __text = 'bar';
  static getType() {
    return 'Bar';
  }

  static clone(node: BarDecoratorNode) {
    return new BarDecoratorNode(node.__key);
  }

  static importJSON(
    serializedNode: SerializedPlaceholderDecoratorNode,
  ): BarDecoratorNode {
    return $createBarDecoratorNode().updateFromJSON(serializedNode);
  }

  constructor(key?: string) {
    super(key);
  }

  createDOM(config: EditorConfig) {
    const div = document.createElement('div');
    div.classList.add(Styles['instance-bar']);
    return div;
  }

  updateDOM() {
    return false; // 静态内容无需更新
  }

  remove(preserveEmptyParent?: boolean): void {}

  collapseAtStart(): true {
    return true;
  }

  isSelected(selection?: null | BaseSelection): boolean {
    return false;
  }

  onInsertBlock(e: React.MouseEvent, editor: LexicalEditor) {
    if (!editor) {
      return;
    }

    editor.update(() => {
      const node = this.getParent();
      if (!node) {
        return;
      }
      const pNode = $createInstanceNode();
      if (e.altKey || e.ctrlKey) {
        node.append(pNode);
        // node.insertBefore(pNode);
      } else {
        node.insertAfter(pNode);
        // node.append(pNode)
      }
      pNode.select();
    });
  }

  decorate(editor: LexicalEditor, config: EditorConfig): JSX.Element {
    return (
      <div>
        <span>⭕</span>
        <span>link</span>
        <button onClick={(e) => this.onInsertBlock(e, editor)}>+</button>
      </div>
    );
  }
}

/** 创建 Bar 装饰节点 */
export function $createBarDecoratorNode(): BarDecoratorNode {
  return $applyNodeReplacement(new BarDecoratorNode());
}

/** 是否是 Bar 装饰节点 */
export function $isBarDecoratorNode(
  node: LexicalNode | null | undefined,
): node is BarDecoratorNode {
  return node instanceof BarDecoratorNode;
}
