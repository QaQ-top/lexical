/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$getNodeByKey} from 'lexical';
import {useInstanceConfig} from 'onchain-lexical-context/instanceConfig';
import {useCallback, useMemo} from 'react';

import {$createInstanceNode} from '../base';
import Styles from './styles.module.less';

const Bar = (props: {nodeKey: string; insNodeKey?: string}): JSX.Element => {
  const {nodeKey, insNodeKey} = props;
  const [editor] = useLexicalComposerContext();
  const {selectedInstance} = useInstanceConfig();

  const isSelected = useMemo(() => {
    return !!selectedInstance.find((item) => item.nodeKey === insNodeKey);
  }, [selectedInstance, insNodeKey]);

  const onInsertBlock = useCallback(
    (e: React.MouseEvent) => {
      if (!editor) {
        return;
      }
      editor.update(() => {
        const node = $getNodeByKey(nodeKey)!;
        const parent = node.getParent();
        if (!parent) {
          return;
        }
        const pNode = $createInstanceNode();
        if (e.altKey || e.ctrlKey) {
          parent.append(pNode);
          // node.insertBefore(pNode);
        } else {
          parent.insertAfter(pNode);
          // node.append(pNode)
        }
        pNode.select();
      });

      return;
    },
    [editor],
  );

  return (
    <>
      <div data-bar="left" className={Styles.left}>
        <span>⭕</span>
        <span>link</span>
        <button onClick={onInsertBlock}>+</button>
      </div>
      <div data-bar="right" className={Styles.right}>
        {/* 111 */}
        {isSelected ? <span>🚩</span> : null}
      </div>
    </>
  );
};

export default Bar;
