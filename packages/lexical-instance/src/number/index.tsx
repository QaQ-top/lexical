/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {addClassNamesToElement} from '@lexical/utils';
import {dfs} from '@onchain/utility/traversal';
import {
  $applyNodeReplacement,
  BaseSelection,
  DecoratorNode,
  EditorConfig,
  ElementNode,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

import {$isInstanceNode, InstanceNode} from '../base';
import {$isInstanceParagraphNode} from '../paragraph';
import {Instance} from '../types';
import Styles from './styles.module.less';

export type SerializedNumberDecoratorNode = Spread<
  {
    __instance: Instance;
  },
  SerializedLexicalNode
>;

export class NumberDecoratorNode extends DecoratorNode<JSX.Element> {
  __instance: Instance | undefined;
  __serialNumber = '';
  static getType() {
    return 'Number';
  }

  static clone(node: NumberDecoratorNode) {
    return new NumberDecoratorNode(node.__instance, node.__key);
  }

  static importJSON(
    serializedNode: SerializedNumberDecoratorNode,
  ): NumberDecoratorNode {
    return $createNumberDecoratorNode().updateFromJSON(serializedNode);
  }

  constructor(__instance?: Instance, key?: string) {
    super(key);
    this.__instance = __instance;
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

  collapseAtStart(): true {
    return true;
  }

  getNumberRootElement(config: EditorConfig) {
    const div = document.createElement('div');
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
    const number = this.__instance?.number || 'Number';
    return (
      <div title={`${serial} ${number}`}>
        <span>{serial}</span>
        <span>{number}</span>
      </div>
    );
  }
}

/** 创建 Number 装饰节点 */
export function $createNumberDecoratorNode(
  instance?: Instance,
): NumberDecoratorNode {
  return $applyNodeReplacement(new NumberDecoratorNode(instance));
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
    // 当内容变化时更新装饰
    // const now = Date.now();
    // if (now - date > 1) {
    //   date = now;
    // }
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

/** 监听 InstanceNode 更新，实时更新序号 */
export function $registerNumberDecoratorDomUpdate(editor: LexicalEditor) {
  return editor.registerNodeTransform(NumberDecoratorNode, (node) => {
    // 当内容变化时更新装饰
    const serial = node.__serialNumber;
    if (serial) {
      const [styleElement, remove] = getStyleElement(editor, node);
      const width = getTextWidth(node.__serialNumber, styleElement);
      remove();
      const next = node.getNextSibling()?.getWritable();
      if ($isInstanceParagraphNode(next) && next.isTitle) {
        const element = editor.getElementByKey(next.getKey());
        if (element) {
          element.style.paddingLeft = `${width}px`;
        }
        next.__paddingLeft = `${width}px`;

        // console.log(
        //   {key: node.__key, 'No.': node.__serialNumber, width},
        //   'FFFF---',
        // );
      }
    }
  });
}

function getStyleElement(
  editor: LexicalEditor,
  node: NumberDecoratorNode,
): [HTMLElement, () => void] {
  const selfElement = editor.getElementByKey(node.getKey());
  if (!selfElement) {
    const publicStyles = node.getNumberRootElement(editor._config);
    document.body.appendChild(publicStyles);
    return [publicStyles, () => publicStyles.remove()];
  }
  return [selfElement, () => {}];
}

function getTextWidth(text: string, cssStyle?: string | Element | null) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  // 处理不同类型的样式输入
  let fontString = '24px Arial'; // 默认值

  if (typeof cssStyle === 'string') {
    // 直接使用传入的CSS字体字符串
    fontString = cssStyle;
  } else if (cssStyle instanceof Element) {
    // 从DOM元素获取计算后的样式
    const computedStyle = window.getComputedStyle(cssStyle);
    fontString = `
      ${computedStyle.fontStyle} 
      ${computedStyle.fontWeight} 
      ${computedStyle.fontSize} 
      ${computedStyle.fontFamily}
    `;
  }
  // 应用字体到Canvas
  context.font = fontString;
  // 返回测量结果
  return context.measureText(text).width;
}
