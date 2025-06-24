/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {useEffect, useRef} from 'react';

const useLatest = <T>(value: T) => {
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  return latest;
};

export default useLatest;
