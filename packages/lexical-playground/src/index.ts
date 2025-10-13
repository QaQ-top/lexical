/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {SerializedDocument} from '@lexical/file';
import type {Instance} from 'onchain-lexical-instance';

import {
  InternalSerializedNode,
  LexicalEditor,
  LexicalNode,
  SerializedLexicalNode,
} from 'lexical';
import {_instanceToSerializeNode} from 'onchain-lexical-markdown';

import PlaygroundNodes from './nodes/PlaygroundNodes';

export {buildImportMap, default as RichTextEditor} from './App';
export {default as Editor} from './Editor';
export {default as RichTextNodes} from './nodes/PlaygroundNodes';
export {TableContext} from './plugins/TablePlugin';
export {default as ToolbarPlugin} from './plugins/ToolbarPlugin';
export {default as TypingPerfPlugin} from './plugins/TypingPerfPlugin';
export {default as Settings} from './Settings';
export {default as RichTextEditorTheme} from './themes/PlaygroundEditorTheme';
export * from '@lexical/file';
export * from '@lexical/history';
export {LexicalComposer} from '@lexical/react/LexicalComposer';
export {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
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
export {default as EditorShellStyles} from 'onchain-lexical-ui/EditorShellStyles';
export * from 'onchain-utility';
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
