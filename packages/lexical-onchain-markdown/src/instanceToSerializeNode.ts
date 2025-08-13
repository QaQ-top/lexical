/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  $getRoot,
  createEditor,
  CreateEditorArgs,
  exportNodeToJSON,
  SerializedLexicalNode,
} from 'lexical';
import {Instance, InstanceNode} from 'onchain-lexical-instance';

import {$convertFromMarkdownString} from './fromMarkdownString';
import {getInstanceTransformers} from './transformer';

export interface SerializedNode extends SerializedLexicalNode {
  children?: SerializedNode[];
}

const markdownToSerializedNode = async ({
  nodes,
  markdown,
}: {
  markdown: string;
  nodes: Required<CreateEditorArgs>['nodes'];
}) => {
  return new Promise<SerializedNode[]>((resolve) => {
    try {
      createEditor({
        namespace: 'temporary',
        nodes,
      }).update(() => {
        $convertFromMarkdownString(markdown, getInstanceTransformers());
        resolve(exportNodeToJSON<SerializedNode>($getRoot()).children || []);
      });
    } catch (e) {
      const _console = console;
      _console.error(e);
      resolve([]);
    }
  });
};

const getParagraph = () => {
  return {
    direction: null,
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    type: 'Paragraph',
    version: 1,
  };
};

export async function _instanceToSerializeNode({
  title,
  nodes,
  instance,
  children,
  childrenText,
}: {
  instance: Instance;
  nodes: Required<CreateEditorArgs>['nodes'];
  title: string;
  children?: any[];
  childrenText?: string;
}) {
  let markdownChildren: SerializedNode[] = [];
  if (childrenText) {
    markdownChildren = await markdownToSerializedNode({
      markdown: childrenText,
      nodes,
    });
  }
  children = children
    ? [...markdownChildren, ...children]
    : [...markdownChildren];

  const copyChildren = [...markdownChildren];
  const count = InstanceNode.DEFAULT_PARAGRAPHS - 1;
  for (let index = 0; index < count; index++) {
    const node = copyChildren.slice(index, 1)[0];
    if (!node /**  || node.type !== 'Paragraph' */) {
      children.splice(index, 0, getParagraph());
    }
  }

  return {
    children: [
      {type: 'Bar', version: 1},
      {serialNumber: '3', type: 'Number', version: 1},
      {
        children: [
          {
            children: [
              {
                show: false,
                text: '请输入标题...',
                type: 'Placeholder',
                version: 1,
              },
              {
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                text: title,
                type: 'text',
                version: 1,
              },
            ],
            direction: null,
            format: '',
            indent: 3,
            tag: 'h1',
            type: 'Title',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        type: 'Paragraph',
        version: 1,
      },
      ...children,
    ],
    direction: null,
    format: '',
    indent: 0,
    instance,
    textFormat: 0,
    textStyle: '',
    type: 'Instance',
    version: 1,
  };
}
