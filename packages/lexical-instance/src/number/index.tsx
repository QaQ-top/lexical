/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {addClassNamesToElement} from '@lexical/utils';
import {
  $applyNodeReplacement,
  BaseSelection,
  DecoratorNode,
  EditorConfig,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  SerializedLexicalNode,
  Spread,
} from 'lexical';
import {dfs} from 'onchain-utility/traversal';

import {$isInstanceNode, InstanceNode} from '../base';
import {$isInstanceParagraphNode} from '../paragraph';
import {InstanceBaseInfo} from '../types';
import Number from './NumberComponent';
import Styles from './styles.module.less';

export type SerializedNumberDecoratorNode = Spread<
  {
    instance?: InstanceBaseInfo;
    serialNumber: string;
  },
  SerializedLexicalNode
>;

export class NumberDecoratorNode extends DecoratorNode<JSX.Element> {
  __serialNumber = '';
  static getType() {
    return 'Number';
  }

  static clone(node: NumberDecoratorNode) {
    return new NumberDecoratorNode(node.__key);
  }

  static importJSON(
    serializedNode: SerializedNumberDecoratorNode,
  ): NumberDecoratorNode {
    return $createNumberDecoratorNode().updateFromJSON(serializedNode);
  }

  get __instance() {
    return (this.getParent() as InstanceNode)?.__instance;
  }

  exportJSON(): SerializedNumberDecoratorNode {
    return {
      ...super.exportJSON(),
      serialNumber: this.__serialNumber,
    };
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedNumberDecoratorNode>,
  ): this {
    super.updateFromJSON(serializedNode);
    this.__serialNumber = serializedNode.serialNumber;
    return this;
  }

  constructor(key?: string) {
    super(key);
    this.__serialNumber = this.getSerialNumber();
  }

  createDOM(config: EditorConfig) {
    return this.getNumberRootElement(config);
  }

  updateDOM(
    prevNode: NumberDecoratorNode,
    dom: HTMLElement,
    config: EditorConfig,
  ) {
    return false; // 静态内容无需更新
  }

  remove(preserveEmptyParent?: boolean): void {}

  isSelected(selection?: null | BaseSelection): boolean {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return false;
  }

  collapseAtStart(): true {
    return true;
  }

  getNumberRootElement(config: EditorConfig) {
    const div = document.createElement('div');
    div.setAttribute('number', 'true');
    div.classList.add(Styles['instance-number']);
    const theme = config.theme;
    const classNames = theme.heading;
    if (classNames !== undefined) {
      const className = classNames.h1;
      addClassNamesToElement(div, className);
    }

    return div;
  }

  getSerialNumber() {
    const parent = this.getParent();
    if ($isInstanceNode(parent)) {
      return parent.getSerialNumber();
    }
    return '';
  }

  updateSerialNumber() {
    this.__serialNumber = this.getSerialNumber();
  }

  decorate(editor: LexicalEditor, config: EditorConfig): JSX.Element {
    const serial = this.__serialNumber;
    return (
      <Number
        instance={this.__instance.value}
        serial={serial}
        instanceNodeKey={this.getParent()?.getKey()}
      />
    );
  }
}

/** 创建 Number 装饰节点 */
export function $createNumberDecoratorNode(): NumberDecoratorNode {
  return $applyNodeReplacement(new NumberDecoratorNode());
}

/** 是否是 Number 装饰节点 */
export function $isNumberDecoratorNode(
  node: LexicalNode | null | undefined,
): node is NumberDecoratorNode {
  return node instanceof NumberDecoratorNode;
}

/** 监听 InstanceNode 更新，实时更新序号 */
export function $registerNumberDecoratorNodeUpdate(editor: LexicalEditor) {
  // let date = Date.now();
  return editor.registerNodeTransform(InstanceNode, (node) => {
    serialNumber(editor, node.getParent(), node.getIndexWithinParent());
  });
}

function serialNumber(
  editor: LexicalEditor,
  parent: ElementNode | null,
  index: number,
) {
  if (parent) {
    const children = parent
      .getChildren<InstanceNode | NumberDecoratorNode>()
      .slice(index, Infinity);
    dfs(children, (node) => {
      if ($isInstanceNode(node)) {
        return node.getChildren();
      } else if ($isNumberDecoratorNode(node)) {
        const number = node.getWritable();
        number.updateSerialNumber();
      }
      return [];
    });
  }
}

/** 监听 NumberDecorator 更新，实时更新序号时更新 paddingLeft */
export function $registerNumberDecoratorDomUpdate(editor: LexicalEditor) {
  return editor.registerNodeTransform(NumberDecoratorNode, (node) => {
    // 当内容变化时更新装饰
    const serial = node.__serialNumber;
    const number = node.__instance.value.number;
    const content = [serial, number].filter(Boolean).join(' ');
    if (content) {
      const width = getTextWidth({editor, node, text: content});
      const next = node.getNextSibling()?.getWritable();
      if ($isInstanceParagraphNode(next) && next.isTitle) {
        const element = editor.getElementByKey(next.getKey());
        if (element) {
          element.style.paddingLeft = `${width}px`;
        }
        next.__paddingLeft = `${width}px`;
      }
    }
  });
}

function getStyleElement(
  editor: LexicalEditor,
  node: NumberDecoratorNode,
): [HTMLElement, () => void] {
  const numberStylesDom = node.getNumberRootElement(editor._config);
  numberStylesDom.style.cssText = `padding:0px;position:absolute;z-index:-99;`;
  const box = editor.getRootElement() || document.body;
  box.appendChild(numberStylesDom);
  return [numberStylesDom, () => numberStylesDom.remove()];
}

function getTextWidth({
  editor,
  node,
  text,
}: {
  editor: LexicalEditor;
  node: NumberDecoratorNode;
  text: string;
}) {
  const [styleElement, remove] = getStyleElement(editor, node);
  styleElement.append(text);
  const width = styleElement.offsetWidth;
  remove();
  return width + 3;
}
