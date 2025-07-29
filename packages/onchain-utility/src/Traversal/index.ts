/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/** 按顺序深度优先 */
export function dfs<T = unknown>(
  data: T[],
  getNewStack: (node: T, parent?: T) => T[],
) {
  const stack = [...data];
  const parentMap = new Map<T, T>();
  const result = [];
  while (stack.length > 0) {
    const node = stack.shift()!;
    result.push(node);
    const parent = parentMap.get(node);
    const children = getNewStack(node, parent);
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      parentMap.set(child, node);
      stack.unshift(child);
    }
  }
  return result;
}

/** 广度优先 */
export function bfs<T = unknown>(
  data: T[],
  getNewStack: (node: T, parent?: T) => T[],
) {
  const queue = [...data];
  const parentMap = new Map<T, T>();
  const result = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    const parent = parentMap.get(node);
    const children = getNewStack(node, parent);
    if (children) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        parentMap.set(child, node);
        queue.push(child);
      }
    }
  }
  return result;
}

/** 异步版本按顺序深度优先  */
export async function asyncDfs<T = unknown>(
  data: T[],
  getNewStack: (node: T, parent?: T) => Promise<T[]> | T[],
) {
  const stack = [...data];
  const parentMap = new Map<T, T>();
  const result = [];
  while (stack.length > 0) {
    const node = stack.shift()!;
    result.push(node);
    const parent = parentMap.get(node);
    const children = await getNewStack(node, parent);
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      parentMap.set(child, node);
      stack.unshift(child);
    }
  }
  return result;
}
