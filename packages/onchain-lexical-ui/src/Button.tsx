/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {JSX} from 'react';

import * as React from 'react';
import {ReactNode} from 'react';

import Styles from './Button.module.less';
import joinClasses from './utils/joinClasses';

export default function Button({
  'data-test-id': dataTestId,
  children,
  className,
  onClick,
  disabled,
  small,
  title,
  type,
}: {
  'data-test-id'?: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick: () => void;
  small?: boolean;
  title?: string;
  type?: 'primary';
}): JSX.Element {
  return (
    <button
      disabled={disabled}
      className={joinClasses(
        Styles.Button__root,
        disabled && Styles.Button__disabled,
        small && Styles.Button__small,
        className,
      )}
      onClick={onClick}
      title={title}
      aria-label={title}
      data-type={type}
      {...(dataTestId && {'data-test-id': dataTestId})}>
      {children}
    </button>
  );
}
