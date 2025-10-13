/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

export interface InstanceBaseInfo {
  insId?: string;
  number?: string;
  insDesc?: string;
  itemCode?: number | string;
  insBom?: boolean;
  objectApicode: string;
}

interface InstanceExtraAttributes {
  attributes: {[k: string]: any};
  newVal?: Record<string, any>;
  [key: string]: any;
}

export interface Instance
  extends InstanceBaseInfo,
    Partial<InstanceExtraAttributes> {
  children?: Instance[];
  disable?: boolean;
  checkOut?: boolean;
  insVersionUnbound?: string;
  insVersionOrderUnbound?: string;
  trackLinkCount?: number | null;
  __contentText?: string;
}

export type CompleteInstance = Required<InstanceBaseInfo> &
  InstanceExtraAttributes;
