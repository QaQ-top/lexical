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
