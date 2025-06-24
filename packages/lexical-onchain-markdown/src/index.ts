/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {
  ElementTransformer,
  MultilineElementTransformer,
  TextFormatTransformer,
  TextMatchTransformer,
  Transformer,
} from './MarkdownTransformers';

import {$convertFromMarkdownString} from './fromMarkdownString';
// import {createMarkdownExport} from './MarkdownExport';
import {registerMarkdownShortcuts} from './MarkdownShortcuts';
import {
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CHECK_LIST,
  CODE,
  HEADING,
  HIGHLIGHT,
  INLINE_CODE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
} from './MarkdownTransformers';
import {$convertToMarkdownString} from './toMarkdownString';
import {
  ELEMENT_TRANSFORMERS,
  MULTILINE_ELEMENT_TRANSFORMERS,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  TransFormerGather,
  TRANSFORMERS,
} from './transformer';

export {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CHECK_LIST,
  CODE,
  ELEMENT_TRANSFORMERS,
  type ElementTransformer,
  HEADING,
  HIGHLIGHT,
  INLINE_CODE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  MULTILINE_ELEMENT_TRANSFORMERS,
  type MultilineElementTransformer,
  ORDERED_LIST,
  QUOTE,
  registerMarkdownShortcuts,
  STRIKETHROUGH,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type TextFormatTransformer,
  type TextMatchTransformer,
  type Transformer,
  TransFormerGather,
  TRANSFORMERS,
  UNORDERED_LIST,
};
