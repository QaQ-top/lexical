/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {JSX} from 'react';

import * as React from 'react';

import Styles from './Input.module.less';
import SelectStyles from './Select.module.less';

type SelectIntrinsicProps = JSX.IntrinsicElements['select'];
interface SelectProps extends SelectIntrinsicProps {
  label: string;
}

export default function Select({
  children,
  label,
  className,
  ...other
}: SelectProps): JSX.Element {
  return (
    <div className={Styles.Input__wrapper}>
      <label style={{marginTop: '-1em'}} className={Styles.Input__label}>
        {label}
      </label>
      <select {...other} className={className || SelectStyles.select}>
        {children}
      </select>
    </div>
  );
}
