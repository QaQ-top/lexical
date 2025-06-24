/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

export function getInstanceLevel(match?: string[] | null) {
  if (match && match.length) {
    const level = match[2].length;
    return {
      isInstance: true,
      level,
    };
  }
  return {
    isInstance: false,
    level: 0,
  };
}
