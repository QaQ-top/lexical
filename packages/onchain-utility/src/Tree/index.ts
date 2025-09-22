/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

type Item = Record<string, any>;

interface Params<T> {
  data: T[];
  signKey?: string;
  childrenKey?: string;
}

interface Relation<T> {
  /** 父节点 */
  parent?: T;
  /** 自身 */
  self: T;
  /** 前面的兄弟节点 */
  beforeSibling: T[];
  /** 后面的兄弟节点 */
  afterSibling: T[];
  /** 所处当前层级的索引 */
  index: number;
  /** 全部祖先节点集合 */
  stack: T[];
}

export function levelTransformTree<T extends Item>({
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

export function deleteTreeNodes<T extends Item>({
  data,
  selectedKeys,
  signKey = 'id',
  childrenKey = 'children',
  onDelete,
}: Params<T> & {
  selectedKeys: string[];
  onDelete?: (item: T) => void;
}) {
  const flatData = arrayAttributeFlat({childrenKey, data});
  const selectedItems = new Set(
    flatData.filter((item) => selectedKeys.includes(item[signKey])),
  );
  Array.from(selectedItems.values()).forEach((item) =>
    loopDescendants(
      {
        childrenKey,
        items: [item],
      },
      (item) => {
        selectedItems.add(item);
      },
    ),
  );
  const list = Array.from(selectedItems.values());
  if (onDelete) {
    list.forEach((item) => {
      onDelete(item);
    });
  }
  return list;
}

function loopDescendants<T extends Item>(
  {
    items,
    childrenKey = 'children',
  }: {
    items: T[];
    childrenKey?: string;
  },
  fn?: (item: T) => void,
) {
  items.forEach((item) => {
    const children = item[childrenKey];
    fn?.(item);
    if (children) {
      loopDescendants({childrenKey, items: children}, fn);
    }
  });
}

/** 数组对象扁平化 */
export function arrayAttributeFlat<T extends Item>(
  {data, childrenKey = 'children'}: {data: T[]; childrenKey?: string},
  fn?: (item: T, index: number, parent?: T) => void,
): T[] {
  const stack = [...data];
  const array = [];
  const parentMap = new Map<T, T>();
  let index = 0;
  while (stack.length) {
    const item = stack.shift()!;
    const children = item ? (item as any)[childrenKey] : [];
    fn?.(item, index, parentMap.get(item));
    array.push(item);
    index++;
    if (children?.length) {
      // 有使用的地方依赖这个 减法 生产的顺序谨慎修改
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        parentMap.set(child, item);
        stack.unshift(child);
      }
    }
  }
  return array;
}

/** 获取当前节点在树中的结构 */
export function getTreeRelation<T = Item>({
  data,
  lookup,
  childrenKey = 'children',
}: Omit<Params<T>, 'signKey'> & {
  lookup: (item: T, index: number) => boolean;
}) {
  const stack = new Set<T>();
  let res: Relation<T> = {
    afterSibling: [],
    beforeSibling: [],
    index: undefined as any,
    parent: undefined,
    self: undefined as any,
    stack: Array.from(stack),
  };

  const indexMap = new Map<any, number>();
  const parentMap = new Map<any, any>();
  const clearStackMap = new Map<any, () => void>();

  const container = [...data];
  while (container.length) {
    const item: any = container.shift()!;

    const index = indexMap.get(item) ?? data.findIndex((i) => i === item);
    const parent = parentMap.get(item);

    if (parent) {
      stack.add(parent);
    } else {
      stack.clear();
    }

    const selfArray = parent?.[childrenKey as keyof T] as T[];
    const isExist = lookup(item, index);
    const children = item[childrenKey as keyof T] as T[];

    if (isExist) {
      // console.log(stack, 'stack');
      res = {
        afterSibling: (selfArray || data).slice(index + 1),
        beforeSibling: (selfArray || data).slice(0, index),
        index,
        parent,
        self: item,
        stack: Array.from(stack),
      };
      break;
    } else if (children?.length) {
      for (let i = children.length - 1; i >= 0; i--) {
        const child: any = children[i];
        container.unshift(children[i]);
        indexMap.set(child, i);
        parentMap.set(child, item);
        // 遇到最后一个子元素时候 创建清除栈的方法
        if (i === children.length - 1) {
          clearStackMap.set(child, () => {
            // 保证深层级能正确的退出栈
            clearStackMap.get(item)?.();
            stack.delete(item);
          });
        }
      }
    } else {
      // 执行清除栈的方法
      clearStackMap.get(item)?.();
    }
  }
  return res;
}

export function getSiblings<T extends Item>({
  data,
  key,
  signKey = 'id',
  childrenKey = 'children',
}: Params<T> & {
  key: string;
}) {
  const {parent} = getTreeRelation({
    childrenKey,
    data,
    lookup(item, index) {
      return item[signKey] === key;
    },
  });
  const keys: string[] = parent
    ? (parent[childrenKey] as T[]).map((item) => item[signKey])
    : [];
  return keys;
}

/**
 * @description 合并相邻的选中数据
 * @date 2023-02-15 16:11:16
 * @export
 * @param {string[]} selectKeys
 * @returns {*}
 */
export function mergeAdjacent<T extends Item>({
  data,
  signKey = 'id',
  selectKeys,
  childrenKey = 'children',
}: Params<T> & {
  selectKeys: string[];
}) {
  const map = new Map<string, string[]>();
  const mapMerge = new Map<string, string[][]>();

  // 同层级的 siblings 是相同
  // 通过 siblings 生成 id
  // 这样就可以保证同层级的某一个id 找到同层级的集合 vacantRoom
  // 再通过在 siblings 中的索引，填入集合 vacantRoom
  selectKeys.forEach((key) => {
    const keys: string[] = getSiblings({childrenKey, data, key, signKey});
    const id = keys.toString();
    if (!map.has(id)) {
      map.set(id, [...Array(keys.length)]);
    }
    const vacantRoom = map.get(id)!;
    const index = keys.indexOf(key);
    if (index !== -1) {
      vacantRoom[index] = key;
    }
  });

  /**
   * 方法用来生成合并相邻选中的 id
   * ```text
   * 示例
   *  vacantRoom -> [null, 2, 3, null, null, 6, null, 8, 9]
   *  merge      -> [[], [2, 3], [], [], [6], [], [8, 9]]
   * ```
   */
  const mergeFn = (vacantRoom: string[]) => {
    const merge: (typeof vacantRoom)[] = [[]];
    vacantRoom.forEach((task) => {
      if (task) {
        const block = merge[merge.length - 1];
        block.push(task);
      } else {
        merge.push([]);
      }
    });
    return merge.filter((i) => !!i.length);
  };

  map.forEach((value, key) => {
    mapMerge.set(key, mergeFn(value));
  });

  return Array.from(mapMerge.values());
}

/**
 * @description 生成跨层排序
 * @date 2023-02-16 09:43:30
 * @returns {*}
 */
export function generatedAcrossHierarchySort<T extends Item>({
  signKey = 'id',
}: {
  signKey?: string;
}) {
  const nodes = new Map<any, {index: number; len: number; id: string}[]>();
  /** 对相同层级的选中进行排序 */
  function crossLayerSort({
    oldParentId,
    leader,
    selectSize,
  }: {
    /** 旧的父级的id */
    oldParentId: string;
    /** 当前集合选中个数大小 */
    selectSize: number;
    /** 选中集合中的 领头人 */
    leader: Relation<T>;
  }) {
    // 处理同层级排序问题
    if (!nodes.has(oldParentId)) {
      nodes.set(oldParentId, []);
    }
    const list = nodes.get(oldParentId)!;
    list.push({
      id: leader.self[signKey],
      index: leader.index!,
      len: selectSize,
    });
    list.sort((a, b) => a.index - b.index);
    return list;
  }
  /** 获取插入位置的索引 */
  function getInsertIdx({
    oldParentIndex,
    list,
    leader,
  }: {
    /** 旧的父级的索引 */
    oldParentIndex: number;
    /** 排序后的 当前选中的全部集合 位置、大小信息 */
    list: ReturnType<typeof crossLayerSort>;
    /** 选中集合中的 领头人 */
    leader: Relation<T>;
  }) {
    // +1 表示跟随父节点
    let insertIndex = (oldParentIndex || 0) + 1;
    if (list.length >= 1) {
      const index = list.findIndex((i) => i.id === leader.self[signKey]);
      // 获取应该插入的位置
      insertIndex += list.slice(0, index).reduce((pre, i) => {
        return pre + i.len;
      }, 0);
    }
    return insertIndex;
  }
  return {
    crossLayerSort,
    getInsertIdx,
    nodes,
  };
}

function _simpleGetRel<T extends Item>({
  data,
  key,
  signKey = 'id',
  childrenKey = 'children',
}: Params<T> & {
  key: string;
}) {
  return getTreeRelation({
    childrenKey,
    data,
    lookup(item, index) {
      return item[signKey] === key;
    },
  });
}

type MoveParams<T> = Params<T> & {
  selectKeys: string[];
  onMoved?: (moves: T[]) => void;
  onError?: (params: {selected: T[]; isMoveUp?: boolean}) => boolean | void;
};

export function move<T extends Item>({
  data,
  signKey = 'id',
  isMoveUp,
  selectKeys,
  childrenKey = 'children',
  onMoved,
  onError,
}: MoveParams<T> & {
  isMoveUp?: boolean;
}) {
  const layers = mergeAdjacent({childrenKey, data, selectKeys, signKey});
  for (const comb of layers) {
    for (const keys of comb) {
      const relArr = keys.map((key) =>
        _simpleGetRel({childrenKey, data, key, signKey}),
      );
      const selected = relArr.map((rel) => rel.self);
      const len = relArr.length;
      const [start] = relArr;
      const end = relArr[len - 1];

      const changePosition = isMoveUp
        ? start.beforeSibling.pop()
        : end.afterSibling.shift();
      if (changePosition) {
        // 锚点的父级
        const anchorParent = isMoveUp ? start.parent : end.parent;
        // 删除选中
        anchorParent!.children!.splice(start.index!, len);
        // 锚点
        const anchorIndex = anchorParent?.children?.indexOf(changePosition);

        const arr = [[selected]!, changePosition];

        // 向下移动时 需要调换位置
        if (!isMoveUp) {
          arr.reverse();
        }
        anchorParent!.children!.splice(anchorIndex, 1, ...arr.flat(2));
        onMoved?.(selected);
      } else {
        if (onError?.({isMoveUp: Boolean(isMoveUp), selected}) === false) {
          return;
        }
      }
    }
  }
}

export function movUp<T extends Item>(_: MoveParams<T>) {
  move({
    ..._,
    isMoveUp: true,
  });
}
export function moveDown<T extends Item>(_: MoveParams<T>) {
  move({
    ..._,
    isMoveUp: false,
  });
}

export async function upgrade<T extends Item>({
  data,
  signKey = 'id',
  isFollow,
  onStopFollow,
  onFilterFollow,
  onUpgrade,
  selectKeys,
  childrenKey = 'children',
  onUpgraded,
  onError,
}: MoveParams<T> & {
  isFollow?: boolean;
  onStopFollow?: (item: T) => boolean;
  onFilterFollow?: (item: T[]) => T[];
  onUpgrade?: (params: {
    selected: T[];
    parent: T;
  }) => Promise<boolean> | boolean;
  onUpgraded?: (upgrades: T[]) => void;
}) {
  const layers = mergeAdjacent({childrenKey, data, selectKeys, signKey});
  const {crossLayerSort, getInsertIdx} = generatedAcrossHierarchySort({
    signKey,
  });
  for (const comb of layers) {
    for (const keys of comb) {
      const relArr = keys.map((key) =>
        _simpleGetRel({childrenKey, data, key, signKey}),
      );
      const selected = relArr.map((rel) => rel.self);
      const len = relArr.length;
      const [start] = relArr;
      const end = relArr[len - 1];
      const {parent} = start;
      if (parent && (!onUpgrade || (await onUpgrade({parent, selected})))) {
        const parentRel = _simpleGetRel({
          childrenKey,
          data,
          key: parent!.id,
          signKey,
        });
        const {parent: grandpa, index: parentIndex} = parentRel;
        // const originalOldPrtCdr = parent.children?.slice(0, Infinity) || [];
        let followChildren: T[];
        /** 无法跟随的节点 */
        const unableToFollow: T[] = [];
        // const getFutureOldPrtCdr = () =>
        //   originalOldPrtCdr.slice(0, startIdx).concat(unableToFollow);
        const anchor = end;
        // 选中的节点非里程碑时 节点跟随
        if (isFollow) {
          // 获取需要跟随 self 的节点所在的范围
          const startIndex = anchor.index! + 1;
          /** 跟随节点 */
          followChildren = parent.children!.slice(startIndex);
          /** 中断处的索引 */
          const breakOffIndex = followChildren.findIndex((i) => {
            const selected = selectKeys.includes(i.id);
            // 后续被选中的 || 不满足被跟随节点需要的节点类型
            return selected || onStopFollow?.(i);
          });
          /** 跟随数量 */
          const followCount =
            breakOffIndex >= 0 ? breakOffIndex : parent.children!.length;
          // 删除选中后的兄弟
          followChildren = parent.children!.splice(
            start.index! + len,
            followCount,
          );

          followChildren = onFilterFollow
            ? onFilterFollow(followChildren)
            : followChildren;
          // 删除选中节点
        } else {
          followChildren = [];
        }
        const self = anchor.self as Item;
        self.children = [...(self.children || []), ...followChildren];
        parent.children!.splice(start.index!, len, ...unableToFollow);

        const list = crossLayerSort({
          leader: start,
          oldParentId: parent.id,
          selectSize: len,
        });

        const insert = (data: T[], index: number) => {
          data.splice(index, 0, ...selected);
          onUpgraded?.(selected);
        };
        const insertIndex = getInsertIdx({
          leader: start,
          list,
          oldParentIndex: parentIndex!,
        });
        insert(grandpa!.children!, insertIndex);
      }
    }
  }
}

export async function downgrade<T extends Item>({
  data,
  signKey = 'id',
  onDowngrade,
  onDowngraded,
  selectKeys,
  childrenKey = 'children',
  onError,
}: MoveParams<T> & {
  onDowngrade?: (params: {
    selected: T[];
    beforeSibling: T[];
    parent: T | undefined;
  }) => Promise<boolean> | boolean;
  onDowngraded?: (downgrades: T[]) => void;
}) {
  const layers = mergeAdjacent({childrenKey, data, selectKeys, signKey});
  for (const comb of layers) {
    for (const keys of comb) {
      const relArr = keys.map((key) =>
        _simpleGetRel({childrenKey, data, key, signKey}),
      );
      const selected = relArr.map((rel) => rel.self);
      const len = relArr.length;
      const [start] = relArr;
      const {beforeSibling, parent} = start;

      if (beforeSibling.length === 0 || !parent) {
        break;
      }
      if (
        !onDowngrade ||
        (await onDowngrade({beforeSibling, parent, selected}))
      ) {
        const before = beforeSibling[beforeSibling.length - 1];

        // 降级操作
        const children = parent[childrenKey]!.splice(start.index, len);

        const newChildren = [...(before[childrenKey] || []), ...children];
        if (children.length) {
          (before as Item)[childrenKey] = [...newChildren];
          onDowngraded?.(children);
        }
      }
    }
  }
}

export function insert<T extends Item>({
  data,
  anchor,
  value,
  signKey = 'id',
  childrenKey = 'children',
  isAddChildLevel,
}: Params<T> & {
  anchor: string;
  value: T[];
  isAddChildLevel?: boolean;
}) {
  const {parent, self, index} = _simpleGetRel({
    childrenKey,
    data,
    key: anchor,
    signKey,
  });
  if (isAddChildLevel) {
    (self as any)[childrenKey] = [...value, ...(self[childrenKey] || [])];
  } else {
    if (parent) {
      parent[childrenKey]?.splice(index + 1, 0, ...value);
    }
  }
}
