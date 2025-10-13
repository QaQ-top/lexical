/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable react-hooks/exhaustive-deps */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {mergeRegister} from '@lexical/utils';
import {$getNodeByKey, COMMAND_PRIORITY_EDITOR} from 'lexical';
import {useInstanceConfig} from 'onchain-lexical-context/instanceConfig';
import {useSettings} from 'onchain-lexical-context/settings';
import DropDown, {DropDownItem} from 'onchain-lexical-ui/DropDown';
import {Icon, StaticIcon} from 'onchain-lexical-ui/Icon';
import {translateI18n} from 'onchain-utility';
import {useCallback, useEffect, useMemo, useState} from 'react';

import {$isInstanceNode, InstanceNode} from '../base';
import {COMPONENT_UPDATE, OPEN_CREATE_WINDOW} from '../const';
import {Instance} from '../types';
import Styles from './styles.module.less';

const Bar = (props: {
  nodeKey: string;
  insNodeKey?: string;
  instance?: Instance;
}): JSX.Element => {
  const {insNodeKey} = props;
  const [editor] = useLexicalComposerContext();
  const {
    preview,
    selectedInstance,
    getInstanceIcon,
    components,
    setSelectedInstance,
    checkIn,
    checkOut,
    cancelCheckout,
  } = useInstanceConfig();
  const {extra} = useSettings();
  const [open, setOpen] = useState(false);
  const [instance, setInstance] = useState(props.instance);
  const [parentInstance, setParentInstance] = useState<
    Instance | undefined | null
  >(null);

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

  useEffect(() => {
    editor.read(() => {
      setParentInstance(
        ($getNodeByKey(insNodeKey!)?.getParent() as InstanceNode)?.__instance
          ?.value,
      );
    });
  }, [insNodeKey, editor]);

  const hasChildren = !!instance?.children?.length || instance?.insBom;

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        COMPONENT_UPDATE,
        ({name, insNodeKey: key}) => {
          if (name !== 'bar') {
            return false;
          }
          if (key) {
            if (key !== insNodeKey) {
              return false;
            }
          }
          if (insNodeKey) {
            const instanceNode = $getNodeByKey(insNodeKey);
            if ($isInstanceNode(instanceNode)) {
              const instance = instanceNode.__instance.value;
              setInstance({...instance});
            }
          }

          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, []);

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
              {parentInstance ? (
                <DropDownItem
                  disabled={parentInstance.disable}
                  onClick={() => onInsertBlock(false)}>
                  {translateI18n('[TODO] 国际化', {
                    placeholder: '添加到同级',
                  })}
                </DropDownItem>
              ) : null}
              <DropDownItem
                disabled={instance?.disable}
                onClick={() => onInsertBlock(true)}>
                {translateI18n('[TODO] 国际化', {
                  placeholder: '添加到子级',
                })}
              </DropDownItem>
            </DropDown>
          </>
        ) : null}
      </div>
      <div data-bar="right" className={Styles.right}>
        {!preview && extra.showRightToolbar !== false ? (
          <>
            {instance?.checkOut && instance.insVersionOrderUnbound !== '1' ? (
              <>
                <span
                  title={translateI18n('[TODO] 国际化', {
                    placeholder: '签入',
                  })}>
                  <Icon
                    disabled={!instance.isSelfCheckOut}
                    type="icon-front-rightbar-checkin"
                    onClick={async () => {
                      await checkIn(instance);
                    }}
                  />
                </span>
                <span
                  title={translateI18n('[TODO] 国际化', {
                    placeholder: '取消签出',
                  })}>
                  <Icon
                    disabled={!instance.isSelfCheckOut}
                    type="icon-front-rightbar-cancelcheckout"
                    onClick={async () => {
                      await cancelCheckout(instance);
                    }}
                  />
                </span>
              </>
            ) : (
              <span
                title={translateI18n('[TODO] 国际化', {
                  placeholder: '签出',
                })}>
                <Icon
                  type="icon-front-rightbar-checkout"
                  onClick={async () => {
                    await checkOut(instance!);
                  }}
                />
              </span>
            )}
          </>
        ) : null}
        <span>
          <Icon
            className={isSelected ? Styles.selected : undefined}
            type="icon-front-corresponding"
            onClick={() => {
              if (insNodeKey) {
                editor.read(() => {
                  const node = $getNodeByKey(insNodeKey);
                  if ($isInstanceNode(node)) {
                    setSelectedInstance([
                      {
                        nodeKey: node.getKey(),
                        number: node.__instance.value.number!,
                      },
                    ]);
                  }
                });
              }
            }}
          />
        </span>
      </div>
    </>
  );
};

export default Bar;
