/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {mergeRegister} from '@lexical/utils';
import React, {useEffect} from 'react';

import {PluginProps} from './const';
import {HorizontalRulePlugin} from './horizontal/horizontalPlugin';
import {$registerInstanceListItemInsertParagraph} from './list/item';
import {
  $registerNumberDecoratorDomUpdate,
  $registerNumberDecoratorNodeUpdate,
} from './number';
import {$registerInstanceParagraphNodeTransform} from './paragraph';
import {$registerInstanceHeadingNodeTransform} from './paragraph/title';
import {$registerTableCommand} from './table';

export const InstancePlugin: React.FC<PluginProps> = (props) => {
  const {placeholder} = props;
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    return mergeRegister(
      $registerInstanceParagraphNodeTransform(editor, {placeholder}),
      $registerInstanceHeadingNodeTransform(editor),
      $registerInstanceListItemInsertParagraph(editor),
      $registerNumberDecoratorNodeUpdate(editor),
      $registerNumberDecoratorDomUpdate(editor),
      $registerTableCommand(editor),
    );
  }, [editor, placeholder]);
  return React.createElement(
    React.Fragment,
    {},
    React.createElement(HorizontalRulePlugin),
  );
};
