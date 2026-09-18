/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {HistoryState} from '@lexical/history';
import {EditorUpdateOptions, LexicalEditor} from 'lexical';

/** LexicalEditor Enhanced */

export class Enhanced {
  static read<T>(editor: LexicalEditor, callbackFn: () => T): Promise<T> {
    return new Promise((resolve) => {
      editor.read(() => {
        resolve(callbackFn());
      });
    });
  }
  static update<T>(
    editor: LexicalEditor,
    updateFn: () => T,
    options?: EditorUpdateOptions,
  ): Promise<T> {
    return new Promise((resolve) => {
      let result: T;
      editor.update(
        () => {
          result = updateFn();
        },
        {
          ...options,
          onUpdate() {
            if (options) {
              options.onUpdate?.();
            }
            resolve(result);
          },
        },
      );
    });
  }

  static seamlessUpdate<T>(
    editor: LexicalEditor,
    updateFn: () => T,
    options: {historyState: HistoryState} & EditorUpdateOptions,
  ) {
    options.historyState.isEntry = false;
    return Enhanced.update(editor, updateFn, {
      ...options,
      onUpdate() {
        options.historyState.isEntry = true;
        options.onUpdate?.();
      },
    });
  }
}
