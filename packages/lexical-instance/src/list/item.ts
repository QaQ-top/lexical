/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {$isListItemNode, $isListNode, ListItemNode} from '@lexical/list';
import {$setBlocksType} from '@lexical/selection';
import {
  $applyNodeReplacement,
  $getSelection,
  $isElementNode,
  BaseSelection,
  COMMAND_PRIORITY_NORMAL,
  DOMConversionMap,
  DOMConversionOutput,
  EditorConfig,
  ElementNode,
  INSERT_PARAGRAPH_COMMAND,
  LexicalEditor,
  LexicalNode,
  LexicalUpdateJSON,
  RangeSelection,
  SerializedElementNode,
  Spread,
} from 'lexical';
import invariant from 'shared/invariant';

import {
  $createInstanceParagraphNode,
  InstanceParagraphNode,
} from '../paragraph';
import {setDisable} from '../utils';
import {$createInstanceListNode} from '.';
import {
  $handleIndent,
  $handleListInsertParagraph,
  $handleOutdent,
} from './formatList';

export type SerializedInstanceListItemNode = Spread<
  {
    checked: boolean | undefined;
    value: number;
  },
  SerializedElementNode
>;

/** @noInheritDoc */
export class InstanceListItemNode extends ListItemNode {
  static getType(): string {
    return 'ListItem';
  }

  static clone(node: InstanceListItemNode): InstanceListItemNode {
    return new InstanceListItemNode(node.__value, node.__checked, node.__key);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      li: () => ({
        conversion: $convertListItemElement,
        priority: 0,
      }),
    };
  }

  static importJSON(serializedNode: SerializedInstanceListItemNode) {
    return $createInstanceListItemNode().updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    setDisable(this, element);
    return element;
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedInstanceListItemNode>,
  ): this {
    return super
      .updateFromJSON(serializedNode)
      .setValue(serializedNode.value)
      .setChecked(serializedNode.checked);
  }

  exportJSON(): SerializedInstanceListItemNode {
    return {
      ...super.exportJSON(),
      checked: this.getChecked(),
      value: this.getValue(),
    };
  }

  replace<N extends LexicalNode>(
    replaceWithNode: N,
    includeChildren?: boolean,
  ): N {
    if ($isListItemNode(replaceWithNode)) {
      return super.replace(replaceWithNode);
    }
    this.setIndent(0);
    const list = this.getParentOrThrow();
    if (!$isListNode(list)) {
      return replaceWithNode;
    }
    if (list.__first === this.getKey()) {
      list.insertBefore(replaceWithNode);
    } else if (list.__last === this.getKey()) {
      list.insertAfter(replaceWithNode);
    } else {
      // Split the list
      const newList = $createInstanceListNode(list.getListType());
      let nextSibling = this.getNextSibling();
      while (nextSibling) {
        const nodeToAppend = nextSibling;
        nextSibling = nextSibling.getNextSibling();
        newList.append(nodeToAppend);
      }
      list.insertAfter(replaceWithNode);
      replaceWithNode.insertAfter(newList);
    }
    if (includeChildren) {
      invariant(
        $isElementNode(replaceWithNode),
        'includeChildren should only be true for ElementNodes',
      );
      this.getChildren().forEach((child: LexicalNode) => {
        replaceWithNode.append(child);
      });
    }
    super.remove();
    if (list.getChildrenSize() === 0) {
      list.remove();
    }
    return replaceWithNode;
  }

  insertAfter(node: LexicalNode, restoreSelection = true): LexicalNode {
    const listNode = this.getParentOrThrow();

    if (!$isListNode(listNode)) {
      invariant(
        false,
        'insertAfter: list node is not parent of list item node',
      );
    }

    if ($isListItemNode(node)) {
      return super.insertAfter(node, restoreSelection);
    }

    const siblings = this.getNextSiblings();

    // Split the lists and insert the node in between them
    listNode.insertAfter(node, restoreSelection);

    if (siblings.length !== 0) {
      const newListNode = $createInstanceListNode(listNode.getListType());

      siblings.forEach((sibling) => newListNode.append(sibling));

      node.insertAfter(newListNode, restoreSelection);
    }

    return node;
  }

  setIndent(indent: number): this {
    invariant(typeof indent === 'number', 'Invalid indent value.');
    indent = Math.floor(indent);
    invariant(indent >= 0, 'Indent value must be non-negative.');
    let currentIndent = this.getIndent();
    while (currentIndent !== indent) {
      if (currentIndent < indent) {
        $handleIndent(this);
        currentIndent++;
      } else {
        $handleOutdent(this);
        currentIndent--;
      }
    }

    return this;
  }

  /** 删除行时会判断是否是最后一行，从而替换父级数据，
   * 调用 this.remove 时需要根据具体需求调用，如果只是单纯的删除行，
   * 请调用 super.remove
   */
  remove(preserveEmptyParent?: boolean): void {
    const selection = $getSelection();
    if (selection) {
      this.collapseAtStart(selection);
    } else {
      super.remove(preserveEmptyParent);
    }
  }

  insertNewAfter(
    selection: RangeSelection,
    restoreSelection = true,
  ): InstanceListItemNode | InstanceParagraphNode {
    const [node] = selection.getNodes();
    if ($isInstanceListItemNode(node) && node.getChildren().length === 0) {
      // 列表内无数据时清空格式
      let newElement: InstanceParagraphNode | null = null;
      $setBlocksType(
        selection,
        () => (newElement = $createInstanceParagraphNode()),
      );
      return newElement!;
    } else {
      const newElement = $createInstanceListItemNode()
        .updateFromJSON(this.exportJSON())
        .setChecked(this.getChecked() ? false : undefined);
      this.insertAfter(newElement, restoreSelection);
      return newElement;
    }
  }

  collapseAtStart(selection: BaseSelection): true {
    const paragraph = $createInstanceParagraphNode();
    const children = this.getChildren();
    children.forEach((child) => paragraph.append(child));
    const listNode = this.getParentOrThrow();
    const listNodeParent = listNode.getParent();
    const isIndented = $isListItemNode(listNodeParent);

    if (listNode.getChildrenSize() === 1) {
      if (isIndented) {
        // 如果列表节点是嵌套的，我们只需将其移除即可，
        // 实际上是取消缩进。
        listNode.remove();
        listNodeParent.select();
      } else {
        if (listNodeParent) {
          listNode.replace(paragraph);
        }
        // 如果我们选择了列表项，我们需要将其移动到段落
        const [anchor, focus] = selection.getStartEndPoints() || [];
        const key = paragraph.getKey();

        if (anchor && anchor.type === 'element' && anchor.getNode().is(this)) {
          anchor.set(key, anchor.offset, 'element');
        }

        if (focus && focus.type === 'element' && focus.getNode().is(this)) {
          focus.set(key, focus.offset, 'element');
        }
      }
    } else {
      super.remove();
    }
    return true;
  }

  createParentElementNode(): ElementNode {
    return $createInstanceListNode('bullet');
  }
}

