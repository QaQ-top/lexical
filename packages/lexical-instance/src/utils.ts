/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type {HistoryState, HistoryStateEntry} from '@lexical/history';

import {$isCodeNode} from '@lexical/code';
import {$isListNode} from '@lexical/list';
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$isQuoteNode} from '@lexical/rich-text';
import {$findMatchingParent} from '@lexical/utils';
import {
  $createRangeSelection,
  $getEditor,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isRootNode,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_CRITICAL,
  DecoratorNode,
  type EditorThemeClasses,
  ElementNode,
  LexicalEditor,
  type LexicalNode,
  scrollIntoViewIfNeeded,
  SELECTION_CHANGE_COMMAND,
  TextNode,
} from 'lexical';
import {$isRootOrShadowRoot} from 'lexical';
import {$textToRichNodes} from 'onchain-lexical-markdown';
import {dfs, hasOwnProperty} from 'onchain-utility';
import {useCallback, useEffect, useState} from 'react';
import normalizeClassNames from 'shared/normalizeClassNames';

import {$createBarDecoratorNode, $isBarDecoratorNode} from './bar';
import {
  $createInstanceNode,
  $createTitleOnlyInstanceNode,
  $isInstanceNode,
  InstanceNode,
} from './base';
import {
  DisableSelector,
  INSTANCE_TITLE_UPDATE,
  internalLinkNameUpdateMap,
  numberNodeKey,
  paragraphSymbol,
} from './const';
import {$createFragmentNode} from './fragment';
import {InstanceHeadingNode} from './heading';
import {
  $createInstanceParagraphNode,
  $isInstanceParagraphNode,
  InstanceParagraphNode,
} from './paragraph';
import {$isInstanceTitleNode} from './paragraph/title';
import {CompleteInstance, Instance, InstanceBaseInfo} from './types';

export {ADD_NEW_INSTANCE_NODE, OPEN_CREATE_WINDOW} from './const';

/** 获取用户自定义类名 */
export function getCachedClassNameArray(
  classNamesTheme: EditorThemeClasses,
  classNameThemeType: string,
): Array<string> {
  if (classNamesTheme.__lexicalClassNameCache === undefined) {
    classNamesTheme.__lexicalClassNameCache = {};
  }
  const classNamesCache = classNamesTheme.__lexicalClassNameCache;
  const cachedClassNames = classNamesCache[classNameThemeType];
  if (cachedClassNames !== undefined) {
    return cachedClassNames;
  }
  const classNames = classNamesTheme[classNameThemeType];
  // As we're using classList, we need
  // to handle className tokens that have spaces.
  // The easiest way to do this to convert the
  // className tokens to an array that can be
  // applied to classList.add()/remove().
  if (typeof classNames === 'string') {
    const classNamesArr = normalizeClassNames(classNames);
    classNamesCache[classNameThemeType] = classNamesArr;
    return classNamesArr;
  }
  return classNames;
}

/** 是否是文本标签 */
export function $isTextTypeNode(node: LexicalNode | null | undefined) {
  return [TextNode, InstanceHeadingNode].some((I) => node instanceof I);
}

/** 是否是具有段落格式节点 */
export function $isInstanceParagraphFormalNode(
  node: LexicalNode | null | undefined,
) {
  return [InstanceHeadingNode, InstanceParagraphNode].some(
    (I) => node instanceof I,
  );
}

/** 获取当前段落根锚点 */
export function $getAnchorRootNode(anchorNode: LexicalNode) {
  if ($isInstanceParagraphFormalNode(anchorNode)) {
    return anchorNode;
  } else {
    return anchorNode.getKey() === 'root'
      ? anchorNode
      : $findMatchingParent(anchorNode, (node) => {
          const parent = node.getParent();
          return (
            $isListNode(node) ||
            $isCodeNode(node) ||
            $isQuoteNode(node) ||
            $isInstanceParagraphFormalNode(node) ||
            (parent !== null && $isRootOrShadowRoot(parent))
          );
        });
  }
}
/** 是否在实例标题节点内 */
export function $isInInstanceTitleNode(node: LexicalNode) {
  return !!$findMatchingParent(node, (e) => {
    const parent = e.getParent();
    return $isInstanceTitleNode(parent);
  });
}

export function $getInstanceNodeByChild(node: LexicalNode) {
  return $findMatchingParent(node, (e) => {
    return $isInstanceNode(e);
  });
}

