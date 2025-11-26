/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import type {BuiltInInstanceConfig, InstanceConfig} from './types';
import type {Instance} from 'onchain-lexical-instance';
import type {JSX} from 'react';

import * as React from 'react';
import {createContext, ReactNode, useContext} from 'react';

type InstanceConfigContext<
  Ins = Instance,
  Let = Record<string, any>,
> = InstanceConfig<Ins, Let> & BuiltInInstanceConfig<Ins>;

const Context: React.Context<InstanceConfigContext> = createContext({} as any);

export const InstanceConfigContext = <
  Ins = Instance,
  Let = Record<string, any>,
>({
  children,
  value,
}: {
  children: ReactNode;
  value: InstanceConfig<Ins, Let>;
}): JSX.Element => {
  const [selectedInstance, setSelectedInstance] = React.useState<
    BuiltInInstanceConfig<Ins>['selectedInstance']
  >([]);
  const [instanceMap, setInstanceMap] = React.useState(
    new Map<string, Instance>(),
  );

  return (
    <Context.Provider
      value={{
        ...(value as unknown as InstanceConfig),
        instanceMap,
        selectedInstance,
        setInstanceMap,
        setSelectedInstance,
      }}>
      {children}
    </Context.Provider>
  );
};

export const useInstanceConfig = <
  Ins = Instance,
  Let = Record<string, any>,
>() => {
  return useContext(Context) as unknown as InstanceConfigContext<Ins, Let>;
};
