/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {$isCodeNode} from '@lexical/code';
import {$isListNode} from '@lexical/list';
import {$isQuoteNode} from '@lexical/rich-text';
import {$findMatchingParent} from '@lexical/utils';
import {
  $getSelection,
  $isRootNode,
  type EditorThemeClasses,
  type LexicalNode,
  TextNode,
} from 'lexical';
import {$isRootOrShadowRoot} from 'lexical';
import normalizeClassNames from 'shared/normalizeClassNames';

import {InstanceHeadingNode} from './heading';
import {InstanceParagraphNode} from './paragraph';
import {$isInstanceTitleNode} from './paragraph/title';
import {Instance, InstanceBaseInfo} from './types';

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
