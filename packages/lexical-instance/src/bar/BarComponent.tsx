/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable react-hooks/exhaustive-deps */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {useInstanceConfig} from 'onchain-lexical-context/instanceConfig';
import {useSettings} from 'onchain-lexical-context/settings';
import DropDown, {DropDownItem} from 'onchain-lexical-ui/DropDown';
import {Icon, StaticIcon} from 'onchain-lexical-ui/Icon';
import {translateI18n} from 'onchain-utility';
import {useCallback, useMemo, useState} from 'react';

import {OPEN_CREATE_WINDOW} from '../const';
import {Instance} from '../types';
import Styles from './styles.module.less';

const Bar = (props: {
  nodeKey: string;
  insNodeKey?: string;
  instance?: Instance;
}): JSX.Element => {
  const {insNodeKey, instance} = props;
  const [editor] = useLexicalComposerContext();
  const {preview, selectedInstance, getInstanceIcon, components} =
    useInstanceConfig();
  const {extra} = useSettings();
  const [open, setOpen] = useState(false);

  // icon-front-link1
  const isSelected = useMemo(() => {
    return !!selectedInstance.find((item) => item.nodeKey === insNodeKey);
  }, [selectedInstance, insNodeKey]);

  const onInsertBlock = useCallback(
    (isAddChildLevel: boolean) => {
      // if (!editor) {
      //   return;
      // }
      // editor.update(() => {
      //   const node = $getNodeByKey(nodeKey)!;
      //   const parent = node.getParent();
      //   if (!parent) {
      //     return;
      //   }
      //   const pNode = $createInstanceNode();
      //   if (e.altKey || e.ctrlKey) {
      //     parent.append(pNode);
      //     // node.insertBefore(pNode);
      //   } else {
      //     parent.insertAfter(pNode);
      //     // node.append(pNode)
      //   }
      //   pNode.select();
      // });
      editor.dispatchCommand(OPEN_CREATE_WINDOW, {
        insNodeKey,
        isAddChildLevel,
        number: instance!.number!,
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

  const Components = useMemo(() => {
    return {
      ...components,
    };
  }, [components]);

  const hasChildren = !!instance?.children?.length || instance?.insBom;

  return (
    <>
      <div data-bar="left" className={Styles.left}>
        <Icon
          className={hasChildren ? Styles.hasChildren : undefined}
          type={`icon-front-${icon}`}
        />
        {!preview && extra.showLeftToolbar !== false ? (
          <>
            <span
              className={`${Styles.link} ${
                open ? Styles.hiddenLinkCount : ''
              }`}>
              <DropDown
                arrow={true}
                showIcon={false}
                disabled={!instance?.trackLinkCount}
                stopCloseOnClickSelf={true}
                buttonLabel={
                  // [TODO] 显示 trackLinkCount
                  <div>
                    <i>{instance?.trackLinkCount || ''}</i>
                    <StaticIcon
                      className={`${Styles.hover}`}
                      type="icon-front-link1"
                    />
                  </div>
                }
                onOpen={setOpen}>
                {Components.TrackLinkList && instance ? (
                  <Components.TrackLinkList number={instance.number!} />
                ) : null}
              </DropDown>
            </span>
            <DropDown
              arrow={true}
              showIcon={false}
              buttonLabel={
                <Icon className={Styles.hover} type="icon-front-xinzeng1" />
              }
              buttonAriaLabel="Formatting options for text style">
              <DropDownItem onClick={() => onInsertBlock(false)}>
                {translateI18n('[TODO] 国际化', {
                  placeholder: '添加到同级',
                })}
              </DropDownItem>
              <DropDownItem onClick={() => onInsertBlock(true)}>
                {translateI18n('[TODO] 国际化', {
                  placeholder: '添加到子级',
                })}
              </DropDownItem>
            </DropDown>
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
