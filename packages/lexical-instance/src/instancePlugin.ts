/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {$isListItemNode} from '@lexical/list';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {
  $createTableCellNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableSelection,
  TableCellNode,
  TableRowNode,
} from '@lexical/table';
import {$findMatchingParent, mergeRegister} from '@lexical/utils';
import {
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  DELETE_CHARACTER_COMMAND,
  ElementNode,
  exportNodeToJSON,
  INSERT_PARAGRAPH_COMMAND,
  LexicalNode,
  SerializedLexicalNode,
} from 'lexical';
import {getStorageSerializedString} from 'onchain-lexical-markdown';
import {dfs} from 'onchain-utility/traversal';
import React, {useEffect} from 'react';

import {$isInstanceNode} from './base';
import {
  ADD_NEW_INSTANCE_NODE,
  DisableSelector,
  PluginProps,
  SPLIT_INSTANCE_NODE,
} from './const';
import {HorizontalRulePlugin} from './horizontal/horizontalPlugin';
import {$createInstanceListNode, $isInstanceListNode} from './list';
import {
  $isInstanceListItemNode,
  $registerInstanceListItemInsertParagraph,
} from './list/item';
import {
  $registerNumberDecoratorDomUpdate,
  $registerNumberDecoratorNodeUpdate,
} from './number';
import {
  $createInstanceParagraphNode,
  $registerInstanceParagraphNodeTransform,
} from './paragraph';
import {$registerInstanceHeadingNodeTransform} from './paragraph/title';
import {
  $createInstanceTableNode,
  $isInstanceTableNode,
  $registerTableCommand,
} from './table';
import {$addInstancesNode, clearCache, setTemporaryContentText} from './utils';

