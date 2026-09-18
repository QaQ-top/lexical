/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable react-hooks/exhaustive-deps */

import type {InstanceNode} from '../base';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$getNodeByKey} from 'lexical';
import {useInstanceConfig} from 'onchain-lexical-context/instanceConfig';
import Skeleton from 'onchain-lexical-ui/Skeleton';
import {useEffect, useState} from 'react';

import {numberNodeKey} from '../const';
import {Instance} from '../types';

const Number = (props: {
  serial: string;
  instance?: Instance;
  instanceNodeKey?: string;
}): JSX.Element => {
  const [editor] = useLexicalComposerContext();
  const {serial, instance, instanceNodeKey} = props;
  const [number, setNumber] = useState(instance?.number);
  const [loading, setLoading] = useState(false);
  const {generateNumber} = useInstanceConfig();

  useEffect(() => {
    if (instance && !number) {
      setLoading(true);
      generateNumber(instanceNodeKey)
        .then((number) => {
          setNumber(number);
          if (instanceNodeKey) {
            numberNodeKey.set(number, instanceNodeKey);
            editor.update(() => {
              const instanceNode = $getNodeByKey<InstanceNode>(instanceNodeKey);
              instanceNode?.setInstance({number});
            });
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      if (instanceNodeKey) {
        numberNodeKey.set(number!, instanceNodeKey);
      }
    }
  }, []);

  return (
    <div>
      <span>{serial}</span>
      <span>
        {loading ? (
          <Skeleton type="text" style={{height: 18, width: 104}} />
        ) : (
          number
        )}
      </span>
    </div>
  );
};

export default Number;
