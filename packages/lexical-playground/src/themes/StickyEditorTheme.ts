/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {EditorThemeClasses} from 'lexical';

import baseTheme from './PlaygroundEditorTheme';
import Styles from './StickyEditorTheme.module.less';

const theme: EditorThemeClasses = {
  ...baseTheme,
  paragraph: Styles.StickyEditorTheme__paragraph,
};

export default theme;