export function $getTitleNodeByChild(node: LexicalNode) {
  return $findMatchingParent(node, (e) => {
    return $isInstanceParagraphNode(e) && e.isTitle;
  });
}

/** 是否是选中实例标题节点 */
export function $isSelectedTitleNode() {
  const selection = $getSelection();
  const [start, end] = selection?.getStartEndPoints() || [];

  return (
    (start && $isInInstanceTitleNode(start.getNode())) ||
    (end && $isInInstanceTitleNode(end.getNode()))
  );
}

export function $isRemoved<T extends LexicalNode>(node: T) {
  return !node.getParent() && !$isRootNode(node);
}

export function setInstanceAttrValue<T extends keyof Instance>(
  __instance: Instance,
  key: T,
  value: Instance[T],
) {
  const newVal = {[key]: value};
  if (__instance.newVal) {
    Object.assign(__instance.newVal, newVal);
  } else {
    Object.assign(__instance, {newVal});
  }
}

export function getInstanceAttrValue<T extends keyof Instance>(
  __instance: Instance,
  key: T,
): Instance[T] {
  if (
    __instance.newVal &&
    Object.prototype.hasOwnProperty.call(__instance.newVal, key)
  ) {
    return __instance.newVal[key as string];
  } else {
    return __instance[key];
  }
}

export function getInstanceBaseInfo(
  instance?: Instance,
): InstanceBaseInfo | undefined {
  if (instance) {
    return {
      insDesc: instance.insDesc,
      insId: instance.insId || instance.id,
      itemCode: instance.itemCode,
      number: instance.number,
      objectApicode: instance.objectApicode,
    };
  }
}

export function isCompleteInstance(
  instance: Instance,
): instance is CompleteInstance {
  return !!instance.insId;
}

export function getLatestValue<
  T extends {
    newVal?: any;
    inProcess?: any;
    [k: string]: any;
  },
  K extends keyof T,
>(data: T, key: K): T[K] {
  if (hasOwnProperty(data.newVal, key)) {
    return data.newVal[key];
  }
  if (hasOwnProperty(data.inProcess, key)) {
    return data.inProcess[key];
  }
  return data[key];
}

/**
 * 跳转到指定实例
 * dom 属性 data-scrollTo=“false” 时可以禁止跳转
 */
export function $scrollTo(number: string) {
  const editor = $getEditor();
  const nodeKey = numberNodeKey.get(number);
  const rootElement = editor.getRootElement();
  if (nodeKey && rootElement) {
    const instanceNode = $getNodeByKey<InstanceNode>(nodeKey);
    const [, numberNode] = instanceNode?.getChildren() || [];
    const target = editor.getElementByKey(numberNode.getKey() || nodeKey);
    if (target) {
      scrollIntoViewIfNeeded(
        editor,
        target.getBoundingClientRect(),
        rootElement,
        document.querySelector<HTMLDivElement>(
          '.top-container.editor-container',
        ),
      );
      $getNodeByKey(nodeKey)?.selectStart();
    }
  }
}

export function clearCache() {
  paragraphSymbol.clear();
  numberNodeKey.clear();
  internalLinkNameUpdateMap.clear();
}

export function $getInstanceNodeKeyByNumber(number: string) {
  const key = numberNodeKey.get(number);
  return key;
}

export function $getInstanceNodeByNumber(number: string) {
  const key = $getInstanceNodeKeyByNumber(number);
  if (key) {
    return $getNodeByKey<InstanceNode>(key);
  }
}

export function updateRelatedInternalLink<T extends ElementNode>(nodes: T[]) {
  const insNodes = nodes.filter((node) => $isInstanceNode(node));
  if (insNodes.length) {
    insNodes.forEach((node) => {
      const editor = $getEditor();
      Promise.resolve().then(() => {
        editor.read(() => {
          editor.dispatchCommand(INSTANCE_TITLE_UPDATE, {
            number: node.__instance.value.number!,
          });
        });
      });
    });
  }
}

export function nodeMoveUp<T extends ElementNode>(nodes?: T[] | null) {
  if (nodes) {
    const previous = nodes[0].getPreviousSibling();
    for (let index = nodes.length - 1; index > -1; index--) {
      const current = nodes[index];
      const pre = nodes[index + 1];
      if (pre) {
        pre.insertBefore(current);
      } else {
        previous?.insertBefore(current);
      }
    }
    updateRelatedInternalLink(
      $isInstanceNode(previous) ? [...nodes, previous] : nodes,
    );
  }
}

