/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type {
  InsertTableCommandPayload,
  InsertTableCommandPayloadHeaders,
  TableDOMTable,
} from '@lexical/table';

import {
  $createTableCellNode,
  $createTableRowNode,
  $findTableNode,
  $isTableRowNode,
  getTable,
  INSERT_TABLE_COMMAND,
  PIXEL_VALUE_REG_EXP,
  TableCellHeaderStates,
  TableNode,
} from '@lexical/table';
import {$descendantsMatching, $insertNodeToNearestRoot} from '@lexical/utils';
import {
  $applyNodeReplacement,
  $createTextNode,
  $getEditor,
  $getPreviousSelection,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_LOW,
  DOMConversionMap,
  DOMConversionOutput,
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  SerializedElementNode,
  Spread,
} from 'lexical';
import invariant from 'shared/invariant';

import {$createInstanceParagraphNode} from '../paragraph';
import {setDisable} from '../utils';

export type SerializedInstanceTableNode = Spread<
  {
    colWidths?: readonly number[];
    rowStriping?: boolean;
    frozenColumnCount?: number;
    frozenRowCount?: number;
  },
  SerializedElementNode
>;

const scrollableEditors = new WeakSet<LexicalEditor>();

export function $isScrollableTablesActive(
  editor: LexicalEditor = $getEditor(),
): boolean {
  return scrollableEditors.has(editor);
}

export function setScrollableTablesActive(
  editor: LexicalEditor,
  active: boolean,
): void {
  if (active) {
    if (!editor._config.theme.tableScrollableWrapper) {
      console.warn(
        'InstanceTableNode: hasHorizontalScroll is active but theme.tableScrollableWrapper is not defined.',
      );
    }
    scrollableEditors.add(editor);
  } else {
    scrollableEditors.delete(editor);
  }
}

/** @noInheritDoc */
export class InstanceTableNode extends TableNode {
  static getType(): string {
    return 'table';
  }

  static clone(node: InstanceTableNode): InstanceTableNode {
    return new InstanceTableNode(node.__key);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      table: (_node: Node) => ({
        conversion: $convertTableElement,
        priority: 1,
      }),
    };
  }

  static importJSON(
    serializedNode: SerializedInstanceTableNode,
  ): InstanceTableNode {
    return $createInstanceTableNode().updateFromJSON(serializedNode);
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    setDisable(this, element);
    return element;
  }

  remove(preserveEmptyParent?: boolean): void {
    this.replace($createInstanceParagraphNode());
  }
}

export function $getElementForInstanceTableNode(
  editor: LexicalEditor,
  InstanceTableNode: InstanceTableNode,
): TableDOMTable {
  const tableElement = editor.getElementByKey(InstanceTableNode.getKey());
  invariant(
    tableElement !== null,
    '$getElementForInstanceTableNode: Table Element Not Found',
  );
  return getTable(InstanceTableNode, tableElement);
}

export function $convertTableElement(
  domNode: HTMLElement,
): DOMConversionOutput {
  const InstanceTableNode = $createInstanceTableNode();
  if (domNode.hasAttribute('data-lexical-row-striping')) {
    InstanceTableNode.setRowStriping(true);
  }
  const colGroup = domNode.querySelector(':scope > colgroup');
  if (colGroup) {
    let columns: number[] | undefined = [];
    for (const col of colGroup.querySelectorAll(':scope > col')) {
      let width = (col as HTMLElement).style.width || '';
      if (!PIXEL_VALUE_REG_EXP.test(width)) {
        // Also support deprecated width attribute for google docs
        width = col.getAttribute('width') || '';
        if (!/^\d+$/.test(width)) {
          columns = undefined;
          break;
        }
      }
      columns.push(parseFloat(width));
    }
    if (columns) {
      InstanceTableNode.setColWidths(columns);
    }
  }
  return {
    after: (children) => $descendantsMatching(children, $isTableRowNode),
    node: InstanceTableNode,
  };
}

export function $createInstanceTableNode(): InstanceTableNode {
  return $applyNodeReplacement(new InstanceTableNode());
}

export function $isInstanceTableNode(
  node: LexicalNode | null | undefined,
): node is InstanceTableNode {
  return node instanceof InstanceTableNode;
}

export function $registerTableCommand(editor: LexicalEditor) {
  return editor.registerCommand(
    INSERT_TABLE_COMMAND,
    ({rows, columns, includeHeaders}: InsertTableCommandPayload) => {
      const selection = $getSelection() || $getPreviousSelection();
      if (!selection || !$isRangeSelection(selection)) {
        return false;
      }

      // Prevent nested tables by checking if we're already inside a table
      if ($findTableNode(selection.anchor.getNode())) {
        return false;
      }

      const tableNode = $createTableNodeWithDimensions(
        Number(rows),
        Number(columns),
        includeHeaders,
      );
      $insertNodeToNearestRoot(tableNode);

      const firstDescendant = tableNode.getFirstDescendant();
      if ($isTextNode(firstDescendant)) {
        firstDescendant.select();
      }

      return true;
    },
    COMMAND_PRIORITY_LOW,
  );
}

export function $createTableNodeWithDimensions(
  rowCount: number,
  columnCount: number,
  includeHeaders: InsertTableCommandPayloadHeaders = true,
): TableNode {
  const tableNode = $createInstanceTableNode();

  for (let iRow = 0; iRow < rowCount; iRow++) {
    const tableRowNode = $createTableRowNode();

    for (let iColumn = 0; iColumn < columnCount; iColumn++) {
      let headerState = TableCellHeaderStates.NO_STATUS;

      if (typeof includeHeaders === 'object') {
        if (iRow === 0 && includeHeaders.rows) {
          headerState |= TableCellHeaderStates.ROW;
        }
        if (iColumn === 0 && includeHeaders.columns) {
          headerState |= TableCellHeaderStates.COLUMN;
        }
      } else if (includeHeaders) {
        if (iRow === 0) {
          headerState |= TableCellHeaderStates.ROW;
        }
        if (iColumn === 0) {
          headerState |= TableCellHeaderStates.COLUMN;
        }
      }

      const tableCellNode = $createTableCellNode(headerState);
      const paragraphNode = $createInstanceParagraphNode();
      paragraphNode.append($createTextNode());
      tableCellNode.append(paragraphNode);
      tableRowNode.append(tableCellNode);
    }

    tableNode.append(tableRowNode);
  }

  return tableNode;
}
