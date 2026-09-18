/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import * as React from 'react';

import ColorPicker from './ColorPicker';
import DropDown from './DropDown';

type Props = {
  disabled?: boolean;
  buttonAriaLabel?: string;
  buttonClassName: string;
  buttonIconClassName?: string;
  buttonLabel?: string;
  title?: string;
  stopCloseOnClickSelf?: boolean;
  color: string;
  onChange?: (color: string, skipHistoryStack: boolean) => void;
};

export default function DropdownColorPicker({
  disabled = false,
  stopCloseOnClickSelf = true,
  color,
  onChange,
  ...rest
}: Props) {
  const timeout = React.useRef(0);
  const debounce = React.useCallback(
    (value: string, skipHistoryStack: boolean) => {
      clearTimeout(timeout.current);
      timeout.current = window.setTimeout(() => {
        if (onChange) {
          onChange(value, skipHistoryStack);
        }
      }, 100);
    },
    [onChange],
  );

  return (
    <DropDown
      {...rest}
      disabled={disabled}
      stopCloseOnClickSelf={stopCloseOnClickSelf}>
      <ColorPicker color={color} onChange={debounce} />
    </DropDown>
  );
}
