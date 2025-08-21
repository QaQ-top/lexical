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

export const OPEN_CREATE_WINDOW: LexicalCommand<{
  isAddChildLevel: boolean;
  number: string;
  insNodeKey?: string;
}> = createCommand('OPEN_CREATE_WINDOW');

export const ADD_NEW_INSTANCE_NODE: LexicalCommand<{
  instances: Instance[];
  isAddChildLevel: boolean;
  insNodeKey?: string;
}> = createCommand('ADD_NEW_INSTANCE_NODE');
