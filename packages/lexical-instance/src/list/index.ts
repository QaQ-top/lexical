/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {ListNode, ListNodeTagType, ListType} from '@lexical/list';
import {
  $applyNodeReplacement,
  $createTextNode,
  $isElementNode,
  DOMConversionMap,
  DOMConversionOutput,
  EditorConfig,
  isHTMLElement,
  LexicalNode,
  LexicalUpdateJSON,
  SerializedElementNode,
  Spread,
} from 'lexical';
import invariant from 'shared/invariant';

import {setDisable} from '../utils';
import {
  mergeNextSiblingListIfSameType,
  updateChildrenListItemValue,
} from './formatList';
import {
  $createInstanceListItemNode,
  $isInstanceListItemNode,
  InstanceListItemNode,
} from './item';

export type SerializedInstanceListNode = Spread<
  {
    listType: ListType;
    start: number;
    tag: ListNodeTagType;
  },
  SerializedElementNode
>;

/** @noInheritDoc */
export class InstanceListNode extends ListNode {
  static getType(): string {
    return 'List';
  }

  static clone(node: InstanceListNode): InstanceListNode {
    const listType = node.__listType || TAG_TO_LIST_TYPE[node.__tag];

    return new InstanceListNode(listType, node.__start, node.__key);
  }

  static transform(): (node: LexicalNode) => void {
    return (node: LexicalNode) => {
      invariant($isInstanceListNode(node), 'node is not a InstanceListNode');
      mergeNextSiblingListIfSameType(node);
      updateChildrenListItemValue(node);
    };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      ol: () => ({
        conversion: $convertInstanceListNode,
        priority: 0,
      }),
      ul: () => ({
        conversion: $convertInstanceListNode,
        priority: 0,
      }),
    };
  }

  static importJSON(serializedNode: SerializedInstanceListNode) {
    return $createInstanceListNode().updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    setDisable(this, element);
    element.setAttribute('list-type', this.getListType());
    return element;
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedInstanceListNode>,
  ): this {
    return super
      .updateFromJSON(serializedNode)
      .setListType(serializedNode.listType)
      .setStart(serializedNode.start);
  }

  exportJSON(): SerializedInstanceListNode {
    return {
      ...super.exportJSON(),
      listType: this.getListType(),
      start: this.getStart(),
      tag: this.getTag(),
    };
  }

  splice(
    start: number,
    deleteCount: number,
    nodesToInsert: LexicalNode[],
  ): this {
    let listItemNodesToInsert = nodesToInsert;
    for (let i = 0; i < nodesToInsert.length; i++) {
      const node = nodesToInsert[i];
      if (!$isInstanceListItemNode(node)) {
        if (listItemNodesToInsert === nodesToInsert) {
          listItemNodesToInsert = [...nodesToInsert];
        }
        listItemNodesToInsert[i] = $createInstanceListItemNode().append(
          $isElementNode(node) &&
            !($isInstanceListNode(node) || node.isInline())
            ? $createTextNode(node.getTextContent())
            : node,
        );
      }
    }
    return super.splice(start, deleteCount, listItemNodesToInsert);
  }

  extractWithChild(child: LexicalNode): boolean {
    return $isInstanceListItemNode(child);
  }
}

/*
 * This function normalizes the children of a InstanceListNode after the conversion from HTML,
 * ensuring that they are all ListItemNodes and contain either a single nested InstanceListNode
 * or some other inline content.
 */
function $normalizeChildren(
  nodes: Array<LexicalNode>,
): Array<InstanceListItemNode> {
  const normalizedListItems: Array<InstanceListItemNode> = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if ($isInstanceListItemNode(node)) {
      normalizedListItems.push(node);
      const children = node.getChildren();
      if (children.length > 1) {
        children.forEach((child) => {
          if ($isInstanceListNode(child)) {
            normalizedListItems.push($wrapInInstanceListItem(child));
          }
        });
      }
    } else {
      normalizedListItems.push($wrapInInstanceListItem(node));
    }
  }
  return normalizedListItems;
}

function isDomChecklist(domNode: HTMLElement) {
  if (
    domNode.getAttribute('__lexicallisttype') === 'check' ||
    // is github checklist
    domNode.classList.contains('contains-task-list')
  ) {
    return true;
  }
  // if children are checklist items, the node is a checklist ul. Applicable for googledoc checklist pasting.
  for (const child of domNode.childNodes) {
    if (isHTMLElement(child) && child.hasAttribute('aria-checked')) {
      return true;
    }
  }
  return false;
}

function $convertInstanceListNode(domNode: HTMLElement): DOMConversionOutput {
  const nodeName = domNode.nodeName.toLowerCase();
  let node = null;
  if (nodeName === 'ol') {
    // @ts-ignore
    const start = domNode.start;
    node = $createInstanceListNode('number', start);
  } else if (nodeName === 'ul') {
    if (isDomChecklist(domNode)) {
      node = $createInstanceListNode('check');
    } else {
      node = $createInstanceListNode('bullet');
    }
  }

  return {
    after: $normalizeChildren,
    node,
  };
}

const TAG_TO_LIST_TYPE: Record<string, ListType> = {
  ol: 'number',
  ul: 'bullet',
};

/**
 * Wraps a node into a ListItemNode.
 * @param node - The node to be wrapped into a ListItemNode
 * @returns The ListItemNode which the passed node is wrapped in.
 */
export function $wrapInInstanceListItem(
  node: LexicalNode,
): InstanceListItemNode {
  const listItemWrapper = $createInstanceListItemNode();
  return listItemWrapper.append(node);
}

/**
 * Creates a InstanceListNode of listType.
 * @param listType - The type of list to be created. Can be 'number', 'bullet', or 'check'.
 * @param start - Where an ordered list starts its count, start = 1 if left undefined.
 * @returns The new InstanceListNode
 */
export function $createInstanceListNode(
  listType: ListType = 'number',
  start = 1,
): InstanceListNode {
  return $applyNodeReplacement(new InstanceListNode(listType, start));
}

/**
 * Checks to see if the node is a InstanceListNode.
 * @param node - The node to be checked.
 * @returns true if the node is a InstanceListNode, false otherwise.
 */
export function $isInstanceListNode(
  node: LexicalNode | null | undefined,
): node is InstanceListNode {
  return node instanceof InstanceListNode;
}
