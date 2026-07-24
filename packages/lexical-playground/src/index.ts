/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {MarkNode} from '@lexical/mark';
import type {LexicalComposerContextType} from '@lexical/react/LexicalComposerContext';
import type {
  LexicalEditor,
  LexicalNode,
  RangeSelection,
  SerializedLexicalNode,
} from 'lexical';
import type {Instance} from 'onchain-lexical-instance';

import {
  _instanceToSerializeNode,
  _textToSerializedNode,
} from 'onchain-lexical-markdown';

import PlaygroundNodes from './nodes/PlaygroundNodes';

/** Type Start -------------------------------------------------------------------------- */
// 类型一致性核对(以 lib/index.d.ts 内联后版本为基准):
//   OPEN_COMMENT            ✅ 一致,删除(从 @lexical/react 透出)
//   importSerializedNode     ✅ 一致,删除(从 @lexical/file 透出)
//   exportJSON              ✅ 等价(都是 Omit<ExportConfig,'fileName'>),删除
//   exportNodeToJSON        ✅ 一致,删除(从 @lexical/file 透出)
//   $appendNodesToHTML      ✅ 一致,删除(从 @lexical/html 透出)
//   $advanceParseSerializedNode  ⚠️ 不一致:官方版本是 <T = LexicalNode>(...) => T
//                                       这里是 (s) => LexicalNode(无泛型)。保留。
//   $wrapSelectionInMarkNode     ⚠️ 不一致:官方返回 MarkNode | void | undefined
//                                       这里是 MarkNode | undefined。保留(去掉 void 兼容)。
//   useLexicalComposerContext    ⚠️ 不一致:官方别名 LexicalComposerContextWithEditor<LE,LC>
//                                       这里是直接写元组。保留。
export declare const $advanceParseSerializedNode: (
  serializedNode: SerializedLexicalNode,
) => LexicalNode;
export declare const $wrapSelectionInMarkNode: (
  selection: RangeSelection,
  isBackward: boolean,
  id: string,
  createNode?: (ids: Array<string>) => MarkNode,
) => MarkNode | undefined;
export declare const useLexicalComposerContext: <
  LE = LexicalEditor,
  LC = LexicalComposerContextType,
>() => [LexicalEditor | LE, LexicalComposerContextType | LC];
/** -------------------------------------------------------------------------- */
export {buildImportMap, default as RichTextEditor} from './App';
export * from './commenting';
export {default as Editor} from './Editor';
export {default as RichTextNodes} from './nodes/PlaygroundNodes';
export {INSERT_INLINE_COMMAND} from './plugins/CommentPlugin/const';
export {TableContext} from './plugins/TablePlugin';
export {default as ToolbarPlugin} from './plugins/ToolbarPlugin';
export {default as TypingPerfPlugin} from './plugins/TypingPerfPlugin';
export {default as RichTextEditorTheme} from './themes/PlaygroundEditorTheme';
export {Enhanced} from './utils/enhanced';
export * from '@lexical/file';
export * from '@lexical/history';
export * from '@lexical/html';
export * from '@lexical/mark';
export * from '@lexical/react/LexicalAutoFocusPlugin';
export * from '@lexical/react/LexicalBlockStandaloneTildeHashPlugin';
export * from '@lexical/react/LexicalClearEditorPlugin';
export {LexicalComposer} from '@lexical/react/LexicalComposer';
export * from '@lexical/react/LexicalComposerContext';
export * from '@lexical/react/LexicalEditorRefPlugin';
export * from '@lexical/react/LexicalErrorBoundary';
export * from '@lexical/react/LexicalHistoryPlugin';
export * from '@lexical/react/LexicalOnChangePlugin';
export * from '@lexical/react/LexicalPlainTextPlugin';
export * from '@lexical/selection';
export * from '@lexical/table';
export * from '@lexical/text';
export {mergeRegister, registerNestedElementResolver} from '@lexical/utils';
export * from 'lexical';
export * from 'onchain-lexical-context';
export * from 'onchain-lexical-context/collaboration';
export * from 'onchain-lexical-context/flashMessage';
export * from 'onchain-lexical-context/instanceConfig';
export * from 'onchain-lexical-context/settings';
export * from 'onchain-lexical-context/sharedHistory';
export * from 'onchain-lexical-context/toolBar';
export * from 'onchain-lexical-instance';
export * from 'onchain-lexical-markdown';
export {default as ContentEditable} from 'onchain-lexical-ui/ContentEditable';
export {default as EditorShellStyles} from 'onchain-lexical-ui/EditorShellStyles';

export function instanceToSerializeNode(params: {
  instance: Instance;
  title: string;
  children?: Record<string, unknown>[];
  childrenText?: string;
}) {
  return _instanceToSerializeNode({
    ...params,
    nodes: [...PlaygroundNodes],
  });
}

export function textToSerializedNode(text: string) {
  return _textToSerializedNode([...PlaygroundNodes], text);
}