function $convertListItemElement(domNode: HTMLElement): DOMConversionOutput {
  const isGitHubCheckList = domNode.classList.contains('task-list-item');
  if (isGitHubCheckList) {
    for (const child of domNode.children) {
      if (child.tagName === 'INPUT') {
        return $convertCheckboxInput(child);
      }
    }
  }

  const ariaCheckedAttr = domNode.getAttribute('aria-checked');
  const checked =
    ariaCheckedAttr === 'true'
      ? true
      : ariaCheckedAttr === 'false'
      ? false
      : undefined;
  return {node: $createInstanceListItemNode(checked)};
}

function $convertCheckboxInput(domNode: Element): DOMConversionOutput {
  const isCheckboxInput = domNode.getAttribute('type') === 'checkbox';
  if (!isCheckboxInput) {
    return {node: null};
  }
  const checked = domNode.hasAttribute('checked');
  return {node: $createInstanceListItemNode(checked)};
}

/**
 * Creates a new List Item node, passing true/false will convert it to a checkbox input.
 * @param checked - Is the List Item a checkbox and, if so, is it checked? undefined/null: not a checkbox, true/false is a checkbox and checked/unchecked, respectively.
 * @returns The new List Item.
 */
export function $createInstanceListItemNode(
  checked?: boolean,
): InstanceListItemNode {
  return $applyNodeReplacement(new InstanceListItemNode(undefined, checked));
}

/**
 * Checks to see if the node is a InstanceListItemNode.
 * @param node - The node to be checked.
 * @returns true if the node is a InstanceListItemNode, false otherwise.
 */
export function $isInstanceListItemNode(
  node: LexicalNode | null | undefined,
): node is InstanceListItemNode {
  return node instanceof InstanceListItemNode;
}

export function $registerInstanceListItemInsertParagraph(
  editor: LexicalEditor,
) {
  return editor.registerCommand(
    INSERT_PARAGRAPH_COMMAND,
    (...e) => {
      return $handleListInsertParagraph();
    },
    COMMAND_PRIORITY_NORMAL,
  );
}
