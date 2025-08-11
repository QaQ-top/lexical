/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {$isCodeNode} from '@lexical/code';
import {$isListNode} from '@lexical/list';
import {$isQuoteNode} from '@lexical/rich-text';
import {$findMatchingParent} from '@lexical/utils';
import {
  $getEditor,
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isRootNode,
  type EditorThemeClasses,
  ElementNode,
  type LexicalNode,
  scrollIntoViewIfNeeded,
  TextNode,
} from 'lexical';
import {$isRootOrShadowRoot} from 'lexical';
import {hasOwnProperty} from 'onchain-utility';
import normalizeClassNames from 'shared/normalizeClassNames';

import {$isInstanceNode} from './base';
import {numberNodeKey, paragraphSymbol} from './const';
import {InstanceHeadingNode} from './heading';
import {InstanceParagraphNode} from './paragraph';
import {$isInstanceTitleNode} from './paragraph/title';
import {CompleteInstance, Instance, InstanceBaseInfo} from './types';

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
      insId: instance.insId,
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

export function $scrollTo(number: string) {
  const editor = $getEditor();
  const nodeKey = numberNodeKey.get(number);
  const rootElement = editor.getRootElement();
  if (nodeKey && rootElement) {
    const target = editor.getElementByKey(nodeKey);
    if (target) {
      scrollIntoViewIfNeeded(
        editor,
        target.getBoundingClientRect(),
        rootElement,
      );
      $getNodeByKey(nodeKey)?.selectStart();
    }
  }
}

export function clearCache() {
  paragraphSymbol.clear();
  numberNodeKey.clear();
}

export function $getInstanceNodeKeyByNumber(number: string) {
  const key = numberNodeKey.get(number);
  return key;
}

export function $getInstanceNodeByNumber(number: string) {
  const key = $getInstanceNodeKeyByNumber(number);
  if (key) {
    return $getNodeByKey(key);
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
  }
}

export async function nodeUpgrade<T extends ElementNode>(nodes?: T[] | null) {
  if (nodes) {
    const parent = nodes[0].getParent();
    for (let index = 0; index < nodes.length; index++) {
      const current = nodes[index];
      const pre = nodes[index - 1];
      if (pre) {
        pre.insertAfter(current);
      } else {
        parent?.insertAfter(current);
      }
    }
  }
}

export async function nodeDowngrade<T extends ElementNode>(nodes?: T[] | null) {
  if (nodes) {
    const previous = nodes[0].getPreviousSibling();
    if ($isElementNode(previous)) {
      previous.append(...nodes);
    }
  }
}