export const InstancePlugin: React.FC<PluginProps> = (props) => {
  const {placeholder} = props;
  const [editor] = useLexicalComposerContext();
  // const {setSelectedInstance} = useInstanceConfig();
  useEffect(() => {
    return mergeRegister(
      $registerInstanceParagraphNodeTransform(editor, {placeholder}),
      $registerInstanceHeadingNodeTransform(editor),
      $registerInstanceListItemInsertParagraph(editor),
      $registerNumberDecoratorNodeUpdate(editor),
      $registerNumberDecoratorDomUpdate(editor),
      $registerTableCommand(editor),
      // $selectionChange(editor, setSelectedInstance),
      editor.registerCommand(
        DELETE_CHARACTER_COMMAND,
        (event) => {
          const selection = $getSelection();
          if (selection) {
            return selection.getNodes().some((node) => {
              return editor
                .getElementByKey(node.getKey())
                ?.closest(DisableSelector);
            });
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        (event) => {
          const selection = $getSelection();
          const [start, end] = selection?.getStartEndPoints() || [];
          if (start && end && start.key === end.key) {
            return $isInstanceNode($getNodeByKey(start.key));
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        (event) => {
          const selection = $getSelection();
          const [start, end] = selection?.getStartEndPoints() || [];
          if (start && end && start.key === end.key) {
            return $isInstanceNode($getNodeByKey(start.key));
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        ADD_NEW_INSTANCE_NODE,
        ({insNodeKey, instances, isAddChildLevel}) => {
          $addInstancesNode({insNodeKey, instances, isAddChildLevel});
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
      /** 需求拆分 */
      editor.registerCommand(
        SPLIT_INSTANCE_NODE,
        ({selection, insNodeKey, instance, isAddChildLevel}) => {
          $setSelection(null);
          if ($isRangeSelection(selection) || $isTableSelection(selection)) {
            const forwardSelection = $createRangeSelection();
            const [startPoint, endPoint] = selection.isBackward()
              ? [selection.focus, selection.anchor]
              : [selection.anchor, selection.focus];
            forwardSelection.anchor.set(
              startPoint.key,
              startPoint.offset,
              startPoint.type,
            );
            forwardSelection.focus.set(
              endPoint.key,
              endPoint.offset,
              endPoint.type,
            );
            const nodes = forwardSelection.extract();

            const hasElementNode = nodes.some((node) => $isElementNode(node));
            const elementNodes: LexicalNode[] = [];
            if (!hasElementNode) {
              const paragraph = $createInstanceParagraphNode();
              nodes.forEach((node) => node.remove());
              paragraph.append(...nodes);
              elementNodes.push(paragraph);
            } else {
              if ($isTableSelection(selection)) {
                const size = {
                  cell: 0,
                  row: 0,
                  rowIndex: Infinity,
                };
                const newRowMap = new Map<number, TableRowNode>();
                const configs = selection
                  .getNodes()
                  .filter((node) => $isTableCellNode(node))
                  .map((node) => {
                    const row = node.getParent()!;
                    const rowIndex = row.getIndexWithinParent();
                    if (size.rowIndex !== rowIndex) {
                      size.rowIndex = rowIndex;
                      size.cell = 1;
                      size.row++;
                    } else {
                      size.cell++;
                    }
                    if (!newRowMap.has(rowIndex)) {
                      newRowMap.set(rowIndex, $createTableRowNode());
                    }
                    return {
                      col: node.getIndexWithinParent(),
                      node,
                      rowIndex: rowIndex,
                      rowNode: row,
                    };
                  });
                const tableNode = $createInstanceTableNode();
                const maxCellSize = configs[0].rowNode.getChildrenSize();
                const maxRowSize = configs[0].rowNode
                  .getParent()
                  ?.getChildrenSize();
                if (size.cell === maxCellSize) {
                  tableNode.append(...configs.map((config) => config.rowNode));
                } else {
                  configs.forEach((config) => {
                    const rowNode =
                      newRowMap.get(config.rowIndex) ||
                      newRowMap
                        .set(config.rowIndex, $createTableRowNode())
                        .get(config.rowIndex)!;
                    if (size.row !== maxRowSize) {
                      config.node.replace($createTableCellNode());
                    }
                    rowNode.append(config.node);
                  });
                  newRowMap.values().forEach((row) => {
                    tableNode.append(row);
                  });
                }
                elementNodes.push(tableNode);
              } else {
                const [startNode, endNode] = [
                  startPoint.getNode(),
                  endPoint.getNode(),
                ];

                const startAncestors = getAncestors(startNode);
                const endAncestors = getAncestors(endNode);

                const sameLevel = new Map<string, LexicalNode>();
                startAncestors.some((sa, idx) => {
                  const eaIdx = endAncestors.findIndex(
                    (ea, idx) => ea.getKey() === sa.getKey(),
                  );
                  const isSame = eaIdx > -1;
                  if (isSame) {
                    sameLevel.set('start', startAncestors[idx - 1]);
                    sameLevel.set('end', endAncestors[eaIdx - 1]);
                  }
                  return isSame;
                });

                const next = $getFollowUpNode({
                  node: startNode,
                  terminate: sameLevel.get('start'),
                  type: 'getNextSiblings',
                });
                const previous = $getFollowUpNode({
                  node: endNode.getNextSibling() || endNode,
                  terminate: sameLevel.get('end'),
                  type: 'getPreviousSiblings',
                });
                let node = next.original.getNextSibling();
                while (node && node.getKey() !== previous.original.getKey()) {
                  elementNodes.push(node);
                  node = node.getNextSibling();
                }
                elementNodes.unshift(...next.nodes);
                elementNodes.push(...previous.nodes);
                // 添加嵌套Item父List
                if (elementNodes.every((node) => $isListItemNode(node))) {
                  const originalListNode = $findMatchingParent(
                    next.original,
                    (node) => $isInstanceListNode(node),
                  );
                  if (originalListNode) {
                    const listNode = $createInstanceListNode(
                      originalListNode.getListType(),
                    );
                    listNode.append(...elementNodes);
                    elementNodes.length = 0;
                    (elementNodes as LexicalNode[]).push(listNode);
                  }
                }
              }
            }

            const paragraph = $createInstanceParagraphNode();
            paragraph.append(...elementNodes);
            const json = exportNodeToJSON<
              SerializedLexicalNode & {children: SerializedLexicalNode[]}
            >(paragraph);
            setTemporaryContentText(
              instance,
              getStorageSerializedString(json.children),
            );

            $addInstancesNode({
              insNodeKey,
              instances: [instance],
              isAddChildLevel,
            });
          }
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, placeholder]);
  useEffect(() => {
    return () => {
      clearCache();
    };
  }, []);
  return React.createElement(
    React.Fragment,
    {},
    React.createElement(HorizontalRulePlugin),
  );
};

function getDescendants(node: ElementNode) {
  if ($isElementNode(node)) {
    return dfs(node.getChildren(), (node) => {
      if ($isElementNode(node)) {
        return node.getChildren();
      } else {
        return [];
      }
    });
  } else {
    return [];
  }
}

function getAncestors(node: LexicalNode) {
  const parent = node.getParent();
  if (parent) {
    return dfs([parent], (node) => {
      const parent = node.getParent();
      if (parent) {
        return [parent];
      } else {
        return [];
      }
    });
  } else {
    return [];
  }
}

function $getFollowUpNode({
  node,
  terminate,
  type,
}: {
  node: LexicalNode;
  terminate?: LexicalNode;
  type: 'getNextSiblings' | 'getPreviousSiblings';
}) {
  const isTableCellNode = $isTableCellNode(node);
  if (isTableCellNode) {
    const descendants = getDescendants(node as TableCellNode);
    const text = $createTextNode('');
    node = text;
    if (type === 'getNextSiblings') {
      descendants[0].insertBefore(text);
    } else {
      descendants[descendants.length - 1].insertAfter(text);
    }
  }

  const ancestors = terminate ? [terminate] : getAncestors(node);
  const index = ancestors.findIndex((node) => $isInstanceNode(node));
  const term = ancestors[index - 1] || ancestors[ancestors.length - 1];
  const original = term;

  // console.log(
  //   {
  //     node,
  //     original,
  //     terminate,
  //     type,
  //   },
  //   'getFollowUpNode',
  // );

  const set = new Set<LexicalNode>();
  const termKey = term.getKey();
  dfs([node], (node) => {
    const parent = node.getParent();
    const parentKey = parent?.getKey();
    const isStop = parentKey === termKey;
    const siblings = node[type]();
    siblings.forEach((sibling) => {
      if ($isInstanceListItemNode(sibling)) {
        sibling.defaultRemove();
        return;
      }
      sibling.remove();
    });
    if (parent) {
      const constructor = parent.constructor;
      const newParent = constructor.importJSON(
        parent.exportJSON(),
      ) as ElementNode;
      newParent.append(...siblings);
      if (set.size) {
        const children = Array.from(set)[0];
        if (type === 'getNextSiblings') {
          if (siblings.length) {
            siblings[0].insertBefore(children);
          } else {
            newParent.append(children);
          }
        } else {
          if (siblings.length) {
            siblings[siblings.length - 1].insertAfter(children);
          } else {
            newParent.append(children);
          }
        }
        set.clear();
      }
      set.add(newParent);
    }
    if (isStop || !parent) {
      return [];
    } else {
      return [parent].filter(Boolean);
    }
  });
  if (isTableCellNode) {
    const tableNode = $findMatchingParent(node, (node) =>
      $isInstanceTableNode(node),
    );
    if (tableNode) {
      tableNode.remove();
    }
  }
  return {
    nodes: Array.from(set.values()),
    original,
  };
}
