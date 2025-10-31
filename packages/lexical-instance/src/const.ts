/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {createCommand, LexicalCommand} from 'lexical';

import {Instance} from './types';

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
export enum InstanceParagraphType {
  Title = 2,
  Description,
  Text,
}

export interface Placeholder {
  title?: string;
  description?: string;
  text?: string;
}

export interface PluginProps {
  placeholder?: Placeholder;
}

class ParagraphSymbolMap<Value extends number> extends Map<string, Value> {
  //@ts-ignore
  get(node: InstanceParagraphNode) {
    return super.get(node.__key);
  }
  //@ts-ignore
  set(node: InstanceParagraphNode, value: Value) {
    return super.set(node.__key, value);
  }
  //@ts-ignore
  delete(node: InstanceParagraphNode): boolean {
    return super.delete(node.__key);
  }
}

export const paragraphSymbol = new ParagraphSymbolMap();

export const instanceNodeMap = new WeakMap();

class NumberNodeKey extends Map<string, string> {
  set(number: string, nodeKey: string) {
    super.set(number, nodeKey);
    super.set(nodeKey, number);
    return this;
  }
}

export const numberNodeKey = new NumberNodeKey();

export const fixedAddress = new Map<string, {value: Instance}>();

/** 用来存储内联链接，更新文本函数，用来实现链接目标标题变化时，引用处可以实时更新 */
export const internalLinkNameUpdateMap = new Map<
  string,
  Map<string, () => void>
>();

/** 打开创建实例节点 */
export const OPEN_CREATE_WINDOW: LexicalCommand<{
  isAddChildLevel: boolean;
  number: string;
  insNodeKey?: string;
}> = createCommand('OPEN_CREATE_WINDOW');

/** 添加新的实例节点 */
export const ADD_NEW_INSTANCE_NODE: LexicalCommand<{
  instances: Instance[];
  isAddChildLevel: boolean;
  insNodeKey?: string;
}> = createCommand('ADD_NEW_INSTANCE_NODE');

/** 删除实例节点 */
export const DELETE_INSTANCE_NODE = 'DELETE_INSTANCE_NODE';

/** 插入参数 */
export const INSERT_PARAMETERS: LexicalCommand<undefined> =
  createCommand('INSERT_PARAMETERS');

/** 富文本 DecoratorNode 节点组件更新事件*/
export const COMPONENT_UPDATE: LexicalCommand<{
  insNodeKey?: string;
  name: 'bar';
}> = createCommand('COMPONENT_UPDATE');

/** 标题更新事件 */
export const INSTANCE_TITLE_UPDATE: LexicalCommand<{
  number: string;
  isInput?: boolean;
  title?: string;
}> = createCommand('INSTANCE_TITLE_UPDATE');

/** 获取禁止编辑dom节点选择器 */
export const DisableSelector = `[contenteditable='false']:not([ignorecontenteditable])`;
