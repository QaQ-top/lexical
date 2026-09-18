/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @lexical/rules-of-lexical */
/* eslint-disable jsx-a11y/no-static-element-interactions */

import type {InternalLinkNode} from '.';

import {mergeRegister} from '@lexical/utils';
import {COMMAND_PRIORITY_EDITOR, EditorConfig, LexicalEditor} from 'lexical';
import {useEffect, useState} from 'react';

import {INSTANCE_TITLE_UPDATE} from '../const';
import {$getInstanceNodeByNumber, $scrollTo, getLatestValue} from '../utils';
import Styles from './styles.module.less';

export default function InternalLinkComponent(props: {
  self: InternalLinkNode;
  /** 链接目标的编号 */
  number: string;
  /** 引用链接组件所在文档内自身节点 */
  nodeKey: string;
  editor: LexicalEditor;
  config: EditorConfig;
}) {
  const {editor, number} = props;
  const [name, setName] = useState<string>();
  const [serial, setSerial] = useState<string>();

  useEffect(() => {
    Promise.resolve().then(() => {
      // 需要等待节点载入富文本后才能获取到实例节点
      editor.read(() => {
        const node = $getInstanceNodeByNumber(number)!;
        if (node) {
          setName(getLatestValue(node.__instance.value, 'insDesc'));
          setSerial(node.getSerialNumber());
        }
      });
    });
  }, []);

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        INSTANCE_TITLE_UPDATE,
        (priority) => {
          if (priority.number === number) {
            editor.read(() => {
              const node = $getInstanceNodeByNumber(priority.number)!;
              if (priority.title !== undefined && priority.title !== null) {
                setName(priority.title);
              }
              setSerial(node.getSerialNumber());
            });
          }
          return false;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, []);

  if (name) {
    return (
      <span
        className={`${Styles.internalLink}`}
        onClick={() =>
          editor.update(() => {
            $scrollTo(number);
          })
        }>
        <span>{serial}</span>
        <span>{name}</span>
      </span>
    );
  } else {
    return null;
  }
}
