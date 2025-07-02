/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type {IconFontProps} from '@ant-design/icons/lib/components/IconFont';

import {createFromIconfontCN} from '@ant-design/icons';
import React from 'react';

export const AliIconFontFn = (scriptUrl = '/font/iconfont.js') => {
  return createFromIconfontCN({
    scriptUrl,
  });
};

export const Icon: React.FC<IconFontProps & {iconScriptUrl?: string}> = ({
  type,
  iconScriptUrl,
}) => {
  const AliIconFont = AliIconFontFn(iconScriptUrl);
  return <AliIconFont type={type} />;
};
