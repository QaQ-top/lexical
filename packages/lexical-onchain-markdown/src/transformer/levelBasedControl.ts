/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {ElementNode} from 'lexical';
import {
  $isInstanceHeadingNode,
  $isInstanceNode,
  Instance,
} from 'onchain-lexical-instance';

export default class LevelBasedControl {
  ancestor: Map<number, ElementNode> = new Map();
  stack: ElementNode[] = [];
  level1: Set<ElementNode> = new Set();
  instanceMap?: Map<string, Instance>;
  get children() {
    return this.level1;
  }

  constructor(instanceMap?: Map<string, Instance>) {
    this.instanceMap = instanceMap;
  }

  private collectLevel1(level: number, node: ElementNode) {
    if (level === 1) {
      this.level1.add(node);
    }
    return node;
  }

  get current(): ElementNode | undefined {
    return this.stack[this.stack.length - 1];
  }

  reductionNodeHierarchy({
    level,
    isInstanceEnd,
    nodes,
  }: {
    isInstanceEnd: boolean;
    level: number;
    nodes: ElementNode[];
  }) {
    if (isInstanceEnd) {
      const node = this.unstack();
      if ($isInstanceNode(node)) {
        node.optimizationParagraph();
      }
    } else {
      this.insert(level, nodes);
    }
  }

  private insert(level: number, nodes: ElementNode[]) {
    if (level !== 0) {
      const node = this.collectLevel1(level, nodes[0]);
      this.stack.push(node);
      this.ancestor.set(level, node);
      const parent = this.ancestor.get(level - 1);
      if (parent) {
        parent.append(node);
      }
    } else {
      const current = this.current;
      if (current) {
        this.initTitle(current, nodes);
        current.append(...nodes);
      } else {
        nodes.forEach((node) => this.level1.add(node));
      }
    }
  }

  private unstack() {
    return this.stack.pop();
  }

  private initTitle(node: ElementNode, nodes: ElementNode[]) {
    if ($isInstanceNode(node)) {
      const titleNode = nodes[0];
      const title = titleNode.getTextContent().trim();
      const [number, insDesc] = title.split(' / ');
      let instance: Instance | undefined;
      if (this.instanceMap && this.instanceMap.has(number)) {
        instance = this.instanceMap.get(number)!;
      } else if (number) {
        instance = {
          insDesc,
          number,
        } as Instance;
      }
      if ($isInstanceHeadingNode(titleNode)) {
        nodes.shift();
      }
      if (instance) {
        node.setInstance(instance);
      }
    }
  }

  getLastNode() {
    const current = this.current;
    if (current) {
      const children = current.getChildren<ElementNode>();
      return children[children.length - 1];
    }
  }
}
