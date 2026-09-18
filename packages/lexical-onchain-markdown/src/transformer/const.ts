/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

export const INS_SYMBOL = '\u200B';
export const INSTANCE_START_REGEX = /^(<!--)(\u200B+)(-->)\s*/;
export const INSTANCE_END_REGEX = /^(<!---->)\s*/;
export const HEADING_REGEX = /^(#{1,6})\s/;
