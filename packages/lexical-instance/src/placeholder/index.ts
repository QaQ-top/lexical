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
  DecoratorNode,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import {$isInstanceTitleNode} from '../paragraph/title';
import {getCachedClassNameArray} from '../utils';

export type SerializedPlaceholderDecoratorNode = Spread<
  {
    __text: string;
    __show: boolean;
  },
  SerializedLexicalNode
>;

export class PlaceholderDecoratorNode extends DecoratorNode<string> {
  static getType() {
    return 'Placeholder';
  }

  __text = '';
  __show = true;

  static clone(node: PlaceholderDecoratorNode) {
    return new PlaceholderDecoratorNode(node.__text, node.__key);
  }

  static importJSON(
    serializedNode: SerializedPlaceholderDecoratorNode,
  ): PlaceholderDecoratorNode {
    const {__text} = serializedNode;
    return $createPlaceholderDecoratorNode(__text).updateFromJSON(
      serializedNode,
    );
  }

  constructor(text?: string, key?: string) {
    super(key);
    this.__text = text || '';
  }

  createDOM(config: EditorConfig) {
    const span = document.createElement('span');
    const classNames = [
      'placeholder',
      getCachedClassNameArray(config.theme, 'placeholder') ?? [],
    ];
    if (classNames !== undefined) {
      const domClassList = span.classList;
      domClassList.add(...classNames.flat(1));
    }
    span.style.cssText = `
      position: absolute;
      color: #999;
      z-index: -1;
      pointer-events: none;
      user-select: none;
    `;
    return span;
  }

  updateDOM() {
    return false; // 静态内容无需更新
  }

  remove(preserveEmptyParent?: boolean): void {
    const parent = this.getParent();
    if ($isInstanceTitleNode(parent)) {
      parent.remove();
      return;
    }
    super.remove(preserveEmptyParent);
  }

  collapseAtStart(): true {
    return true;
  }

  /** 是否显示 placeholder */
  setShow(value: boolean) {
    this.__show = value;
  }

  isSelected(selection?: null | BaseSelection): boolean {
    return false;
  }

  decorate(editor: LexicalEditor, config: EditorConfig): string {
    if (this.__show) {
      return this.__text;
    } else {
      return '';
    }
  }
}

/** 创建 Placeholder 装饰节点 */
export function $createPlaceholderDecoratorNode(
  placeholder?: string,
): PlaceholderDecoratorNode {
  return $applyNodeReplacement(new PlaceholderDecoratorNode(placeholder));
}

/** 是否是 Placeholder 装饰节点 */
export function $isPlaceholderDecoratorNode(
  node: LexicalNode | null | undefined,
): node is PlaceholderDecoratorNode {
  return node instanceof PlaceholderDecoratorNode;
}
