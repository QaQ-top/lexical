/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {SerializedDocument} from '@lexical/file';
import type {MarkNode} from '@lexical/mark';
import type {
  InternalSerializedNode,
  LexicalCommand,
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
export declare const OPEN_COMMENT: LexicalCommand<boolean>;

export declare const importSerializedNode: (
  editor: LexicalEditor,
  serializedRoot: SerializedLexicalNode,
) => void;
export declare const $advanceParseSerializedNode: (
  serializedNode: SerializedLexicalNode,
) => LexicalNode;

export declare const exportJSON: (
  editor: LexicalEditor,
  config?: Readonly<{
    source?: string;
    formatJSON?: (
      root: InternalSerializedNode,
    ) => Promise<InternalSerializedNode>;
  }>,
) => Promise<SerializedDocument>;
export declare const exportNodeToJSON: <
  SerializedNode extends SerializedLexicalNode,
>(
  node: LexicalNode,
) => SerializedNode;
export declare const $wrapSelectionInMarkNode: (
  selection: RangeSelection,
  isBackward: boolean,
  id: string,
  createNode?: (ids: Array<string>) => MarkNode,
) => MarkNode | undefined;
/** -------------------------------------------------------------------------- */
export {buildImportMap, default as RichTextEditor} from './App';
export * from './commenting';
export {default as Editor} from './Editor';
export {default as RichTextNodes} from './nodes/PlaygroundNodes';
export {INSERT_INLINE_COMMAND} from './plugins/CommentPlugin/const';
export {TableContext} from './plugins/TablePlugin';
export {default as ToolbarPlugin} from './plugins/ToolbarPlugin';
export {default as TypingPerfPlugin} from './plugins/TypingPerfPlugin';
export {default as Settings} from './Settings';
export {default as RichTextEditorTheme} from './themes/PlaygroundEditorTheme';
export {Enhanced} from './utils/enhanced';
export * from '@lexical/file';
export * from '@lexical/history';
export * from '@lexical/mark';
export * from '@lexical/react/LexicalAutoFocusPlugin';
export * from '@lexical/react/LexicalClearEditorPlugin';
export {LexicalComposer} from '@lexical/react/LexicalComposer';
export {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
export * from '@lexical/react/LexicalEditorRefPlugin';
export * from '@lexical/react/LexicalErrorBoundary';
export * from '@lexical/react/LexicalHistoryPlugin';
export * from '@lexical/react/LexicalOnChangePlugin';
export * from '@lexical/react/LexicalPlainTextPlugin';
export * from '@lexical/selection';
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
