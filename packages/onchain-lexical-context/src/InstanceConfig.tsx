/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type {InstanceConfig} from './types';
import type {JSX} from 'react';

import * as React from 'react';
import {createContext, ReactNode, useContext, useMemo} from 'react';

type InstanceConfigContext = InstanceConfig;

const Context: React.Context<InstanceConfigContext> = createContext({} as any);

export const InstanceConfigContext = ({
  children,
  value,
}: {
  children: ReactNode;
  value: InstanceConfig;
}): JSX.Element => {
  const contextValue = useMemo(() => {
    return {...value};
  }, [value]);

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export const useInstanceConfig = (): InstanceConfigContext => {
  return useContext(Context);
};
