/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useInstanceConfig} from 'onchain-lexical-context/instanceConfig';
import Skeleton from 'onchain-lexical-ui/Skeleton';
import {useEffect, useState} from 'react';

import {Instance} from '../types';

const Number = (props: {
  serial: string;
  instance?: Instance;
  instanceNodeKey?: string;
}): JSX.Element => {
  const {serial, instance, instanceNodeKey} = props;
  const [number, setNumber] = useState(instance?.number);
  const [loading, setLoading] = useState(false);
  const {generateNumber} = useInstanceConfig();

  useEffect(() => {
    if (!instance) {
      setLoading(true);
      generateNumber(instanceNodeKey)
        .then((number) => {
          setNumber(number);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, []);

  return (
    <div title={`${serial} ${number}`}>
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
