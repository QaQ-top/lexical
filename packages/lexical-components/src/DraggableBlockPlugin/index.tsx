/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type {JSX} from 'react';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {$createInstanceNode} from '@onchain/lexical-instance';
// import {DraggableBlockPlugin_EXPERIMENTAL} from '@lexical/react/LexicalDraggableBlockPlugin';
import {$getNearestNodeFromDOMNode} from 'lexical';
import {useRef, useState} from 'react';

import {DraggableBlockPlugin_EXPERIMENTAL} from './draggableBlockPlugin';
import Styles from './index.module.less';

const DRAGGABLE_BLOCK_MENU_CLASSNAME = Styles['draggable-block-menu'];

function isOnMenu(element: HTMLElement): boolean {
  return !!element.closest(`.${DRAGGABLE_BLOCK_MENU_CLASSNAME}`);
}

export default function DraggableBlockPlugin({
  anchorElem = document.body,
  dragIcon,
  targetLineIndent,
}: {
  anchorElem?: HTMLElement;
  targetLineIndent?: number;
  dragIcon?: React.ReactNode;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const menuRef = useRef<HTMLDivElement>(null);
  const targetLineRef = useRef<HTMLDivElement>(null);
  const [draggableElement, setDraggableElement] = useState<HTMLElement | null>(
    null,
  );

  function insertBlock(e: React.MouseEvent) {
    if (!draggableElement || !editor) {
      return;
    }

    editor.update(() => {
      const node = $getNearestNodeFromDOMNode(draggableElement);
      if (!node) {
        return;
      }

      const pNode = $createInstanceNode();
      if (e.altKey || e.ctrlKey) {
        node.insertBefore(pNode);
      } else {
        node.insertAfter(pNode);
      }
      pNode.select();
    });
  }

  return (
    <DraggableBlockPlugin_EXPERIMENTAL
      anchorElem={anchorElem}
      menuRef={menuRef}
      targetLineRef={targetLineRef}
      menuComponent={
        <div
          ref={menuRef}
          className={`${Styles.icon} ${Styles['draggable-block-menu']}`}>
          <button
            title="Click to add below"
            className={`${Styles.icon} ${Styles['icon-plus']}`}
            onClick={insertBlock}
            style={{display: 'none'}}
          />
          <div className={Styles.icon}>{dragIcon}</div>
        </div>
      }
      targetLineComponent={
        <div
          ref={targetLineRef}
          className={`${Styles['draggable-block-target-line']}`}
        />
      }
      targetLineIndent={targetLineIndent}
      isOnMenu={isOnMenu}
      onElementChanged={setDraggableElement}
    />
  );
}
