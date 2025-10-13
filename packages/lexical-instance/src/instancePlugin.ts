/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {mergeRegister} from '@lexical/utils';
import {
  $getNodeByKey,
  $getSelection,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_LOW,
  INSERT_PARAGRAPH_COMMAND,
} from 'lexical';
import {$textToRichNodes} from 'onchain-lexical-markdown';
import React, {useEffect} from 'react';

import {
  $createInstanceNode,
  $createTitleOnlyInstanceNode,
  $isInstanceNode,
} from './base';
import {ADD_NEW_INSTANCE_NODE, PluginProps} from './const';
import {$createFragmentNode} from './fragment';
import {HorizontalRulePlugin} from './horizontal/horizontalPlugin';
import {$registerInstanceListItemInsertParagraph} from './list/item';
import {
  $registerNumberDecoratorDomUpdate,
  $registerNumberDecoratorNodeUpdate,
} from './number';
import {$registerInstanceParagraphNodeTransform} from './paragraph';
import {$registerInstanceHeadingNodeTransform} from './paragraph/title';
import {$registerTableCommand} from './table';
import {clearCache, getTemporaryContentText} from './utils';

export const InstancePlugin: React.FC<PluginProps> = (props) => {
  const {placeholder} = props;
  const [editor] = useLexicalComposerContext();
  // const {setSelectedInstance} = useInstanceConfig();
  useEffect(() => {
    return mergeRegister(
      $registerInstanceParagraphNodeTransform(editor, {placeholder}),
      $registerInstanceHeadingNodeTransform(editor),
      $registerInstanceListItemInsertParagraph(editor),
      $registerNumberDecoratorNodeUpdate(editor),
      $registerNumberDecoratorDomUpdate(editor),
      $registerTableCommand(editor),
      // $selectionChange(editor, setSelectedInstance),
      editor.registerCommand(
        INSERT_PARAGRAPH_COMMAND,
        (event) => {
          const selection = $getSelection();
          const [start, end] = selection?.getStartEndPoints() || [];
          if (start && end && start.key === end.key) {
            return $isInstanceNode($getNodeByKey(start.key));
          }
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        ADD_NEW_INSTANCE_NODE,
        ({insNodeKey, instances, isAddChildLevel}) => {
          if (insNodeKey) {
            const insNode = $getNodeByKey(insNodeKey);
            if ($isInstanceNode(insNode)) {
              const newInsNodes = instances.map((instance) => {
                const contentText = getTemporaryContentText(instance);
                if (contentText) {
                  const node = $createTitleOnlyInstanceNode(instance);
                  const fragment = $createFragmentNode();
                  $textToRichNodes(fragment, contentText);
                  node.append(...fragment.getChildren());
                  return node;
                } else {
                  return $createInstanceNode(instance);
                }
              });
              if (isAddChildLevel) {
                const [insChildNode] = insNode.getSelfInstanceChildren();
                if (insChildNode) {
                  for (
                    let index = newInsNodes.length - 1;
                    index > -1;
                    index--
                  ) {
                    const current = newInsNodes[index];
                    const pre = newInsNodes[index + 1];
                    if (pre) {
                      pre.insertBefore(current);
                    } else {
                      insChildNode.insertBefore(current);
                    }
                  }
                } else {
                  insNode.append(...newInsNodes);
                }
              } else {
                for (let index = 0; index < newInsNodes.length; index++) {
                  const current = newInsNodes[index];
                  const pre = newInsNodes[index - 1];
                  if (pre) {
                    pre.insertAfter(current);
                  } else {
                    insNode.insertAfter(current);
                  }
                }
              }
            }
          }
          return true;
        },
        COMMAND_PRIORITY_LOW,
      ),
    );
  }, [editor, placeholder]);
  useEffect(() => {
    return () => {
      clearCache();
    };
  }, []);
  return React.createElement(
    React.Fragment,
    {},
    React.createElement(HorizontalRulePlugin),
  );
};
