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

type Props = Readonly<{
  'data-test-id'?: string;
  accept?: string;
  label: string;
  onChange: (files: FileList | null) => void;
}>;

export default function FileInput({
  accept,
  label,
  onChange,
  'data-test-id': dataTestId,
}: Props): JSX.Element {
  return (
    <div className={Styles.Input__wrapper}>
      <label className={Styles.Input__label}>{label}</label>
      <input
        type="file"
        accept={accept}
        className={Styles.Input__input}
        onChange={(e) => onChange(e.target.files)}
        data-test-id={dataTestId}
      />
    </div>
  );
}
