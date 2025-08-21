import {EditorState} from 'lexical';
import React from 'react';

/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
export interface ExtraSettings {
  iconScriptUrl?: string;
  isShowActions?: boolean;
  showTreeView?: boolean;
  showHeaderToolbar?: boolean;
}

export interface BuiltInInstanceConfig {
  selectedInstance: {
    number: string;
    nodeKey: string;
  }[];
  setSelectedInstance(params: InstanceConfig['selectedInstance']): void;
  instanceMap: Map<string, Instance>;
  setInstanceMap(map: Map<string, Instance>): void;
}

export interface InstanceConfigLet {
  loading: boolean;
  table: React.MutableRefObject<{
    initSerializedData: string;
    cancelModification?: () => void;
  }>;
}
export interface InstanceConfig {
  namespace: string;
  isCanAdded: boolean;
  icl: InstanceConfigLet;
  setIcl(params: Partial<InstanceConfigLet>): void;
  preview?: boolean;
  getInstanceIcon: (objectApicode: string) => string;
  uploadFiles(
    params: {type: string; text: string; suffix: string}[],
  ): Promise<string[]>;
  generateNumber(nodeKey?: string): Promise<string>;
}
