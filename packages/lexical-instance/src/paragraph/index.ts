/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type {
  DOMConversionMap,
  DOMConversionOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  RangeSelection,
  SerializedElementNode,
  Spread,
} from 'lexical';

import {
  $applyNodeReplacement,
  $createTextNode,
  $isTextNode,
  ElementFormatType,
  ParagraphNode,
  setNodeIndentFromDOM,
} from 'lexical';

import {$isInstanceNode, $remove} from '../base';
import {InstanceParagraphType, paragraphSymbol, Placeholder} from '../const';
import {$isTextTypeNode, setDisable} from '../utils';
import {$convertToTitle, $isInstanceTitleNode} from './title';

export type SerializedInstanceParagraphNode = Spread<
  {
    textFormat: number;
    textStyle: string;
  },
  SerializedElementNode
>;

export class InstanceParagraphNode extends ParagraphNode {
  static getType(): string {
    return 'Paragraph';
  }

  __symbol = paragraphSymbol;
  __paddingLeft = '';

  get isTitle() {
    return (
      $isInstanceNode(this.getParent()) &&
      this.__symbol.get(this) === InstanceParagraphType.Title
    );
  }
  get isDescription() {
    return (
      $isInstanceNode(this.getParent()) &&
      this.__symbol.get(this) === InstanceParagraphType.Description
    );
  }
  get isText() {
    return (
      $isInstanceNode(this.getParent()) &&
      this.__symbol.get(this) === InstanceParagraphType.Text
    );
  }

  constructor(__paddingLeft?: string, key?: string) {
    super(key);
    this.__paddingLeft = __paddingLeft || '';
  }

  static importJSON(
    serializedNode: SerializedInstanceParagraphNode,
  ): InstanceParagraphNode {
    return $createInstanceParagraphNode().updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedInstanceParagraphNode {
    return {
      ...super.exportJSON(),
      // These are included explicitly for backwards compatibility
      textFormat: this.getTextFormat(),
      textStyle: this.getTextStyle(),
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      p: (node: Node) => ({
        conversion: $convertParagraphInstanceElement,
        priority: 0,
      }),
    };
  }

  static clone(node: InstanceParagraphNode): InstanceParagraphNode {
    return new InstanceParagraphNode(node.__paddingLeft, node.__key);
  }

  initSymbol(index?: number) {
    const line = index ?? this.getIndexWithinParent();
    const isInclude = InstanceParagraphType[line];
    this.__symbol.set(this, isInclude ? line : InstanceParagraphType.Text);
  }

  createDOM(config: EditorConfig): HTMLElement {
    this.initSymbol();
    const element = super.createDOM(config);
    element.style.paddingLeft = this.__paddingLeft;
    setDisable(this, element);
    return element;
  }

  updateDOM(
    prevNode: ParagraphNode,
    dom: HTMLElement,
    config: EditorConfig,
  ): boolean {
    return false;
  }

  insertNewAfter(
    rangeSelection: RangeSelection,
    restoreSelection: boolean,
  ): ParagraphNode {
    const newElement = $createInstanceParagraphNode();
    newElement.setTextFormat(rangeSelection.format);
    newElement.setTextStyle(rangeSelection.style);
    const direction = this.getDirection();
    newElement.setDirection(direction);
    newElement.setFormat(this.getFormatType());
    newElement.setStyle(this.getStyle());
    this.insertAfter(newElement, restoreSelection);
    return newElement;
  }

  remove(preserveEmptyParent?: boolean): void {
    if ($remove(this)) {
      this.__symbol.delete(this);
      super.remove(preserveEmptyParent);
    }
  }
  getFirstTextNode() {
    const children = this.getChildren();
    const [titleNode] = this.getChildren();
    if ($isInstanceTitleNode(titleNode)) {
      return titleNode.getFirstTextNode();
    } else {
      const textNode = children.find((node) => $isTextNode(node));
      if (!textNode) {
        const textNode = $createTextNode();
        this.append(textNode);
        return textNode;
      }
      return textNode;
    }
  }
}

function $convertParagraphInstanceElement(
  element: HTMLElement,
): DOMConversionOutput {
  const node = $createInstanceParagraphNode();
  if (element.style) {
    node.setFormat(element.style.textAlign as ElementFormatType);
    setNodeIndentFromDOM(element, node);
  }
  return {node};
}

/** 创建实例段落 */
export function $createInstanceParagraphNode(): InstanceParagraphNode {
  return $applyNodeReplacement(new InstanceParagraphNode());
}

/** 是否是实例段落 */
export function $isInstanceParagraphNode(
  node: LexicalNode | null | undefined,
): node is InstanceParagraphNode {
  return node instanceof InstanceParagraphNode;
}

/** 段落是否为空 */
export function $isEmptyParagraphNode(node: ParagraphNode | null | undefined) {
  const children = node?.getChildren();
  return (
    children?.length === 0 ||
    ($isTextTypeNode(children?.[0]) &&
      children?.[0].getTextContent().trim() === '')
  );
}

/** 实例段落是否为空 */
export function $isEmptyInstanceParagraphNode(
  node: LexicalNode | null | undefined,
) {
  return $isInstanceParagraphNode(node) && $isEmptyParagraphNode(node);
}

/** 监听 实例 更新 placeholder 状态 */
export function $registerInstanceParagraphNodeTransform(
  editor: LexicalEditor,
  config?: {placeholder?: Placeholder},
) {
  return editor.registerNodeTransform(InstanceParagraphNode, (paragraph) => {
    const parent = paragraph.getParent();
    if ($isInstanceNode(parent)) {
      paragraph.initSymbol();
      if (paragraph.isTitle) {
        $convertToTitle(paragraph, config?.placeholder);
      }
    }
  });
}
