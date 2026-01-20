/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {JSX} from 'react';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {translateI18n} from 'onchain-utility/language';
import {useCallback, useState} from 'react';
import {ErrorBoundary} from 'react-error-boundary';

import Button from './Button';
import Styles from './KatexEquationAlterer.module.less';
import KatexRenderer from './KatexRenderer';

type Props = {
  initialEquation?: string;
  onConfirm: (equation: string, inline: boolean) => void;
};

export default function KatexEquationAlterer({
  onConfirm,
  initialEquation = '',
}: Props): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const [equation, setEquation] = useState<string>(initialEquation);
  const [inline, setInline] = useState<boolean>(true);

  const onClick = useCallback(() => {
    onConfirm(equation, inline);
  }, [onConfirm, equation, inline]);

  const onCheckboxChange = useCallback(() => {
    setInline(!inline);
  }, [setInline, inline]);

  const placeholder = translateI18n('[TODO] Please enter a equation', {
    placeholder: '请输入方程式',
  });

  return (
    <>
      <div className={Styles.KatexEquationAlterer_defaultRow}>
        <span>
          {translateI18n('[TODO] Inline', {
            placeholder: '行内方程式',
          })}
          :
        </span>
        <input type="checkbox" checked={inline} onChange={onCheckboxChange} />
      </div>
      <div className={Styles.KatexEquationAlterer_defaultRow}>
        {translateI18n('[TODO] Equation', {
          placeholder: '方程式',
        })}
        :
      </div>
      <div className={Styles.KatexEquationAlterer_centerRow}>
        <textarea
          onChange={(event) => {
            setEquation(event.target.value);
          }}
          value={equation}
          placeholder={placeholder}
          className={Styles.KatexEquationAlterer_textArea}
        />
      </div>
      <div className={Styles.KatexEquationAlterer_defaultRow}>
        {translateI18n('[TODO] Visualization', {
          placeholder: '预览',
        })}
        :
      </div>
      <div
        className={`${Styles.KatexEquationAlterer_centerRow} ${
          Styles.preview
        } ${equation ? '' : Styles.empty}`}>
        <ErrorBoundary onError={(e) => editor._onError(e)} fallback={null}>
          <KatexRenderer
            equation={equation || placeholder}
            inline={false}
            onDoubleClick={() => null}
          />
        </ErrorBoundary>
      </div>
      <div className={Styles.KatexEquationAlterer_dialogActions}>
        <Button type="primary" onClick={onClick}>
          {translateI18n('[TODO] Confirm', {
            placeholder: '确认',
          })}
        </Button>
      </div>
    </>
  );
}
