/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {JSX} from 'react';

import {useLexicalComposerContext} from '@lexical/react/LexicalComposerContext';
import {eventFiles} from '@lexical/rich-text';
import {
  $findMatchingParent,
  calculateZoomLevel,
  isHTMLElement,
  mergeRegister,
} from '@lexical/utils';
import {$isInstanceNode} from '@onchain/lexical-instance';
import {dfs} from '@onchain/utility/traversal';
import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  $isRootNode,
  COMMAND_PRIORITY_HIGH,
  COMMAND_PRIORITY_LOW,
  DRAGOVER_COMMAND,
  DROP_COMMAND,
  ElementNode,
  LexicalEditor,
  LexicalNode,
} from 'lexical';
import {
  DragEvent as ReactDragEvent,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {createPortal} from 'react-dom';

import {useLatest} from '../hooks';
import {Point} from './shared/point';
import {Rectangle} from './shared/rect';

const SPACE = 4;
const TARGET_LINE_HALF_HEIGHT = 2;
const DRAG_DATA_FORMAT = 'application/x-lexical-drag-block';
const TEXT_BOX_HORIZONTAL_PADDING = 28;
const BOX_INDENT_INSERT = 60;

const Downward = 1;
const Upward = -1;
const Indeterminate = 0;

let prevIndex = Infinity;

function getCurrentIndex(keysLength: number): number {
  if (keysLength === 0) {
    return Infinity;
  }
  if (prevIndex >= 0 && prevIndex < keysLength) {
    return prevIndex;
  }
  return Math.floor(keysLength / 2);
}

function getTopLevelNodeKeys(editor: LexicalEditor): string[] {
  return editor
    .getEditorState()
    .read(() =>
      dfs($getRoot().getChildren<LexicalNode & ElementNode>(), (node) => {
        if (node.getChildren) {
          return node.getChildren().filter((node) => $isInstanceNode(node));
        }
        return [];
      }),
    )
    .map((node) => {
      return node.getKey();
    });
}

function getCollapsedMargins(elem: HTMLElement): {
  marginTop: number;
  marginBottom: number;
} {
  const getMargin = (
    element: Element | null,
    margin: 'marginTop' | 'marginBottom',
  ): number =>
    element ? parseFloat(window.getComputedStyle(element)[margin]) : 0;

  const {marginTop, marginBottom} = window.getComputedStyle(elem);
  const prevElemSiblingMarginBottom = getMargin(
    elem.previousElementSibling,
    'marginBottom',
  );
  const nextElemSiblingMarginTop = getMargin(
    elem.nextElementSibling,
    'marginTop',
  );
  const collapsedTopMargin = Math.max(
    parseFloat(marginTop),
    prevElemSiblingMarginBottom,
  );
  const collapsedBottomMargin = Math.max(
    parseFloat(marginBottom),
    nextElemSiblingMarginTop,
  );

  return {marginBottom: collapsedBottomMargin, marginTop: collapsedTopMargin};
}

function getBlockElement(
  anchorElem: HTMLElement,
  editor: LexicalEditor,
  event: MouseEvent,
  useEdgeAsDefault = false,
): HTMLElement | null {
  const anchorElementRect = anchorElem.getBoundingClientRect();
  const topLevelNodeKeys = getTopLevelNodeKeys(editor);

  let blockElem: HTMLElement | null = null;

  editor.getEditorState().read(() => {
    if (useEdgeAsDefault) {
      const [firstNode, lastNode] = [
        editor.getElementByKey(topLevelNodeKeys[0]),
        editor.getElementByKey(topLevelNodeKeys[topLevelNodeKeys.length - 1]),
      ];

      const [firstNodeRect, lastNodeRect] = [
        firstNode != null ? firstNode.getBoundingClientRect() : undefined,
        lastNode != null ? lastNode.getBoundingClientRect() : undefined,
      ];

      if (firstNodeRect && lastNodeRect) {
        const firstNodeZoom = calculateZoomLevel(firstNode);
        const lastNodeZoom = calculateZoomLevel(lastNode);
        if (event.y / firstNodeZoom < firstNodeRect.top) {
          blockElem = firstNode;
        } else if (event.y / lastNodeZoom > lastNodeRect.bottom) {
          blockElem = lastNode;
        }

        if (blockElem) {
          return;
        }
      }
    }
    // 直接获取第一个有instance属性的祖先元素 并返回
    if (event.target instanceof Element) {
      blockElem = event.target.closest(`[instance=true]`);
      return blockElem;
    }
    let index = getCurrentIndex(topLevelNodeKeys.length);
    let direction = Indeterminate;
    while (index >= 0 && index < topLevelNodeKeys.length) {
      const key = topLevelNodeKeys[index];
      const elem = editor.getElementByKey(key);
      if (elem === null) {
        break;
      }
      const zoom = calculateZoomLevel(elem);

      const point = new Point(event.x / zoom, event.y / zoom);
      const domRect = Rectangle.fromDOM(elem);
      // console.log({direction, elem, index, zoom, point, domRect}, "elem")
      const {marginTop, marginBottom} = getCollapsedMargins(elem);
      const rect = domRect.generateNewRect({
        bottom: domRect.bottom + marginBottom,
        left: anchorElementRect.left,
        right: anchorElementRect.right,
        top: domRect.top - marginTop,
      });

      const {
        result,
        reason: {isOnTopSide, isOnBottomSide},
      } = rect.contains(point);
      if (result) {
        blockElem = elem;
        prevIndex = index;
        break;
      }
      if (direction === Indeterminate) {
        if (isOnTopSide) {
          direction = Upward;
        } else if (isOnBottomSide) {
          direction = Downward;
        } else {
          // stop search block element
          direction = Infinity;
        }
      }

      index += direction;
    }
  });
  return blockElem;
}

function setMenuPosition(
  targetElem: HTMLElement | null,
  floatingElem: HTMLElement,
  anchorElem: HTMLElement,
) {
  if (!targetElem) {
    floatingElem.style.opacity = '0';
    floatingElem.style.transform = 'translate(-10000px, -10000px)';
    return;
  }

  const targetRect = targetElem.getBoundingClientRect();
  const targetStyle = window.getComputedStyle(targetElem);
  // const floatingElemRect = floatingElem.getBoundingClientRect();
  const anchorElementRect = anchorElem.getBoundingClientRect();

  // top left
  let targetCalculateHeight: number = parseInt(targetStyle.lineHeight, 10);
  if (isNaN(targetCalculateHeight)) {
    // middle
    targetCalculateHeight = targetRect.bottom - targetRect.top;
  }

  // [源码修改]
  // const top =
  //   targetRect.top +
  //   (targetCalculateHeight - floatingElemRect.height) / 2 -
  //   anchorElementRect.top;
  const top = targetRect.top - anchorElementRect.top;

  const left = SPACE;

  floatingElem.style.opacity = '1';
  floatingElem.style.transform = `translate(${left}px, ${top}px)`;
}

function setDragImage(
  dataTransfer: DataTransfer,
  draggableBlockElem: HTMLElement,
) {
  const {transform} = draggableBlockElem.style;

  // Remove dragImage borders
  draggableBlockElem.style.transform = 'translateZ(0)';
  dataTransfer.setDragImage(draggableBlockElem, 0, 0);

  setTimeout(() => {
    draggableBlockElem.style.transform = transform;
  });
}

/** 放置区域是否是自身 */
// function isPlacementAreaElemSelf(
//   targetBlockElem: HTMLElement,
//   latestDraggableBlockElem: React.MutableRefObject<HTMLElement | null>,
// ) {
//   const isTargetSelf = latestDraggableBlockElem.current === targetBlockElem;
//   return isTargetSelf;
// }

/** 放置区域是否是自身的子级 */
function $isPlacementAreaElemSelfRoChild(
  targetBlockElem: HTMLElement,
  latestDraggableBlockElem: React.MutableRefObject<HTMLElement | null>,
  isPlacementDown = true,
) {
  const key = targetBlockElem.getAttribute('key');
  let node = key ? $getNodeByKey<ElementNode>(key) : null;
  if (!isPlacementDown) {
    node = node ? node.getPreviousSibling() : null;
  }
  if (node) {
    return Boolean(
      $findMatchingParent(node, (current) => {
        const draggable = latestDraggableBlockElem.current;
        if (current && draggable) {
          return current.getKey() === draggable.getAttribute('key');
        }
        return false;
      }),
    );
  }
  return false;
}

/** 是否是插入到子节点 */
function isInsertChild(targetBlockMouseX: number) {
  const isIndent = targetBlockMouseX > BOX_INDENT_INSERT;
  return isIndent;
}

/** 是否是放到节点下面 */
function isPlacementAreaDown(mouseY: number, targetBlockElemTop: number) {
  return mouseY >= targetBlockElemTop + 40;
}

/** 获取鼠标位置以及一些基础数据 */
function getMouseInfo({
  target,
  pageY,
  pageX,
  targetBlockElem,
}: {
  target: HTMLElement;
  pageY: number;
  pageX: number;
  targetBlockElem: HTMLElement;
}) {
  const mouseY = pageY / calculateZoomLevel(target);
  const mouseX = pageX / calculateZoomLevel(target);
  const targetBlockElemDOMRect = targetBlockElem.getBoundingClientRect();
  const {left: targetBlockElemLeft} = targetBlockElemDOMRect;
  const targetBlockMouseX = mouseX - targetBlockElemLeft;
  const isAddChild = isInsertChild(targetBlockMouseX);

  return {
    isAddChild,
    mouseX,
    mouseY,
    targetBlockElemDOMRect,
  };
}

function setTargetLine(params: {
  targetLineElem: HTMLElement;
  targetBlockElem: HTMLElement;
  mouseY: number;
  mouseX: number;
  anchorElem: HTMLElement;
  targetLineIndent?: number;
  targetBlockElemDOMRect?: DOMRect;
}) {
  const {
    targetBlockElem,
    targetLineElem,
    mouseY,
    mouseX,
    anchorElem,
    targetLineIndent,
    targetBlockElemDOMRect,
  } = params;
  const {
    top: targetBlockElemTop,
    height: targetBlockElemHeight,
    left: targetBlockElemLeft,
    width: targetBlockElemWidth,
  } = targetBlockElemDOMRect || targetBlockElem.getBoundingClientRect();
  const {top: anchorTop} = anchorElem.getBoundingClientRect();
  const {marginTop, marginBottom} = getCollapsedMargins(targetBlockElem);
  let lineTop = targetBlockElemTop;
  if (isPlacementAreaDown(mouseY, targetBlockElemTop)) {
    lineTop += targetBlockElemHeight + marginBottom / 2;
  } else {
    lineTop -= marginTop / 2;
  }
  const targetBlockMouseX = mouseX - targetBlockElemLeft;
  const top = lineTop - anchorTop - TARGET_LINE_HALF_HEIGHT;

  const lineIndent = targetLineIndent || TEXT_BOX_HORIZONTAL_PADDING;
  const isAddChild = isInsertChild(targetBlockMouseX);
  const left = isAddChild ? BOX_INDENT_INSERT + lineIndent : lineIndent;

  targetLineElem.style.transform = `translate(${left}px, ${top}px)`;
  targetLineElem.style.backgroundColor = isAddChild ? 'purple' : 'deepskyblue';
  targetLineElem.style.width = `${
    targetBlockElemWidth - (isAddChild ? BOX_INDENT_INSERT : 0)
  }px`;
  targetLineElem.style.opacity = '.4';
}

function hideTargetLine(targetLineElem: HTMLElement | null) {
  if (targetLineElem) {
    targetLineElem.style.opacity = '0';
    targetLineElem.style.transform = 'translate(-10000px, -10000px)';
  }
}

function useDraggableBlockMenu(
  editor: LexicalEditor,
  anchorElem: HTMLElement,
  menuRef: React.RefObject<HTMLElement>,
  targetLineRef: React.RefObject<HTMLElement>,
  isEditable: boolean,
  menuComponent: ReactNode,
  targetLineComponent: ReactNode,
  isOnMenu: (element: HTMLElement) => boolean,
  targetLineIndent?: number,
  onElementChanged?: (element: HTMLElement | null) => void,
): JSX.Element {
  const scrollerElem = anchorElem.parentElement;

  const isDraggingBlockRef = useRef<boolean>(false);
  const [draggableBlockElem, setDraggableBlockElemState] =
    useState<HTMLElement | null>(null);
  const latestDraggableBlockElem = useLatest(draggableBlockElem);
  const setDraggableBlockElem = useCallback(
    (elem: HTMLElement | null) => {
      setDraggableBlockElemState(elem);
      if (onElementChanged) {
        onElementChanged(elem);
      }
    },
    [onElementChanged],
  );

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      const target = event.target;
      if (!isHTMLElement(target)) {
        setDraggableBlockElem(null);
        return;
      }

      if (isOnMenu(target as HTMLElement)) {
        return;
      }

      const _draggableBlockElem = getBlockElement(anchorElem, editor, event);

      setDraggableBlockElem(_draggableBlockElem);
    }

    function onMouseLeave() {
      setDraggableBlockElem(null);
    }

    if (scrollerElem != null) {
      scrollerElem.addEventListener('mousemove', onMouseMove);
      scrollerElem.addEventListener('mouseleave', onMouseLeave);
    }

    return () => {
      if (scrollerElem != null) {
        scrollerElem.removeEventListener('mousemove', onMouseMove);
        scrollerElem.removeEventListener('mouseleave', onMouseLeave);
      }
    };
  }, [scrollerElem, anchorElem, editor, isOnMenu, setDraggableBlockElem]);

  useEffect(() => {
    if (menuRef.current) {
      // 更新操作栏区域
      setMenuPosition(draggableBlockElem, menuRef.current, anchorElem);
    }
  }, [anchorElem, draggableBlockElem, menuRef]);

  useEffect(() => {
    // 拖动
    function $onDragover(event: DragEvent): boolean {
      if (!isDraggingBlockRef.current) {
        return false;
      }
      const [isFileTransfer] = eventFiles(event);
      if (isFileTransfer) {
        return false;
      }
      const {pageY, pageX, target} = event;
      if (!isHTMLElement(target)) {
        return false;
      }
      const targetBlockElem = getBlockElement(anchorElem, editor, event, true);
      const targetLineElem = targetLineRef.current;
      if (targetBlockElem === null || targetLineElem === null) {
        return false;
      }
      const {mouseY, mouseX, isAddChild, targetBlockElemDOMRect} = getMouseInfo(
        {pageX, pageY, target, targetBlockElem},
      );
      const isPlacementDown = isPlacementAreaDown(
        mouseY,
        targetBlockElemDOMRect.top,
      );

      const isPlacementSelfRoChild = $isPlacementAreaElemSelfRoChild(
        targetBlockElem,
        latestDraggableBlockElem,
        isPlacementDown,
      );
      if (isPlacementSelfRoChild) {
        if (isAddChild) {
          hideTargetLine(targetLineElem);
          return false;
        }
        const key = targetBlockElem.getAttribute('key');
        const targetNode = key ? $getNodeByKey(key) : null;
        if (!targetNode || !$isRootNode(targetNode.getParent())) {
          hideTargetLine(targetLineElem);
          return false;
        }
      }
      setTargetLine({
        anchorElem,
        mouseX,
        mouseY,
        targetBlockElem,
        targetBlockElemDOMRect,
        targetLineElem,
        targetLineIndent,
      });
      // Prevent default event to be able to trigger onDrop events
      event.preventDefault();
      return true;
    }

    // 放下
    function $onDrop(event: DragEvent): boolean {
      if (!isDraggingBlockRef.current) {
        return false;
      }
      const [isFileTransfer] = eventFiles(event);
      if (isFileTransfer) {
        return false;
      }
      const {target, dataTransfer, pageY, pageX} = event;
      const dragData =
        dataTransfer != null ? dataTransfer.getData(DRAG_DATA_FORMAT) : '';
      const draggedNode = $getNodeByKey(dragData);
      if (!draggedNode) {
        return false;
      }
      if (!isHTMLElement(target)) {
        return false;
      }
      const targetBlockElem = getBlockElement(anchorElem, editor, event, true);
      if (!targetBlockElem) {
        return false;
      }
      const targetNode = $getNearestNodeFromDOMNode(targetBlockElem);
      if (!targetNode) {
        return false;
      }
      const {
        mouseY,
        isAddChild,
        targetBlockElemDOMRect: {top: targetBlockElemTop},
      } = getMouseInfo({pageX, pageY, target, targetBlockElem});
      if (targetNode === draggedNode && !isAddChild) {
        return true;
      }
      if (isPlacementAreaDown(mouseY, targetBlockElemTop)) {
        if (isAddChild && $isElementNode(targetNode)) {
          targetNode.append(draggedNode);
        } else {
          targetNode.insertAfter(draggedNode);
        }
      } else {
        if (isAddChild && $isElementNode(targetNode)) {
          const previous = targetNode.getPreviousSibling();
          if ($isElementNode(previous)) {
            previous.append(draggedNode);
          }
        } else {
          targetNode.insertBefore(draggedNode);
        }
      }
      draggedNode.selectEnd();
      setDraggableBlockElem(null);

      return true;
    }

    // 添加拖拽事件
    return mergeRegister(
      editor.registerCommand(
        DRAGOVER_COMMAND,
        (event) => {
          const result = $onDragover(event);
          if (!result) {
            if (event.dataTransfer) {
              event.dataTransfer.dropEffect = 'none';
            }
          }
          return result;
        },
        COMMAND_PRIORITY_LOW,
      ),
      editor.registerCommand(
        DROP_COMMAND,
        (event) => {
          return $onDrop(event);
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [
    anchorElem,
    editor,
    targetLineRef,
    setDraggableBlockElem,
    targetLineIndent,
    latestDraggableBlockElem,
  ]);

  function onDragStart(event: ReactDragEvent<HTMLDivElement>): void {
    const dataTransfer = event.dataTransfer;
    if (!dataTransfer || !draggableBlockElem) {
      return;
    }
    setDragImage(dataTransfer, draggableBlockElem);
    let nodeKey = '';
    editor.update(() => {
      const node = $getNearestNodeFromDOMNode(draggableBlockElem);
      if (node) {
        nodeKey = node.getKey();
      }
    });
    isDraggingBlockRef.current = true;
    dataTransfer.setData(DRAG_DATA_FORMAT, nodeKey);
  }

  function onDragEnd(): void {
    isDraggingBlockRef.current = false;
    hideTargetLine(targetLineRef.current);
  }
  return createPortal(
    <>
      <div draggable={true} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        {isEditable && menuComponent}
      </div>
      {targetLineComponent}
    </>,
    anchorElem,
  );
}

export function DraggableBlockPlugin_EXPERIMENTAL({
  anchorElem = document.body,
  menuRef,
  targetLineRef,
  menuComponent,
  targetLineComponent,
  targetLineIndent,
  isOnMenu,
  onElementChanged,
}: {
  anchorElem?: HTMLElement;
  menuRef: React.RefObject<HTMLElement>;
  targetLineRef: React.RefObject<HTMLElement>;
  menuComponent: ReactNode;
  targetLineComponent: ReactNode;
  isOnMenu: (element: HTMLElement) => boolean;
  /** default 46 */
  targetLineIndent?: number;
  onElementChanged?: (element: HTMLElement | null) => void;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();
  return useDraggableBlockMenu(
    editor,
    anchorElem,
    menuRef,
    targetLineRef,
    editor._editable,
    menuComponent,
    targetLineComponent,
    isOnMenu,
    targetLineIndent,
    onElementChanged,
  );
}
