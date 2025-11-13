/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {mergeRegister} from '@lexical/utils';
import {$getNodeByKey, COMMAND_PRIORITY_EDITOR} from 'lexical';
import {useStore} from 'onchain-utility/hooks';
import {useEffect} from 'react';

import {PARAMETERS_UPDATE} from '../const';
import {$isParametersNode} from '.';

const ParametersComponent = ({nodeKey}: {nodeKey: string}) => {
  const [editor] = useLexicalComposerContext();
  const [parameters, setParameters, , latestParameters] = useStore({
    number: '',
    value: '',
  });

  useEffect(() => {
    editor.read(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isParametersNode(node)) {
        setParameters(node.parameters);
      }
    });
    return mergeRegister(
      editor.registerCommand(
        PARAMETERS_UPDATE,
        ({number, value}) => {
          const latest = latestParameters.current;
          if (number !== latest.number) {
            return false;
          }
          const node = $getNodeByKey(nodeKey);
          if ($isParametersNode(node)) {
            setParameters({value});
            Object.assign(node.parameters, {value});
          }
          return true;
        },
        COMMAND_PRIORITY_EDITOR,
      ),
    );
  }, []);

  return <span>{parameters.value}</span>;
};

export default ParametersComponent;
