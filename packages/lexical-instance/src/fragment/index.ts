/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {ElementNode, LexicalNode, SerializedElementNode, Spread} from 'lexical';

export type SerializedCodeNode = Spread<
  {
    fragment: boolean;
  },
  SerializedElementNode
>;

export class Fragment extends ElementNode {
  static getType(): string {
    return 'Fragment';
  }

  static clone(node: Fragment): Fragment {
    return new Fragment(node.__key);
  }

  static importJSON(serializedNode: SerializedCodeNode): Fragment {
    return $createFragmentNode().updateFromJSON(serializedNode);
  }
  pop<T extends LexicalNode>() {
    const children = super.getChildren<T>();
    super.clear();
    return children;
  }
}

export function $createFragmentNode() {
  return new Fragment();
}
