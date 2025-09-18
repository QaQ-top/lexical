/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  $isHeadingNode,
  HeadingTagType,
  SerializedHeadingNode,
} from '@lexical/rich-text';
import {
  $applyNodeReplacement,
  $createTextNode,
  $getSelection,
  $isTextNode,
  BaseSelection,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  ElementFormatType,
  isHTMLElement,
  LexicalEditor,
  LexicalNode,
  setNodeIndentFromDOM,
  TextNode,
} from 'lexical';

import {$isInstanceNode} from '../base';
import {internalLinkNameUpdateMap, Placeholder} from '../const';
import {InstanceHeadingNode, isGoogleDocsTitle} from '../heading';
import {
  $createPlaceholderDecoratorNode,
  $isPlaceholderDecoratorNode,
} from '../placeholder';
import {getLatestValue, setDisable, setInstanceAttrValue} from '../utils';
import {$isInstanceParagraphNode, InstanceParagraphNode} from '.';

export class InstanceTitleNode extends InstanceHeadingNode {
  __indent = 3;
  static getType(): string {
    return 'Title';
  }

  static clone(node: InstanceTitleNode): InstanceTitleNode {
    return new InstanceTitleNode(node.__tag, node.__key);
  }

  static importDOM(): DOMConversionMap | null {
    return {
      h1: (node: Node) => ({
        conversion: $convertInstanceTitleElement,
        priority: 0,
      }),
      h2: (node: Node) => ({
        conversion: $convertInstanceTitleElement,
        priority: 0,
      }),
      h3: (node: Node) => ({
        conversion: $convertInstanceTitleElement,
        priority: 0,
      }),
      h4: (node: Node) => ({
        conversion: $convertInstanceTitleElement,
        priority: 0,
      }),
      h5: (node: Node) => ({
        conversion: $convertInstanceTitleElement,
        priority: 0,
      }),
      h6: (node: Node) => ({
        conversion: $convertInstanceTitleElement,
        priority: 0,
      }),
      p: (node: Node) => {
        // domNode is a <p> since we matched it by nodeName
        const paragraph = node as HTMLParagraphElement;
        const firstChild = paragraph.firstChild;
        if (firstChild !== null && isGoogleDocsTitle(firstChild)) {
          return {
            conversion: () => ({node: null}),
            priority: 3,
          };
        }
        return null;
      },
      span: (node: Node) => {
        if (isGoogleDocsTitle(node)) {
          return {
            conversion: (domNode: Node) => {
              return {
                node: $createInstanceTitleNode('h1'),
              };
            },
            priority: 3,
          };
        }
        return null;
      },
    };
  }

  static importJSON(
    serializedNode: SerializedHeadingNode,
  ): InstanceHeadingNode {
    return $createInstanceTitleNode(serializedNode.tag).updateFromJSON(
      serializedNode,
    );
  }

  createDOM(config: EditorConfig): HTMLElement {
    const element = super.createDOM(config);
    setDisable(this, element);
    return element;
  }

  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const {element} = super.exportDOM(editor);

    if (isHTMLElement(element)) {
      if (this.isEmpty()) {
        element.append(document.createElement('br'));
      }

      const formatType = this.getFormatType();
      element.style.textAlign = formatType;

      const direction = this.getDirection();
      if (direction) {
        element.dir = direction;
      }
    }

    return {
      element,
    };
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const instanceNode = this.getInstanceNode();
    if (instanceNode && instanceNode.__instance.value) {
      const text = this.getTextContent().trim();
      setInstanceAttrValue(instanceNode.__instance.value, 'insDesc', text);
      internalLinkNameUpdateMap
        .get(instanceNode.__instance.value.number!)
        ?.values()
        .forEach((update) => update());
    }
    return super.updateDOM(prevNode, dom, config);
  }

  exportJSON(): SerializedHeadingNode {
    return {
      ...super.exportJSON(),
      tag: this.getTag(),
    };
  }
  remove(preserveEmptyParent?: boolean): void {
    const parent = this.getParent();
    if ($isInstanceParagraphNode(parent)) {
      parent.remove();
      return;
    }
    super.remove(preserveEmptyParent);
  }

  setIndent(indentLevel: number): this {
    return this;
  }

  isSelected(selection?: null | BaseSelection): boolean {
    return false;
  }

  collapseAtStart(): true {
    return true;
  }

  getInstanceNode() {
    const parent = this.getParent();
    if ($isInstanceParagraphNode(parent) && parent.isTitle) {
      const grandfather = parent.getParent();
      if ($isInstanceNode(grandfather)) {
        return grandfather;
      }
    }
  }

  getFirstTextNode() {
    const textNode = this.getChildren().find((node) => $isTextNode(node));
    if (!textNode) {
      const textNode = $createTextNode();
      this.append(textNode);
      return textNode;
    }
    return textNode;
  }
}

export function $convertInstanceTitleElement(
  element: HTMLElement,
): DOMConversionOutput {
  const nodeName = element.nodeName.toLowerCase();
  let node = null;
  if (
    nodeName === 'h1' ||
    nodeName === 'h2' ||
    nodeName === 'h3' ||
    nodeName === 'h4' ||
    nodeName === 'h5' ||
    nodeName === 'h6'
  ) {
    node = $createInstanceTitleNode(nodeName);
    if (element.style !== null) {
      setNodeIndentFromDOM(element, node);
      node.setFormat(element.style.textAlign as ElementFormatType);
    }
  }
  return {node};
}

/** 创建 Heading Title */
export function $createInstanceTitleNode(
  headingTag: HeadingTagType = 'h1',
): InstanceTitleNode {
  return $applyNodeReplacement(new InstanceTitleNode(headingTag));
}

/** 是否是 Heading Title */
export function $isInstanceTitleNode(
  node: LexicalNode | null | undefined,
): node is InstanceTitleNode {
  return node instanceof InstanceTitleNode;
}

/** 加入 Heading Title 以及 Placeholder 类 */
export function $convertToTitle(
  paragraph: InstanceParagraphNode,
  placeholder?: Placeholder,
) {
  const firstChild = paragraph.getFirstChild();
  if (!$isInstanceTitleNode(firstChild)) {
    const h1 = $createInstanceTitleNode('h1');
    const placeholderNode = $createPlaceholderDecoratorNode(placeholder?.title);
    h1.append(placeholderNode);
    const parent = paragraph.getParent();
    if ($isInstanceNode(parent)) {
      const instance = parent.__instance.value;
      if (instance) {
        h1.append(new TextNode(getLatestValue(instance, 'insDesc')));
      }
    }
    if (!firstChild) {
      paragraph.append(h1);
      // 添加节点后如果光标在此处，会导致光标丢失，需要重新放置光标
      const selection = $getSelection();
      const [start] = selection?.getStartEndPoints() || [];
      if (start && paragraph.getKey() === start.key) {
        paragraph.selectEnd();
      }
    } else if ($isHeadingNode(firstChild)) {
      firstChild.replace(h1);
    }
  }
}

/** 监听 Heading Title 更新 placeholder 状态 */
export function $registerInstanceHeadingNodeTransform(editor: LexicalEditor) {
  return editor.registerNodeTransform(InstanceTitleNode, (paragraph) => {
    // 当内容变化时更新装饰
    const firstChild = paragraph.getFirstChild();
    if ($isPlaceholderDecoratorNode(firstChild)) {
      const placeholder = firstChild.getWritable();
      if (paragraph.getTextContent() === '') {
        placeholder.setShow(true);
      } else {
        placeholder.setShow(false);
      }
    }
  });
}
