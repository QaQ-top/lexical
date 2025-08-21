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
  $getSelection,
  BaseSelection,
  COMMAND_PRIORITY_NORMAL,
  DecoratorNode,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SELECTION_CHANGE_COMMAND,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import {$createInstanceNode, InstanceNode} from '../base';
import {$getInstanceNodeByChild} from '../utils';
import Bar from './BarComponent';

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

  get __instance() {
    return (this.getParent() as InstanceNode)?.__instance;
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
    div.setAttribute('bar', 'true');
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

  isKeyboardSelectable(): boolean {
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
      <Bar
        nodeKey={this.getKey()}
        instance={this.__instance.value}
        insNodeKey={this.getParent()?.getKey()}
      />
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

export function $selectionChange(
  editor: LexicalEditor,
  setSelectedInstance: (params: {number: string; nodeKey: string}[]) => void,
) {
  return editor.registerCommand(
    SELECTION_CHANGE_COMMAND,
    (_, activeEditor) => {
      const selection = $getSelection();
      if (selection) {
        const selectInstance = Array.from(
          new Set(
            selection.getNodes().map((node) => $getInstanceNodeByChild(node)),
          ),
        ).filter<InstanceNode>((node) => !!node);
        setSelectedInstance(
          selectInstance.map((insNode) => {
            return {
              nodeKey: insNode.getKey(),
              // [TODO] number 可能为空 建议换成其他ID
              number: insNode.__instance.value.number!,
            };
          }),
        );
      }
      return true;
    },
    COMMAND_PRIORITY_NORMAL,
  );
}
