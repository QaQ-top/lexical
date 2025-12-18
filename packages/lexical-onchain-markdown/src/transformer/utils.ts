/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {ElementNode, TextNode} from 'lexical';

export function getInstanceLevel(match?: string[] | null) {
  if (match && match.length) {
    const level = match[2].length;
    return {
      isInstance: true,
      level,
    };
  }
  return {
    isInstance: false,
    level: 0,
  };
}

export function getHtmlTagAttrValue<T extends string>(
  tagStart: string,
  attrName: string,
): T | undefined {
  const match = tagStart.match(new RegExp(`${attrName}=("|')(.*?)\\1`)) || [];
  return match[2] as T;
}

export interface TagStructure {
  children: TagStructure[];
  content: string;
  tag: string;
  dom: Element | null;
  node?: ElementNode | TextNode;
}
// 简化的解析器
export function parseHtmlToCustomStructure(htmlString: string): TagStructure[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  function processNode(node: Element): TagStructure | null {
    // 处理文本节点
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      return text
        ? {children: [], content: text, dom: node, tag: 'text'}
        : null;
    }

    // 处理元素节点
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      const children = [];

      // 处理子节点
      for (const child of node.childNodes) {
        const childResult = processNode(child as Element);
        if (childResult) {
          children.push(childResult);
        }
      }

      // 获取元素内容（不包含子元素的纯文本内容）
      const textContent = Array.from(node.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => (n as Element).textContent)
        .filter((text) => text.length > 0)
        .join(' ');

      return {
        children: children,
        content: textContent || node.textContent || '',
        dom: node,
        tag: tagName,
      };
    }

    return null;
  }

  // 处理文档中的主要元素
  const result = [];
  const bodyChildren = Array.from(doc.body.children);

  for (const element of bodyChildren) {
    const processed = processNode(element);
    if (processed) {
      result.push(processed);
    }
  }
  return result;
}

/** html 标签分块单行排列 */
export function htmlTagSingleLine(htmlString: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  return Array.from(doc.body.children)
    .map((element) => {
      return element.outerHTML.replace(/(>)\s+(<)/g, '$1$2');
    })
    .join('\n');
}
