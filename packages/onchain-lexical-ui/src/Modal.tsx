/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable lexical/no-optional-chaining */

import type {JSX} from 'react';

import {isDOMNode} from 'lexical';
import * as React from 'react';
import {ReactNode, useEffect, useRef} from 'react';
import {createPortal} from 'react-dom';
import Draggable, {DraggableData, DraggableEvent} from 'react-draggable';

import Styles from './Modal.module.less';

function PortalImpl({
  onClose,
  children,
  title,
  closeOnClickOutside,
}: {
  children: ReactNode;
  closeOnClickOutside: boolean;
  onClose: () => void;
  title: string;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [fixed, setFixed] = React.useState(true);
  const [disabled, setDisabled] = React.useState(true);
  const [bounds, setBounds] = React.useState({
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
  });
  useEffect(() => {
    if (modalRef.current !== null) {
      modalRef.current.focus();
    }
  }, []);
  const onStart = React.useCallback(
    (event: DraggableEvent, uiData: DraggableData) => {
      const {clientWidth, clientHeight} = window.document.documentElement;
      const targetRect = modalRef.current?.getBoundingClientRect();
      if (!targetRect) {
        return;
      }
      setBounds({
        bottom: clientHeight - (targetRect.bottom - uiData.y),
        left: -targetRect.left + uiData.x,
        right: clientWidth - (targetRect.right - uiData.x),
        top: -targetRect.top + uiData.y,
      });
    },
    [],
  );
  useEffect(() => {
    let modalOverlayElement: HTMLElement | null = null;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    const clickOutsideHandler = (event: MouseEvent) => {
      const target = event.target;
      if (
        modalRef.current !== null &&
        isDOMNode(target) &&
        !modalRef.current.contains(target) &&
        closeOnClickOutside
      ) {
        onClose();
      }
    };
    const modelElement = modalRef.current;
    if (modelElement !== null) {
      modalOverlayElement = modelElement.parentElement;
      if (modalOverlayElement !== null) {
        modalOverlayElement.addEventListener('click', clickOutsideHandler);
      }
    }

    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
      if (modalOverlayElement !== null) {
        modalOverlayElement?.removeEventListener('click', clickOutsideHandler);
      }
    };
  }, [closeOnClickOutside, onClose]);

  const onDialog = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const target = e.target;
    if (
      target instanceof HTMLDivElement &&
      target.getAttribute('data-modal-root') &&
      !fixed
    ) {
      onClose();
    }
  };

  return (
    <div
      className={Styles.Modal__overlay}
      data-modal-root={true}
      role="presentation"
      onClick={onDialog}>
      <Draggable bounds={bounds} disabled={disabled} onStart={onStart}>
        <div className={Styles.Modal__modal} tabIndex={-1} ref={modalRef}>
          <div
            className={Styles.Modal__titleBox}
            onMouseEnter={() => {
              if (disabled) {
                setDisabled(false);
              }
            }}
            onMouseLeave={() => {
              setDisabled(true);
            }}>
            {' '}
            <span className={Styles.Modal__title}>{title}</span>
            <button
              className={Styles.Modal__closeButton}
              aria-label="Close modal"
              type="button"
              onClick={onClose}>
              <svg
                fill-rule="evenodd"
                viewBox="64 64 896 896"
                focusable="false"
                data-icon="close"
                width="1em"
                height="1em"
                fill="currentColor"
                aria-hidden="true">
                <path d="M799.86 166.31c.02 0 .04.02.08.06l57.69 57.7c.04.03.05.05.06.08a.12.12 0 010 .06c0 .03-.02.05-.06.09L569.93 512l287.7 287.7c.04.04.05.06.06.09a.12.12 0 010 .07c0 .02-.02.04-.06.08l-57.7 57.69c-.03.04-.05.05-.07.06a.12.12 0 01-.07 0c-.03 0-.05-.02-.09-.06L512 569.93l-287.7 287.7c-.04.04-.06.05-.09.06a.12.12 0 01-.07 0c-.02 0-.04-.02-.08-.06l-57.69-57.7c-.04-.03-.05-.05-.06-.07a.12.12 0 010-.07c0-.03.02-.05.06-.09L454.07 512l-287.7-287.7c-.04-.04-.05-.06-.06-.09a.12.12 0 010-.07c0-.02.02-.04.06-.08l57.7-57.69c.03-.04.05-.05.07-.06a.12.12 0 01.07 0c.03 0 .05.02.09.06L512 454.07l287.7-287.7c.04-.04.06-.05.09-.06a.12.12 0 01.07 0z" />
              </svg>
            </button>
          </div>
          <div className={Styles.Modal__contentBox}>
            <div className={Styles.Modal__content}>{children}</div>
          </div>
        </div>
      </Draggable>
    </div>
  );
}

export default function Modal({
  onClose,
  children,
  title,
  closeOnClickOutside = false,
}: {
  children: ReactNode;
  closeOnClickOutside?: boolean;
  onClose: () => void;
  title: string;
}): JSX.Element {
  return createPortal(
    <PortalImpl
      onClose={onClose}
      title={title}
      closeOnClickOutside={closeOnClickOutside}>
      {children}
    </PortalImpl>,
    document.body,
  );
}
