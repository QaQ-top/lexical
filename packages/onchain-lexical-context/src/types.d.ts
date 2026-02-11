import {EditorState} from 'lexical';
import type {Instance} from 'onchain-lexical-instance';
import React from 'react';
import type {ReactAvatarProps} from 'react-avatar';
import {ParameterUnified} from './InstanceConfig';

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
export interface ExtraSettings {
  placeholder?: string;
  iconScriptUrl?: string;
  isShowActions?: boolean;
  showTreeView?: boolean;
  showHeaderToolbar?: boolean;
  showLeftToolbar?: boolean;
  showRightToolbar?: boolean;
  isCanComment?: boolean;
  getZIndex?: () => number;
  reduceZIndex?: () => void;
}

export interface BuiltInInstanceConfig<
  Ins = Instance,
  Params = Record<string, any>,
> {
  selectedInstance: {
    number: string;
    nodeKey: string;
  }[];
  setSelectedInstance(params: InstanceConfig['selectedInstance']): void;
  instanceMap: Map<string, Ins>;
  setInstanceMap(map: Map<string, Ins>): void;
  parameterUnified: ParameterUnified<Params>;
  setParameterUnified(map: ParameterUnified<Params>): void;
}

export interface InstanceConfigLet {
  loading: boolean;
  verifyPermissions: boolean;
  table: React.MutableRefObject<{
    saveModification?: (params: {
      onSaved?: () => Promise<void>;
      setLoading?: (value: boolean) => void;
    }) => void | Promise<void>;
    cancelModification?: () => void;
  }>;
}
export interface InstanceConfig<Ins = Instance, Let = {}> {
  namespace: string;
  icl: InstanceConfigLet & Let;
  setIcl(params: Partial<InstanceConfigLet & Let>): void;
  components?: {
    TrackLinkList?: (props: {number: string}) => JSX.Element;
  };
  preview?: boolean;
  checkOut: (instance: Ins) => Ins | void | Promise<Ins | void>;
  checkIn: (instance: Ins) => Ins | void | Promise<Ins | void>;
  cancelCheckout: (instance: Ins) => Ins | void | Promise<Ins | void>;
  getInstanceIcon: (objectApicode: string) => string;
  uploadFiles(
    params: {type: string; text: string; suffix: string}[],
  ): Promise<string[]>;
  generateNumber(nodeKey?: string): Promise<string>;
}
