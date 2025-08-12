/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type {InstanceParagraphNode} from './paragraph';
import type {
  BaseSelection,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  LexicalUpdateJSON,
  NodeKey,
} from 'lexical';

import {
  $applyNodeReplacement,
  $isTextNode,
  EditorConfig,
  ElementFormatType,
  ElementNode,
  isHTMLElement,
  LexicalEditor,
  RangeSelection,
  SerializedElementNode,
  setNodeIndentFromDOM,
  Spread,
} from 'lexical';

import {$createBarDecoratorNode, $isBarDecoratorNode} from './bar';
import Styles from './base.module.less';
import {InstanceParagraphType, numberNodeKey} from './const';
import {$createNumberDecoratorNode, $isNumberDecoratorNode} from './number';
import {
  $createInstanceParagraphNode,
  $isEmptyParagraphNode,
  $isInstanceParagraphNode,
} from './paragraph';
import {Instance, InstanceBaseInfo} from './types';
import {getCachedClassNameArray, getInstanceBaseInfo} from './utils';

/** TODO 数据类型 */
export type SerializedInstanceNode = Spread<
  {
    textFormat: number;
    textStyle: string;
    instance?: InstanceBaseInfo;
  },
  SerializedElementNode
>;

/** @noInheritDoc */

export class InstanceNode extends ElementNode {
  // 标记初始段落数量
  static DEFAULT_PARAGRAPHS = 3;
  __INS = true;
  __instance: Instance;
  constructor(
    instance?: Instance,
    config: {isTitleOnly?: boolean; isEmpty?: boolean} = {},
    key?: NodeKey,
  ) {
    super(key);
    // [TODO] 实例默认类型
    this.__instance = instance || {objectApicode: ''};
    if (instance && instance.number) {
      numberNodeKey.set(instance.number, this.getKey());
    }
    // 初始化时自动添加 3 个空段落
    if (!key && this.isEmpty() && config.isEmpty !== true) {
      this.append(
        $createBarDecoratorNode(),
        $createNumberDecoratorNode(),
        ...Array(config.isTitleOnly ? 1 : InstanceNode.DEFAULT_PARAGRAPHS)
          .fill(null)
          .map((_i) => $createInstanceParagraphNode()),
      );
    }
  }

  static getType(): string {
    return 'Instance';
  }

  static clone(node: InstanceNode): InstanceNode {
    return new InstanceNode(node.__instance, {}, node.__key);
  }

  static canBeEmpty() {
    return false;
  }

  static importDOM(): DOMConversionMap | null {
    return {
      p: (node: Node) => ({
        conversion: $convertInstanceElement,
        priority: 0,
      }),
    };
  }

  static importJSON(serializedNode: SerializedInstanceNode): InstanceNode {
    return $createEmptyInstanceNode().updateFromJSON(serializedNode);
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const {element} = super.exportDOM(editor);

    if (isHTMLElement(element)) {
      if (this.isEmpty()) {
        element.append(document.createElement('br'));
      }

      const formatType = this.getFormatType();
      element.style.textAlign = formatType;
    }

    return {
      element,
    };
  }

  exportJSON(): SerializedInstanceNode {
    return {
      ...super.exportJSON(),
      instance: getInstanceBaseInfo(this.__instance),
      // These are included explicitly for backwards compatibility
      textFormat: this.getTextFormat(),
      textStyle: this.getTextStyle(),
    };
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedInstanceNode>,
  ): this {
    super.updateFromJSON(serializedNode);
    this.__instance = serializedNode.instance as unknown as Instance;
    return this;
  }

  // View

  createDOM(config: EditorConfig): HTMLElement {
    const dom = document.createElement('div');
    const classNames = [
      Styles.instance,
      'rich-text-instance',
      getCachedClassNameArray(config.theme, 'instance') ?? [],
    ];
    if (classNames !== undefined) {
      const domClassList = dom.classList;
      domClassList.add(...classNames.flat(1));
    }
    dom.style.position = 'relative';
    dom.setAttribute('instance', 'true');
    dom.setAttribute('key', this.getKey());
    return dom;
  }

  updateDOM(
    prevNode: InstanceNode,
    dom: HTMLElement,
    config: EditorConfig,
  ): boolean {
    return false;
  }

  // Mutation
  insertNewAfter(
    rangeSelection: RangeSelection,
    restoreSelection: boolean,
  ): InstanceNode {
    const newElement = $createInstanceNode();
    newElement.setTextFormat(rangeSelection.format);
    newElement.setTextStyle(rangeSelection.style);
    const direction = this.getDirection();
    newElement.setDirection(direction);
    newElement.setFormat(this.getFormatType());
    newElement.setStyle(this.getStyle());
    this.insertAfter(newElement, restoreSelection);
    return newElement;
  }

  getTextContent(): string {
    const children = this.getPracticalChildren();
    return children
      .map((node) => {
        return node.getTextContent().trim();
      })
      .join('');
  }

  getPracticalChildren<T extends LexicalNode>(): Array<T> {
    return super
      .getChildren<T>()
      .filter(
        (node) =>
          !$isBarDecoratorNode(node) &&
          !$isNumberDecoratorNode(node) &&
          /** 全选后再输入文字时，会直接插入文本节点到Instance节点 */ !$isTextNode(
            node,
          ),
      );
  }

  getSelfContentChildren<T extends LexicalNode>(): Array<T> {
    return this.getPracticalChildren<T>().filter(
      (node) => !$isInstanceNode(node),
    );
  }

