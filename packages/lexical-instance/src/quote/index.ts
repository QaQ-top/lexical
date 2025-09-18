/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {QuoteNode} from '@lexical/rich-text';
import {
  $applyNodeReplacement,
  $isLineBreakNode,
  DOMConversionMap,
  DOMConversionOutput,
  EditorConfig,
  ElementFormatType,
  LexicalNode,
  RangeSelection,
  SerializedElementNode,
  setNodeIndentFromDOM,
} from 'lexical';

import {$removedFixedParagraph} from '../base';
import {
  $createInstanceParagraphNode,
  InstanceParagraphNode,
} from '../paragraph';
import {setDisable} from '../utils';

export type SerializedInstanceQuoteNode = SerializedElementNode;

/** @noInheritDoc */
export class InstanceQuoteNode extends QuoteNode {
  static getType(): string {
    return 'Quote';
  }

  static clone(node: InstanceQuoteNode): InstanceQuoteNode {
    return new InstanceQuoteNode(node.__key);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      blockquote: (node: Node) => ({
        conversion: $convertBlockquoteElement,
        priority: 0,
      }),
    };
  }

  static importJSON(
    serializedNode: SerializedInstanceQuoteNode,
  ): InstanceQuoteNode {
    return $createInstanceQuoteNode().updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    setDisable(this, element);
    return element;
  }

  // Mutation

  insertNewAfter(
    selection: RangeSelection,
    restoreSelection?: boolean,
  ): InstanceParagraphNode {
    const [node] = selection.getNodes();
    const nextNode = node.getNextSibling();
    if ($isLineBreakNode(node) && !nextNode) {
      node.remove();
      const newBlock = $createInstanceParagraphNode();
      const direction = this.getDirection();
      newBlock.setDirection(direction);
      this.insertAfter(newBlock, restoreSelection);
      return newBlock;
    } else {
      selection.insertLineBreak(false);
      return null as unknown as InstanceParagraphNode;
    }
  }

  collapseAtStart(): true {
    const paragraph = $createInstanceParagraphNode();
    const children = this.getChildren();
    children.forEach((child) => paragraph.append(child));
    this.replace(paragraph);
    return true;
  }

  remove(preserveEmptyParent?: boolean): void {
    $removedFixedParagraph(
      this,
      () => {
        super.remove(preserveEmptyParent);
      },
      true,
    );
  }
}

function $convertBlockquoteElement(element: HTMLElement): DOMConversionOutput {
  const node = $createInstanceQuoteNode();
  if (element.style !== null) {
    node.setFormat(element.style.textAlign as ElementFormatType);
    setNodeIndentFromDOM(element, node);
  }
  return {node};
}

export function $createInstanceQuoteNode(): InstanceQuoteNode {
  return $applyNodeReplacement(new InstanceQuoteNode());
}

export function $isInstanceQuoteNode(
  node: LexicalNode | null | undefined,
): node is InstanceQuoteNode {
  return node instanceof InstanceQuoteNode;
}
