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
} from '../MarkdownTransformers';

import {
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CHECK_LIST,
  CODE,
  // HEADING,
  HIGHLIGHT,
  INLINE_CODE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
} from '../MarkdownTransformers';
import {BLOCK_EQUATION, EQUATION} from './equation';
import {HR} from './hr';
import {InstanceHeadingTransformer, InstanceTransformer} from './instance';
import {TABLE} from './table';

export const ELEMENT_TRANSFORMERS: Array<ElementTransformer> = [
  // HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
];

export const MULTILINE_ELEMENT_TRANSFORMERS: Array<MultilineElementTransformer> =
  [CODE];

// Order of text format transformers matters:
//
// - code should go first as it prevents any transformations inside
// - then longer tags match (e.g. ** or __ should go before * or _)
export const TEXT_FORMAT_TRANSFORMERS: Array<TextFormatTransformer> = [
  INLINE_CODE,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  HIGHLIGHT,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
];

export const TEXT_MATCH_TRANSFORMERS: Array<TextMatchTransformer> = [LINK];

export const TRANSFORMERS: Array<Transformer> = [
  CHECK_LIST,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
];

class TFR {
  private _value = new Set([...TRANSFORMERS]);

  get value() {
    return Array.from(this._value);
  }

  register(tfr: Transformer) {
    this._value.add(tfr);
  }
}
const TransFormerGather = new TFR();

TransFormerGather.register(InstanceTransformer);
TransFormerGather.register(InstanceHeadingTransformer);
TransFormerGather.register(HR);
TransFormerGather.register(TABLE);
TransFormerGather.register(EQUATION);
TransFormerGather.register(BLOCK_EQUATION);

function getInstanceTransformers() {
  return TransFormerGather.value;
}

export {getInstanceTransformers, TransFormerGather};
