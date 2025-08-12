/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable react-hooks/exhaustive-deps */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$getNodeByKey} from 'lexical';
import {useInstanceConfig} from 'onchain-lexical-context/instanceConfig';
import {Icon} from 'onchain-lexical-ui/Icon';
import {useCallback, useMemo} from 'react';

import {$createInstanceNode} from '../base';
import {Instance} from '../types';
import Styles from './styles.module.less';

const Bar = (props: {
  nodeKey: string;
  insNodeKey?: string;
  instance?: Instance;
}): JSX.Element => {
  const {nodeKey, insNodeKey, instance} = props;
  const [editor] = useLexicalComposerContext();
  const {preview, selectedInstance, getInstanceIcon} = useInstanceConfig();
  // icon-front-link1
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

  const icon = useMemo(() => {
    if (instance) {
      return getInstanceIcon(instance.objectApicode) || 'demand1';
    }
    return 'demand1';
  }, [instance]);

  const hasChildren = !!instance?.children?.length || instance?.insBom;

  return (
    <>
      <div data-bar="left" className={Styles.left}>
        <Icon
          className={hasChildren ? Styles.hasChildren : undefined}
          type={`icon-front-${icon}`}
        />
        {!preview ? (
          <>
            <Icon
              className={`${Styles.hover} ${Styles.link}`}
              type="icon-front-link1"
            />
            <Icon
              className={Styles.hover}
              type="icon-front-xinzeng1"
              onClick={onInsertBlock}
            />
          </>
        ) : null}
      </div>
      <div data-bar="right" className={Styles.right}>
        <span>
          <Icon
            className={isSelected ? Styles.selected : undefined}
            type="icon-front-corresponding"
          />
        </span>
      </div>
    </>
  );
};

export default Bar;
