/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_NORMAL,
  CONTROLLED_TEXT_INSERTION_COMMAND,
} from 'lexical';
import {useEffect} from 'react';

/**
 * 限制用户输入独立的 `~#~`
 *
 * 规则：
 *  - 单独出现的 `~#~`（没有任何前缀字符，处于行首 / TextNode 开头时）不允许输入
 *  - `~~#~`、`￥~#~` 这种已经有前缀字符的情况允许输入
 *
 * 实现思路：
 *  - 监听 `CONTROLLED_TEXT_INSERTION_COMMAND`，
 *  - 仅当用户要插入的字符是 `~`，且当前光标紧邻的两个字符是 `~#`，
 *    并且 `~#` 之前没有任何其他字符时，阻止默认插入行为。
 *  - 真正的文本内容收敛由 `editor.registerNodeTransform(TextNode, ...)` 兜底：
 *    若 transform 后整段文本变成 `~#~`，会同步 `setTextContent('~#')`。
 *    本插件专注于"拦截下一次插入"，不再负责 selection 修正。
 */
export function BlockStandaloneTildeHashPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      CONTROLLED_TEXT_INSERTION_COMMAND,
      (payload) => {
        // 只关心单字符插入；多字符粘贴、IME 合成等走别的分支
        if (typeof payload !== 'string' || payload.length !== 1 || payload !== '~') {
          return false;
        }

        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }

        const anchor = selection.anchor;
        if (anchor.type !== 'text') {
          return false;
        }
        const anchorNode = anchor.getNode();
        if (!$isTextNode(anchorNode)) {
          return false;
        }

        const offset = anchor.offset;
        // 光标前面要至少有 `~#` 两个字符
        if (offset < 2) {
          return false;
        }

        const text = anchorNode.getTextContent();
        const prevTwo = text.slice(offset - 2, offset);
        if (prevTwo !== '~#') {
          return false;
        }

        // `~#` 之前没有任何前缀字符 ⇒ 这是独立的 `~#~`，阻止默认插入。
        // 剩下的工作交给 `setTextContent` 中的 selection 兜底 + 上层 transform。
        return offset - 2 === 0;
      },
      COMMAND_PRIORITY_NORMAL,
    );
  }, [editor]);

  return null;
}
