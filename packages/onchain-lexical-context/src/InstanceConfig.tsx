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
  Params = Record<string, any>,
> = InstanceConfig<Ins, Let> & BuiltInInstanceConfig<Ins, Params>;

const Context: React.Context<InstanceConfigContext> = createContext({} as any);

export const InstanceConfigContext = <
  Ins = Instance,
  Let = Record<string, any>,
  Params = Record<string, any>,
>({
  children,
  value,
}: {
  children: ReactNode;
  value: InstanceConfig<Ins, Let>;
}): JSX.Element => {
  const [selectedInstance, setSelectedInstance] = React.useState<
    BuiltInInstanceConfig<Ins, Params>['selectedInstance']
  >([]);
  const [instanceMap, setInstanceMap] = React.useState(
    new Map<string, Instance>(),
  );

  const [parameterUnified, setParameterUnified] = React.useState(
    new ParameterUnified<any>([]),
  );

  return (
    <Context.Provider
      value={{
        ...(value as unknown as InstanceConfig),
        instanceMap,
        parameterUnified,
        selectedInstance,
        setInstanceMap,
        setParameterUnified,
        setSelectedInstance,
      }}>
      {children}
    </Context.Provider>
  );
};

export const useInstanceConfig = <
  Ins = Instance,
  Let = Record<string, any>,
  Params = Record<string, any>,
>() => {
  return useContext(Context) as unknown as InstanceConfigContext<
    Ins,
    Let,
    Params
  >;
};

interface ParameterHandle<T> {
  getMax: (data: T) => string | number;
  getMin: (data: T) => string | number;
  getValue: (data: T) => string | number;
  getUnit: (data: T) => string | number;
}
export class ParameterUnified<T extends {[k: string]: any}> {
  handle: ParameterHandle<T>;
  map = new Map<string, T>();
  constructor(
    data: T[],
    config: ParameterHandle<T> = {
      getMax: (data) => {
        return '';
      },
      getMin: (data) => {
        return '';
      },
      getUnit: (data) => {
        return '';
      },
      getValue: (data) => {
        return '';
      },
    },
  ) {
    this.handle = config;
    this.map = new Map(data.map((item) => [item.insId, item]));
  }
  setParameter(data: T) {
    this.map.set(data.insId, data);
    return this;
  }
  getParameterValue(data?: T | string) {
    if (typeof data === 'string') {
      data = this.map.get(data);
    }
    if (data) {
      const value = this.handle.getValue(data);
      const unit = this.handle.getUnit(data);
      const max = this.handle.getMax(data);
      const min = this.handle.getMin(data);
      if (value) {
        return `${value}${unit}`;
      } else {
        return `${min}${unit}-${max}${unit}`;
      }
    }
    return '';
  }
}