export function nodeMoveDown<T extends ElementNode>(nodes?: T[] | null) {
  if (nodes) {
    const next = nodes[nodes.length - 1].getNextSibling();
    for (let index = 0; index < nodes.length; index++) {
      const current = nodes[index];
      const pre = nodes[index - 1];
      if (pre) {
        pre.insertAfter(current);
      } else {
        next?.insertAfter(current);
      }
    }
    updateRelatedInternalLink($isInstanceNode(next) ? [...nodes, next] : nodes);
  }
}

export async function $nodeUpgrade<T extends ElementNode>(nodes?: T[] | null) {
  if (nodes) {
    const parent = nodes[0].getParent();
    const bar = parent?.getChildren().find((node) => $isBarDecoratorNode(node));
    for (let index = 0; index < nodes.length; index++) {
      const current = nodes[index];
      const pre = nodes[index - 1];
      if (pre) {
        pre.insertAfter(current);
      } else {
        parent?.insertAfter(current);
      }
    }
    if (bar) {
      bar.replace($createBarDecoratorNode());
    }
    updateRelatedInternalLink(nodes);
  }
}

export async function $nodeDowngrade<T extends ElementNode>(
  nodes?: T[] | null,
) {
  if (nodes) {
    const previous = nodes[0].getPreviousSibling();
    if ($isElementNode(previous)) {
      const bar = previous
        ?.getChildren()
        .find((node) => $isBarDecoratorNode(node));
      previous.append(...nodes);
      if (bar) {
        bar.replace($createBarDecoratorNode());
      }
    }
    updateRelatedInternalLink(nodes);
  }
}

export function setTemporaryContentText<T extends Instance>(
  instance: T,
  text: string = '',
) {
  instance.__contentText = text;
  return instance;
}

export function getTemporaryContentText<T extends Instance>(instance: T) {
  return instance.__contentText || '';
}

export function setDisable(node: ElementNode, element: HTMLElement) {
  const parent = node.getParent();
  if ($isInstanceNode(parent)) {
    if (parent.__instance.value.disable) {
      element.setAttribute('usable', 'false');
    } else {
      element.setAttribute('usable', 'true');
    }
  }
}

/** 更新富文本实例名称 */
export function $updateRichInstanceTitle(
  instance: Instance,
  {text}: {text: string},
) {
  const insNode = $getInstanceNodeByNumber(instance.number!);
  if ($isInstanceNode(insNode)) {
    const [, , title] = insNode.getChildren();
    if ($isInstanceParagraphNode(title)) {
      const textNode = title.getFirstTextNode();
      textNode.setTextContent(text);
    }
  }
}

export function $updateRichInstanceContent(
  instance: Instance,
  {content}: {content: string},
) {
  const insNode = $getInstanceNodeByNumber(instance.number!);
  if ($isInstanceNode(insNode)) {
    const fragment = $createFragmentNode();
    $textToRichNodes(fragment, content);
    const nodes = correctedInstanceParagraph(fragment.getChildren(), () =>
      $createInstanceParagraphNode(),
    );
    const oldChildren = insNode
      .getPracticalChildren()
      .filter((node) => !$isInstanceNode(node))
      .slice(1, Infinity);
    const previous = oldChildren.at(0);
    for (let index = nodes.length - 1; index > -1; index--) {
      const current = nodes[index];
      const pre = nodes[index + 1];
      if (pre) {
        pre.insertBefore(current);
      } else {
        previous?.insertBefore(current);
      }
    }
    oldChildren.forEach((node) => node.remove());
    return nodes;
  }
  return [];
}

export function $updateRichHistoryStateMap(
  instance: Instance,
  {editor, historyState}: {editor: LexicalEditor; historyState: HistoryState},
) {
  editor.read(() => {
    const node = $getInstanceNodeByNumber(instance.number!);
    if (node) {
      const current = historyState?.current?.editorState;
      if (current) {
        historyState.current = setHSEntryMap([historyState.current!], node)[0];
        historyState.redoStack = setHSEntryMap(historyState.redoStack, node);
        historyState.undoStack = setHSEntryMap(historyState.undoStack, node);
      }
    }
  });
}

