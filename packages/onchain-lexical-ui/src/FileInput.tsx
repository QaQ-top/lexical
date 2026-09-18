/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {DeleteOutlined, UploadOutlined} from '@ant-design/icons';
import {type JSX, useState} from 'react';

import Styles from './Input.module.less';

type Props = Readonly<{
  'data-test-id'?: string;
  accept?: string;
  placeholder?: string;
  label: string;
  onChange: (files: FileList | null) => void;
}>;

export default function FileInput({
  accept,
  label,
  placeholder = '选择文件',
  onChange,
  'data-test-id': dataTestId,
}: Props): JSX.Element {
  const [files, setFiles] = useState<File[]>([]);
  return (
    <div className={Styles.Input__wrapper}>
      <label className={Styles.Input__label}>{label}</label>
      <div className={`${Styles.Input__input} ${Styles.file}`}>
        {!files.length ? (
          <label htmlFor="file-upload">
            <UploadOutlined />
            {placeholder}
          </label>
        ) : (
          <span className={Styles.content}>
            <span className={Styles.name}>
              {files.map((file) => file.name)}
            </span>
            <span className={Styles.delete}>
              <DeleteOutlined
                onClick={() => {
                  onChange(null);
                  setFiles([]);
                }}
              />
            </span>
          </span>
        )}
        <input
          id="file-upload"
          type="file"
          accept={accept}
          onChange={(e) => {
            setFiles(Array.from(e.target.files || []));
            onChange(e.target.files);
          }}
          data-test-id={dataTestId}
        />
      </div>
    </div>
  );
}
