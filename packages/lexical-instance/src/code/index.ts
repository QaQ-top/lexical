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
  LexicalNode,
  ParagraphNode,
  RangeSelection,
  SerializedElementNode,
  Spread,
  TabNode,
} from 'lexical';

import {
  $createCodeHighlightNode,
  $getFirstCodeNodeOfLine,
  $isCodeHighlightNode,
  $isCodeNode,
  type CodeHighlightNode,
  CodeNode,
} from '@lexical/code';
import {isHTMLElement} from '@lexical/utils';
import {
  $applyNodeReplacement,
  $createLineBreakNode,
  $createTabNode,
  $isTabNode,
  $isTextNode,
} from 'lexical';

import {$removedFixedParagraph} from '../base';
import {$createInstanceParagraphNode} from '../paragraph';

export type SerializedCodeNode = Spread<
  {
    language: string | null | undefined;
  },
  SerializedElementNode
>;

function hasChildDOMNodeTag(node: Node, tagName: string) {
  for (const child of node.childNodes) {
    if (isHTMLElement(child) && child.tagName === tagName) {
      return true;
    }
    hasChildDOMNodeTag(child, tagName);
  }
  return false;
}

const LANGUAGE_DATA_ATTRIBUTE = 'data-language';

/** @noInheritDoc */
export class InstanceCodeNode extends CodeNode {
  static getType(): string {
    return 'Code';
  }

  static clone(node: InstanceCodeNode): InstanceCodeNode {
    return new InstanceCodeNode(node.__language, node.__key);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      // Typically <pre> is used for code blocks, and <code> for inline code styles
      // but if it's a multi line <code> we'll create a block. Pass through to
      // inline format handled by TextNode otherwise.
      code: (node: Node) => {
        const isMultiLine =
          node.textContent != null &&
          (/\r?\n/.test(node.textContent) || hasChildDOMNodeTag(node, 'BR'));

        return isMultiLine
          ? {
              conversion: $convertPreElement,
              priority: 1,
            }
          : null;
      },
      div: () => ({
        conversion: $convertDivElement,
        priority: 1,
      }),
      pre: () => ({
        conversion: $convertPreElement,
        priority: 0,
      }),
      table: (node: Node) => {
        const table = node;
        // domNode is a <table> since we matched it by nodeName
        if (isGitHubCodeTable(table as HTMLTableElement)) {
          return {
            conversion: $convertTableElement,
            priority: 3,
          };
        }
        return null;
      },
      td: (node: Node) => {
        // element is a <td> since we matched it by nodeName
        const td = node as HTMLTableCellElement;
        const table: HTMLTableElement | null = td.closest('table');

        if (isGitHubCodeCell(td) || (table && isGitHubCodeTable(table))) {
          // Return a no-op if it's a table cell in a code table, but not a code line.
          // Otherwise it'll fall back to the T
          return {
            conversion: convertCodeNoop,
            priority: 3,
          };
        }

        return null;
      },
      tr: (node: Node) => {
        // element is a <tr> since we matched it by nodeName
        const tr = node as HTMLTableCellElement;
        const table: HTMLTableElement | null = tr.closest('table');
        if (table && isGitHubCodeTable(table)) {
          return {
            conversion: convertCodeNoop,
            priority: 3,
          };
        }
        return null;
      },
    };
  }

  static importJSON(serializedNode: SerializedCodeNode): InstanceCodeNode {
    return $createInstanceCodeNode().updateFromJSON(serializedNode);
  }

  // Mutation
  insertNewAfter(
    selection: RangeSelection,
    restoreSelection = true,
  ): null | ParagraphNode | CodeHighlightNode | TabNode {
    const children = this.getChildren();
    const childrenLength = children.length;

    if (
      childrenLength >= 2 &&
      children[childrenLength - 1].getTextContent() === '\n' &&
      children[childrenLength - 2].getTextContent() === '\n' &&
      selection.isCollapsed() &&
      selection.anchor.key === this.__key &&
      selection.anchor.offset === childrenLength
    ) {
      children[childrenLength - 1].remove();
      children[childrenLength - 2].remove();
      const newElement = $createInstanceParagraphNode();
      this.insertAfter(newElement, restoreSelection);
      return newElement;
    }

    // If the selection is within the codeblock, find all leading tabs and
    // spaces of the current line. Create a new line that has all those
    // tabs and spaces, such that leading indentation is preserved.
    const {anchor, focus} = selection;
    const firstPoint = anchor.isBefore(focus) ? anchor : focus;
    const firstSelectionNode = firstPoint.getNode();
    if ($isTextNode(firstSelectionNode)) {
      let node: null | LexicalNode =
        $getFirstCodeNodeOfLine(firstSelectionNode);
      const insertNodes = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if ($isTabNode(node)) {
          insertNodes.push($createTabNode());
          node = node.getNextSibling();
        } else if ($isCodeHighlightNode(node)) {
          let spaces = 0;
          const text = node.getTextContent();
          const textSize = node.getTextContentSize();
          while (spaces < textSize && text[spaces] === ' ') {
            spaces++;
          }
          if (spaces !== 0) {
            insertNodes.push($createCodeHighlightNode(' '.repeat(spaces)));
          }
          if (spaces !== textSize) {
            break;
          }
          node = node.getNextSibling();
        } else {
          break;
        }
      }
      const split = firstSelectionNode.splitText(anchor.offset)[0];
      const x = anchor.offset === 0 ? 0 : 1;
      const index = split.getIndexWithinParent() + x;
      const codeNode = firstSelectionNode.getParentOrThrow();
      const nodesToInsert = [$createLineBreakNode(), ...insertNodes];
      codeNode.splice(index, 0, nodesToInsert);
      const last = insertNodes[insertNodes.length - 1];
      if (last) {
        last.select();
      } else if (anchor.offset === 0) {
        split.selectPrevious();
      } else {
        split.getNextSibling()!.selectNext(0, 0);
      }
    }
    if ($isCodeNode(firstSelectionNode)) {
      const {offset} = selection.anchor;
      firstSelectionNode.splice(offset, 0, [$createLineBreakNode()]);
      firstSelectionNode.select(offset + 1, offset + 1);
    }

    return null;
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

