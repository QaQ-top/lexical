/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  HeadingNode,
  HeadingTagType,
  SerializedHeadingNode,
} from '@lexical/rich-text';
import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  ElementFormatType,
  isHTMLElement,
  LexicalEditor,
  LexicalNode,
  RangeSelection,
  setNodeIndentFromDOM,
} from 'lexical';

import {$removedFixedParagraph} from '../base';
import {
  $createInstanceParagraphNode,
  $isInstanceParagraphNode,
} from '../paragraph';
import {setDisable} from '../utils';

export function isGoogleDocsTitle(domNode: Node): boolean {
  if (domNode.nodeName.toLowerCase() === 'span') {
    return (domNode as HTMLSpanElement).style.fontSize === '26pt';
  }
  return false;
}

export class InstanceHeadingNode extends HeadingNode {
  static getType(): string {
    return 'Heading';
  }

  static clone(node: InstanceHeadingNode): InstanceHeadingNode {
    return new InstanceHeadingNode(node.__tag, node.__key);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      h1: (node: Node) => ({
        conversion: $convertInstanceHeadingElement,
        priority: 0,
      }),
      h2: (node: Node) => ({
        conversion: $convertInstanceHeadingElement,
        priority: 0,
      }),
      h3: (node: Node) => ({
        conversion: $convertInstanceHeadingElement,
        priority: 0,
      }),
      h4: (node: Node) => ({
        conversion: $convertInstanceHeadingElement,
        priority: 0,
      }),
      h5: (node: Node) => ({
        conversion: $convertInstanceHeadingElement,
        priority: 0,
      }),
      h6: (node: Node) => ({
        conversion: $convertInstanceHeadingElement,
        priority: 0,
      }),
      p: (node: Node) => {
        // domNode is a <p> since we matched it by nodeName
        const paragraph = node as HTMLParagraphElement;
        const firstChild = paragraph.firstChild;
        if (firstChild !== null && isGoogleDocsTitle(firstChild)) {
          return {
            conversion: () => ({node: null}),
            priority: 3,
          };
        }
        return null;
      },
      span: (node: Node) => {
        if (isGoogleDocsTitle(node)) {
          return {
            conversion: (domNode: Node) => {
              return {
                node: $createInstanceHeadingNode('h1'),
              };
            },
            priority: 3,
          };
        }
        return null;
      },
    };
  }

  static importJSON(serializedNode: SerializedHeadingNode): HeadingNode {
    return $createInstanceHeadingNode(serializedNode.tag).updateFromJSON(
      serializedNode,
    );
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    setDisable(this, element);
    return element;
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const {element} = super.exportDOM(editor);

    if (isHTMLElement(element)) {
      if (this.isEmpty()) {
        element.append(document.createElement('br'));
      }

      const formatType = this.getFormatType();
      element.style.textAlign = formatType;

      const direction = this.getDirection();
      if (direction) {
        element.dir = direction;
      }
    }

    return {
      element,
    };
  }

  exportJSON(): SerializedHeadingNode {
    return {
      ...super.exportJSON(),
      tag: this.getTag(),
    };
  }

  remove(preserveEmptyParent?: boolean): void {
    $removedFixedParagraph(this, () => {
      super.remove(preserveEmptyParent);
    });
  }

  collapseAtStart(): true {
    const newElement = !this.isEmpty()
      ? $createInstanceHeadingNode(this.getTag())
      : $createInstanceParagraphNode();
    const children = this.getChildren();
    children.forEach((child) => newElement.append(child));
    this.replace(newElement);
    return true;
  }

  // Mutation
  insertNewAfter(selection?: RangeSelection, restoreSelection = true) {
    const parent = this.getParent();
    if (selection && $isInstanceParagraphNode(parent)) {
      return parent.insertNewAfter(selection, restoreSelection);
    } else {
      const anchorOffet = selection ? selection.anchor.offset : 0;
      const lastDesc = this.getLastDescendant();
      const isAtEnd =
        !lastDesc ||
        (selection &&
          selection.anchor.key === lastDesc.getKey() &&
          anchorOffet === lastDesc.getTextContentSize());
      const newElement =
        isAtEnd || !selection
          ? $createInstanceParagraphNode()
          : $createInstanceHeadingNode(this.getTag());
      const direction = this.getDirection();
      newElement.setDirection(direction);
      this.insertAfter(newElement, restoreSelection);
      if (anchorOffet === 0 && !this.isEmpty() && selection) {
        const paragraph = $createInstanceParagraphNode();
        paragraph.select();
        this.replace(paragraph, true);
      }
      return newElement;
    }
  }
}

export function $convertInstanceHeadingElement(
  element: HTMLElement,
): DOMConversionOutput {
  const nodeName = element.nodeName.toLowerCase();
  let node = null;
  if (
    nodeName === 'h1' ||
    nodeName === 'h2' ||
    nodeName === 'h3' ||
    nodeName === 'h4' ||
    nodeName === 'h5' ||
    nodeName === 'h6'
  ) {
    node = $createInstanceHeadingNode(nodeName);
    if (element.style !== null) {
      setNodeIndentFromDOM(element, node);
      node.setFormat(element.style.textAlign as ElementFormatType);
    }
  }
  return {node};
}

/** 创建 Instance Heading */
export function $createInstanceHeadingNode(
  headingTag: HeadingTagType = 'h1',
): InstanceHeadingNode {
  return $applyNodeReplacement(new InstanceHeadingNode(headingTag));
}

/** 是否是 Instance Heading */
export function $isInstanceHeadingNode(
  node: LexicalNode | null | undefined,
): node is InstanceHeadingNode {
  return node instanceof InstanceHeadingNode;
}
