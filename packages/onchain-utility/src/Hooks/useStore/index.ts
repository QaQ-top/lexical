/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {useEffect, useRef, useState} from 'react';

import {makeDestructurable} from '../../base';

/**
 * @description 多状态管理
 * @date 2023-04-18 10:37:49
 * @export
 * @template T
 * @param {T} initStore 接收一个对象
 */
function useStore<T extends object>(initStore: T | (() => T)) {
  const unmountRef = useRef(false);
  const latestStore = useRef({} as T);

  const getDefaultStore = (isAutomaticRendering?: true): T => {
    if (typeof initStore === 'function') {
      // eslint-disable-next-line @typescript-eslint/ban-types
      const newStore = (initStore as Function)();
      if (!isAutomaticRendering) {
        latestStore.current = newStore;
      }
      return Object.assign(Object.create(null), newStore);
    } else {
      const newStore = initStore;
      if (!isAutomaticRendering) {
        latestStore.current = newStore;
      }
      return Object.assign(Object.create(null), initStore);
    }
  };

  const [store, set] = useState(getDefaultStore(true));

  useEffect(() => {
    if (typeof initStore === 'function') {
      // eslint-disable-next-line @typescript-eslint/ban-types
      latestStore.current = (initStore as Function)();
    } else {
      latestStore.current = initStore;
    }
    unmountRef.current = false;
    return () => {
      unmountRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStore = (params: Partial<T> | ((store: T) => T | void)) => {
    if (!unmountRef.current) {
      if (typeof params === 'function') {
        const newStore = Object.assign(
          Object.create(null),
          params(store) || store,
        );
        latestStore.current = newStore;
        set(newStore);
      } else {
        // console.log(JSON.parse(JSON.stringify(latestStore.current)));
        const newStore = Object.assign(
          Object.create(null),
          latestStore.current,
          params,
        );
        latestStore.current = newStore;
        // console.log(newStore, params, 'newStore');
        set(newStore);
      }
    }
  };
  const resetStore = () => set(getDefaultStore());

  return makeDestructurable(
    {
      latestStore,
      resetStore,
      setSilenceStore(params: Partial<T>) {
        Object.assign<T, Partial<T>>(latestStore.current, params);
        Object.assign<T, Partial<T>>(store, params);
      },
      setStore,
      store,
    },
    [store, setStore, resetStore, latestStore],
  );
}

export default useStore;