function setHSEntryMap(hs: HistoryStateEntry[], instanceNode: InstanceNode) {
  return hs.map((state) => {
    const map = new Map(state.editorState._nodeMap.entries());
    map.set(instanceNode.getKey(), instanceNode);
    dfs(
      instanceNode
        .getPracticalChildren()
        .filter((node) => !$isInstanceNode(node)),
      (node) => {
        map.set(node.getKey(), node);
        if ($isElementNode(node)) {
          return node.getChildren();
        }
        return [];
      },
    );
    state.editorState._nodeMap = map;
    return state;
  });
}

export function useContentEditable() {
  const [editor] = useLexicalComposerContext();
  const [contentEditable, setContentEditable] = useState(true);

  const $updateContentEditable = useCallback(() => {
    const selection = $getSelection();
    if (selection) {
      setContentEditable(
        !selection.getNodes().some((node) => {
          return (
            editor.getElementByKey(node.getKey())?.closest(DisableSelector) ||
            $isInInstanceTitleNode(node)
          );
        }),
      );
    }
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      (_payload) => {
        $updateContentEditable();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, $updateContentEditable]);

  return {
    contentEditable,
  };
}

/** 修正实例内行条目，避免过少段落导致左边操作栏位子不够 */
export function correctedInstanceParagraph<T>(
  nodes: T[],
  createParagraph: () => T,
) {
  const count = InstanceNode.DEFAULT_PARAGRAPHS - 1;
  for (let index = 0; index < count; index++) {
    const node = nodes[index];
    if (!node /**  || !$isInstanceParagraphNode(node) */) {
      nodes.splice(index, 0, createParagraph());
    }
  }
  return nodes;
}

/** 添加新实例节点 */
export function $addInstancesNode({
  isAddChildLevel,
  instances,
  insNodeKey,
}: {
  instances: Instance[];
  isAddChildLevel: boolean;
  insNodeKey?: string;
}) {
  if (insNodeKey) {
    const insNode = $getNodeByKey(insNodeKey);
    if ($isInstanceNode(insNode)) {
      const newInsNodes = instances.map((instance) => {
        const contentText = getTemporaryContentText(instance);
        if (contentText) {
          const node = $createTitleOnlyInstanceNode(instance);
          const fragment = $createFragmentNode();
          $textToRichNodes(fragment, contentText);
          const nodes = correctedInstanceParagraph(fragment.getChildren(), () =>
            $createInstanceParagraphNode(),
          );
          node.append(...nodes);
          return node;
        } else {
          return $createInstanceNode(instance);
        }
      });
      if (isAddChildLevel) {
        const [insChildNode] = insNode.getSelfInstanceChildren();
        if (insChildNode) {
          for (let index = newInsNodes.length - 1; index > -1; index--) {
            const current = newInsNodes[index];
            const pre = newInsNodes[index + 1];
            if (pre) {
              pre.insertBefore(current);
            } else {
              insChildNode.insertBefore(current);
            }
          }
        } else {
          insNode.append(...newInsNodes);
        }
      } else {
        for (let index = 0; index < newInsNodes.length; index++) {
          const current = newInsNodes[index];
          const pre = newInsNodes[index - 1];
          if (pre) {
            pre.insertAfter(current);
          } else {
            insNode.insertAfter(current);
          }
        }
      }
      newInsNodes[0].selectStart();
    }
  }
}

export function $selectDecoratorNode<T>(node?: DecoratorNode<T> | null) {
  if (node) {
    const [previous, next] = [node.getPreviousSibling(), node.getNextSibling()];
    const rangeSelection = $createRangeSelection();
    if (previous) {
      const isText = $isTextNode(previous);
      rangeSelection.anchor.set(
        isText ? previous.getKey() : node.getParent()!.getKey(),
        isText
          ? previous.getTextContentSize()
          : node.getPreviousSiblings().length,
        isText ? 'text' : 'element',
      );
    } else {
      const parent = node.getParent()!;
      rangeSelection.anchor.set(parent.getKey(), 0, 'element');
    }
    if (next) {
      rangeSelection.focus.set(
        next.getKey(),
        0,
        $isTextNode(next) ? 'text' : 'element',
      );
    } else {
      const parent = node.getParent()!;
      rangeSelection.focus.set(
        parent.getKey(),
        node.getPreviousSiblings().length + 1,
        'element',
      );
    }
    $setSelection(rangeSelection);
  }
}