  getSerialNumber(): string {
    const children =
      this.getParent()
        ?.getChildren()
        .filter((node) => $isInstanceNode(node)) || [];
    if (children.length) {
      const index = String(children.findIndex((node) => node === this)! + 1);
      const ancestor = this.getParent();
      if ($isInstanceNode(ancestor)) {
        return `${ancestor.getSerialNumber()}.${index}`;
      } else {
        return index;
      }
    }
    return '';
  }

  collapseAtStart(): boolean {
    const children = this.getPracticalChildren<InstanceParagraphNode>();
    // If we have an empty (trimmed) first paragraph and try and remove it,
    // delete the paragraph as long as we have another sibling to go to
    if (children.every((child) => $isEmptyParagraphNode(child))) {
      const nextSibling = this.getNextSibling();
      const prevSibling = this.getPreviousSibling();
      const result =
        /** 下一个是否存在 */ this.handleRemove(nextSibling) ||
        /** 上一个是否存在 */ this.handleRemove(prevSibling, false);
      return result;
    }
    return false;
  }
  handleRemove(sibling: LexicalNode | null, isNext = true) {
    if (sibling !== null) {
      sibling.selectEnd();
      if ($isInstanceNode(sibling)) {
        const children = sibling.getChildren();
        let anchor = children[0];
        if (!isNext) {
          anchor = children[children.length - 1];
        }
        anchor.selectEnd();
      }
      this.remove();
      return true;
    }
    return false;
  }

  select(_anchorOffset?: number, _focusOffset?: number): RangeSelection {
    const firstChild = this.getChildAtIndex(InstanceParagraphType.Title);
    if (firstChild) {
      return firstChild.selectEnd();
    }
    return super.select(_anchorOffset, _focusOffset);
  }

  optimizationParagraph() {
    const children = this.getPracticalChildren();
    const index = children.findIndex((node) => $isInstanceNode(node));
    const defaultParagraphs =
      index !== -1 ? children.slice(0, index) : children;
    const anchorPoint = defaultParagraphs[defaultParagraphs.length - 1];
    if (defaultParagraphs.length < InstanceNode.DEFAULT_PARAGRAPHS) {
      const count = InstanceNode.DEFAULT_PARAGRAPHS - defaultParagraphs.length;
      for (let i = 0; i < count; i++) {
        anchorPoint.insertAfter($createInstanceParagraphNode());
      }
    }
  }

  setInstance(instance: Partial<Instance>) {
    // const writable = this.getWritable();
    Object.assign(this.__instance, instance);
  }

  isShadowRoot() {
    return true;
  }

  isSelected(selection?: null | BaseSelection): boolean {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return false;
  }
}

function $convertInstanceElement(element: HTMLElement): DOMConversionOutput {
  const node = $createInstanceNode();
  if (element.style) {
    node.setFormat(element.style.textAlign as ElementFormatType);
    setNodeIndentFromDOM(element, node);
  }
  return {node};
}

export function $createInstanceNode(instance?: Instance): InstanceNode {
  return $applyNodeReplacement(new InstanceNode(instance));
}

export function $createTitleOnlyInstanceNode(
  instance?: Instance,
): InstanceNode {
  return $applyNodeReplacement(new InstanceNode(instance, {isTitleOnly: true}));
}

export function $createEmptyInstanceNode(instance?: Instance): InstanceNode {
  return $applyNodeReplacement(new InstanceNode(instance, {isEmpty: true}));
}
export function $isInstanceNode(
  node: LexicalNode | null | undefined,
): node is InstanceNode {
  return node instanceof InstanceNode;
}

export function $remove(node: LexicalNode) {
  const parent = node.getParent();
  if ($isInstanceNode(parent)) {
    const practicals = parent.getPracticalChildren();
    const removedSize = practicals.length - 1;
    if (
      removedSize < InstanceNode.DEFAULT_PARAGRAPHS ||
      $isInstanceNode(practicals[InstanceNode.DEFAULT_PARAGRAPHS])
    ) {
      if (
        practicals.findIndex(
          (practical) => practical.getKey() === node.getKey(),
        ) > InstanceNode.DEFAULT_PARAGRAPHS
      ) {
        return true;
      } else if ($isInstanceParagraphNode(node.getPreviousSibling())) {
        node.selectPrevious();
      } else {
        const allEmpty = $checkAllParagraphsEmpty(parent);
        if (allEmpty) {
          const isRemove = parent.collapseAtStart();
          if (!isRemove) {
            node.selectEnd();
          }
        } else {
          node.selectEnd();
        }
      }
      return false;
    }
  }
  return true;
}

/** 删除某个节点时 需要检测是否需要固定段落 */
export function $removedFixedParagraph(
  node: ElementNode,
  remove: () => void,
  isKeepPgh: boolean = false,
) {
  if ($remove(node)) {
    if (isKeepPgh) {
      $keepParagraph(node, remove);
    } else {
      remove();
    }
  } else {
    $replaceWithParagraph(node);
  }
}

/** 删除某个节点时 保留当前段落 */
export function $keepParagraph(node: ElementNode, remove: () => void) {
  const parent = node.getParent();
  if ($isInstanceNode(parent)) {
    $replaceWithParagraph(node).selectEnd();
  } else {
    remove();
  }
}

/** 替换为段落 */
function $replaceWithParagraph(node: ElementNode) {
  const newElement = $createInstanceParagraphNode();
  const children = node.getChildren();
  children.forEach((child) => newElement.append(child));
  node.replace(newElement);
  return newElement;
}

/** 检查所有段落是否为空 */
export function $checkAllParagraphsEmpty(parent: InstanceNode) {
  return parent.getPracticalChildren().every((paragraph) => {
    return paragraph.getTextContent().trim() === '';
  });
}
