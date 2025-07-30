/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export function levelTransformTree<T extends Record<string, any>>({
  data,
  splitSymbol = '.',
  getLevel,
}: {
  data: T[];
  splitSymbol?: string;
  getLevel: (item: T) => string;
}) {
  // data = [...data];
  // data.sort((a, b) => {
  //   return (
  //     getLevel(a).split(splitSymbol).length -
  //     getLevel(b).split(splitSymbol).length
  //   );
  // });

  // 创建根节点和映射表
  const root: {children: T[]} = {children: []};
  const map = new Map();

  // 添加节点到映射表并构建树结构
  data.forEach((item) => {
    // 创建新节点
    const node: T = {
      ...item,
      children: [],
    };

    const level = getLevel(item);
    // 将节点添加到映射表
    map.set(level, node);

    // 查找父节点
    const parentLevel = level.includes(splitSymbol)
      ? level.split(splitSymbol).slice(0, -1).join(splitSymbol)
      : null;

    const parent = parentLevel ? map.get(parentLevel) : root;

    // 将节点添加到父级
    if (parent) {
      parent.children.push(node);
    } else {
      // 如果找不到父节点，则作为根节点的子节点
      root.children.push(node);
    }
  });

  return root.children;
}
