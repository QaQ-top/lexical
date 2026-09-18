/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable lexical/no-optional-chaining */
import type {IconFontProps} from '@ant-design/icons/lib/components/IconFont';

import {createFromIconfontCN} from '@ant-design/icons';
import {useSettings} from 'onchain-lexical-context/settings';
import React, {useMemo} from 'react';

import Styles from './index.module.less';

export const AliIconFontFn = (scriptUrl = '/font/iconfont.js') => {
  return createFromIconfontCN({
    scriptUrl,
  });
};

export const Icon: React.FC<IconFontProps<string>> = ({
  type,
  className,
  ...props
}) => {
  const {extra} = useSettings();
  const AliIconFont = AliIconFontFn(extra.iconScriptUrl);
  const staticIcon = useMemo(() => {
    return (
      <span className={props.disabled ? Styles.disabled : undefined}>
        <AliIconFont
          {...props}
          className={`${Styles.icon} ${className}`}
          type={type}
        />
      </span>
    );
  }, [className, props, type]);

  return staticIcon;
};

export const StaticIcon: React.FC<IconFontProps<string>> = ({
  type,
  className,
  ...props
}) => {
  const {extra} = useSettings();
  const AliIconFont = AliIconFontFn(extra.iconScriptUrl);

  const staticIcon = useMemo(() => {
    return (
      <span className={props.disabled ? Styles.disabled : undefined}>
        <AliIconFont
          {...props}
          className={`${Styles.icon} ${className}`}
          type={type}
        />
      </span>
    );
  }, []);

  return staticIcon;
};
