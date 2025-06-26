/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/** 按顺序深度优先 */
export function dfs<T = unknown>(data: T[], getNewStack: (node: T) => T[]) {
  const stack = [...data];
  const result = [];
  while (stack.length > 0) {
    const node = stack.shift()!;
    result.push(node);
    const children = getNewStack(node);
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      stack.unshift(child);
    }
  }
  return result;
}
