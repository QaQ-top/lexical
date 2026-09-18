/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {JSX, Ref, RefObject} from 'react';

import {ChangeEvent, forwardRef} from 'react';

import Styles from './EquationEditor.module.less';

type BaseEquationEditorProps = {
  equation: string;
  inline: boolean;
  setEquation: (equation: string) => void;
};

function EquationEditor(
  {equation, setEquation, inline}: BaseEquationEditorProps,
  forwardedRef: Ref<HTMLInputElement | HTMLTextAreaElement>,
): JSX.Element {
  const onChange = (event: ChangeEvent) => {
    setEquation((event.target as HTMLInputElement).value);
  };

  return (
    <div className={Styles.EquationEditor_inputBackground}>
      <span className={Styles.EquationEditor_dollarSign}>
        {inline ? '' : '$'}
        {'$'}
      </span>
      <textarea
        className={Styles.EquationEditor_blockEditor}
        value={equation}
        onChange={onChange}
        ref={forwardedRef as RefObject<HTMLTextAreaElement>}
      />
      <span className={Styles.EquationEditor_dollarSign}>
        {'$'}
        {inline ? '' : '$'}
      </span>
    </div>
  );
}

export default forwardRef(EquationEditor);
