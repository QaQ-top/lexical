/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {MarkdownShortcutPlugin} from '@lexical/react/LexicalMarkdownShortcutPlugin';
import {getInstanceTransformers} from 'onchain-lexical-markdown';
import {type JSX} from 'react';

export default function MarkdownPlugin(): JSX.Element {
  return <MarkdownShortcutPlugin transformers={getInstanceTransformers()} />;
}
