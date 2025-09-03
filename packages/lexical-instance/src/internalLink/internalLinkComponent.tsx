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

import {EditorConfig, LexicalEditor} from 'lexical';
import {useCallback, useEffect, useState} from 'react';

import {internalLinkNameUpdateMap} from '../const';
import {$getInstanceNodeByNumber, $scrollTo, getLatestValue} from '../utils';
import Styles from './styles.module.less';

export default function InternalLinkComponent({
  self,
  editor,
  config,
  number,
  nodeKey,
}: {
  self: InternalLinkNode;
  number: string;
  nodeKey: string;
  editor: LexicalEditor;
  config: EditorConfig;
}) {
  const [name, setName] = useState<string>();
  const [serial, setSerial] = useState<string>();

  const update = useCallback(function () {
    editor.read(() => {
      const node = $getInstanceNodeByNumber(number)!;
      setName(getLatestValue(node.__instance.value, 'insDesc'));
      setSerial(node.getSerialNumber());
    });
  }, []);

  useEffect(() => {
    update();
  }, []);

  useEffect(() => {
    let timeout = 0;
    let map: Map<string, () => void>;
    const debounceUpdate = () => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        update();
      }, 100);
    };
    if (internalLinkNameUpdateMap.has(number)) {
      map = internalLinkNameUpdateMap.get(number)!.set(nodeKey, debounceUpdate);
    } else {
      map = new Map([[nodeKey, debounceUpdate]]);
      internalLinkNameUpdateMap.set(number, map);
    }
    return () => {
      map.delete(number);
    };
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
