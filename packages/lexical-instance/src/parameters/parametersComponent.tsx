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
import {useInstanceConfig} from 'onchain-lexical-context/instanceConfig';
import {useStore} from 'onchain-utility/hooks';
import {translateI18n} from 'onchain-utility/language';
import React, {useEffect, useImperativeHandle, useRef} from 'react';

import {INSERT_PARAMETERS, PARAMETERS_UPDATE} from '../const';
import {$getInstanceNodeByChild} from '../utils';
import {$isParametersNode} from '.';
import Styles from './styles.module.less';
import {ParameterRef} from './types';

const ParametersComponent = React.forwardRef<ParameterRef, {nodeKey: string}>(
  ({nodeKey}, ref) => {
    const [editor] = useLexicalComposerContext();
    const {preview, parameterUnified} = useInstanceConfig();
    const spanRef = useRef<HTMLSpanElement>(null);
    const [parameter, setParameter, , latestParameter] = useStore({
      insId: '',
      number: '',
      value: '',
    });

    const isCanUse = !preview;

    useEffect(() => {
      editor.read(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isParametersNode(node)) {
          const parameter = node.parameter;
          setParameter(
            Object.assign(node.parameter, {
              value: parameterUnified.getParameterValue(parameter.insId),
            }),
          );
        }
      });
      return mergeRegister(
        editor.registerCommand(
          PARAMETERS_UPDATE,
          ({parameters}) => {
            const latest = latestParameter.current;
            const parameter = parameters.find(
              (parameter) => parameter.insId === latest.insId,
            );
            if (!parameter) {
              return false;
            }
            const node = $getNodeByKey(nodeKey);
            if ($isParametersNode(node)) {
              Promise.resolve().then(() => {
                const value = parameterUnified
                  .setParameter(parameter)
                  .getParameterValue(parameter.insId);
                setParameter({value});
                Object.assign(node.parameter, {value});
              });
            }
            return false;
          },
          COMMAND_PRIORITY_EDITOR,
        ),
      );
    }, [parameterUnified]);

    useImperativeHandle(
      ref,
      () => {
        return {
          getParameter() {
            return latestParameter.current;
          },
          getValue() {
            return parameterUnified.getParameterValue(
              latestParameter.current.insId,
            );
          },
        };
      },
      [parameterUnified],
    );

    return (
      <span
        className={`parameter ${Styles.parameter} ${
          isCanUse ? Styles.pointer : ''
        }`}
        title={translateI18n('[TODO] Parameter', {placeholder: '参数'})}
        ref={spanRef}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (isCanUse) {
            editor.dispatchCommand(INSERT_PARAMETERS, {
              instance: editor.read(() => {
                return $getInstanceNodeByChild($getNodeByKey(nodeKey)!)
                  ?.__instance.value;
              }),
              nodeKey,
              target: parameter.insId,
            });
          }
        }}>
        {parameter.value}
      </span>
    );
  },
);

export default ParametersComponent;