export function $createInstanceCodeNode(
  language?: string | null | undefined,
): InstanceCodeNode {
  return $applyNodeReplacement(new InstanceCodeNode(language));
}

export function $isInstanceCodeNode(
  node: LexicalNode | null | undefined,
): node is InstanceCodeNode {
  return node instanceof InstanceCodeNode;
}

function $convertPreElement(domNode: HTMLElement): DOMConversionOutput {
  const language = domNode.getAttribute(LANGUAGE_DATA_ATTRIBUTE);
  return {node: $createInstanceCodeNode(language)};
}

function $convertDivElement(domNode: Node): DOMConversionOutput {
  // domNode is a <div> since we matched it by nodeName
  const div = domNode as HTMLDivElement;
  const isCode = isCodeElement(div);
  if (!isCode && !isCodeChildElement(div)) {
    return {
      node: null,
    };
  }
  return {
    node: isCode ? $createInstanceCodeNode() : null,
  };
}

function $convertTableElement(): DOMConversionOutput {
  return {node: $createInstanceCodeNode()};
}

function convertCodeNoop(): DOMConversionOutput {
  return {node: null};
}

function isCodeElement(div: HTMLElement): boolean {
  return div.style.fontFamily.match('monospace') !== null;
}

function isCodeChildElement(node: HTMLElement): boolean {
  let parent = node.parentElement;
  while (parent !== null) {
    if (isCodeElement(parent)) {
      return true;
    }
    parent = parent.parentElement;
  }
  return false;
}

function isGitHubCodeCell(
  cell: HTMLTableCellElement,
): cell is HTMLTableCellElement {
  return cell.classList.contains('js-file-line');
}

function isGitHubCodeTable(table: HTMLTableElement): table is HTMLTableElement {
  return table.classList.contains('js-file-line-container');
}
