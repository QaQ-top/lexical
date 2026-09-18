/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type {JSX} from 'react';

import {
  $isCodeNode,
  CODE_LANGUAGE_FRIENDLY_NAME_MAP,
  CODE_LANGUAGE_MAP,
  getLanguageFriendlyName,
} from '@lexical/code';
import {$isLinkNode, TOGGLE_LINK_COMMAND} from '@lexical/link';
import {$isListNode, ListNode} from '@lexical/list';
import {$isHeadingNode} from '@lexical/rich-text';
import {
  $getSelectionStyleValueForProperty,
  $isParentElementRTL,
  $patchStyleText,
} from '@lexical/selection';
import {$isTableNode, $isTableSelection} from '@lexical/table';
import {
  $findMatchingParent,
  $getNearestNodeOfType,
  $isEditorIsNestedEditor,
  IS_APPLE,
  mergeRegister,
} from '@lexical/utils';
import {
  $getNodeByKey,
  // $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  ElementFormatType,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  HISTORIC_TAG,
  INDENT_CONTENT_COMMAND,
  LexicalEditor,
  NodeKey,
  OUTDENT_CONTENT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
} from 'lexical';
import {
  blockTypeToBlockName,
  useToolbarState,
} from 'onchain-lexical-context/toolBar';
import {
  $getAnchorRootNode,
  INSERT_INS_HORIZONTAL_RULE_COMMAND,
} from 'onchain-lexical-instance';
import DropDown, {DropDownItem} from 'onchain-lexical-ui/DropDown';
import DropdownColorPicker from 'onchain-lexical-ui/DropdownColorPicker';
import {translateI18n} from 'onchain-utility/language';
import React, {
  Dispatch,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import useContentEditable from '../../hooks/useContentEditable';
import useModal from '../../hooks/useModal';
import {$createStickyNode} from '../../nodes/StickyNode';
import {getSelectedNode} from '../../utils/getSelectedNode';
import {sanitizeUrl} from '../../utils/url';
import {EmbedConfigs} from '../AutoEmbedPlugin';
import {INSERT_BASE_EMBED_COMMAND} from '../AutoEmbedPlugin/BaseAutoEmbedPlugin';
import {INSERT_COLLAPSIBLE_COMMAND} from '../CollapsiblePlugin';
import {InsertEquationDialog} from '../EquationsPlugin';
import {INSERT_EXCALIDRAW_COMMAND} from '../ExcalidrawPlugin';
import {
  INSERT_IMAGE_COMMAND,
  InsertImageDialog,
  InsertImagePayload,
} from '../ImagesPlugin';
import {InsertInlineImageDialog} from '../InlineImagePlugin';
import InsertLayoutDialog from '../LayoutPlugin/InsertLayoutDialog';
import {INSERT_PAGE_BREAK} from '../PageBreakPlugin';
import {InsertPollDialog} from '../PollPlugin';
import ScrollBarAssembly from '../ScrollBarAssembly';
import {SHORTCUTS} from '../ShortcutsPlugin/shortcuts';
import {InsertTableDialog} from '../TablePlugin';
import FontSize from './fontSize';
import Styles from './index.module.less';
import {
  clearFormatting,
  formatBulletList,
  formatCheckList,
  formatCode,
  formatHeading,
  formatNumberedList,
  formatParagraph,
  formatQuote,
} from './utils';

const rootTypeToRootName = {
  root: 'Root',
  table: 'Table',
};

function getCodeLanguageOptions(): [string, string][] {
  const options: [string, string][] = [];

  for (const [lang, friendlyName] of Object.entries(
    CODE_LANGUAGE_FRIENDLY_NAME_MAP,
  )) {
    options.push([lang, friendlyName]);
  }

  return options;
}

const CODE_LANGUAGE_OPTIONS = getCodeLanguageOptions();

const FONT_FAMILY_OPTIONS: [string, string][] = [
  ['Arial', 'Arial'],
  ['Courier New', 'Courier New'],
  ['Georgia', 'Georgia'],
  ['Times New Roman', 'Times New Roman'],
  ['Trebuchet MS', 'Trebuchet MS'],
  ['Verdana', 'Verdana'],
];

const FONT_SIZE_OPTIONS: [string, string][] = [
  ['10px', '10px'],
  ['11px', '11px'],
  ['12px', '12px'],
  ['13px', '13px'],
  ['14px', '14px'],
  ['15px', '15px'],
  ['16px', '16px'],
  ['17px', '17px'],
  ['18px', '18px'],
  ['19px', '19px'],
  ['20px', '20px'],
];

const ELEMENT_FORMAT_OPTIONS: {
  [key in Exclude<ElementFormatType, ''>]: {
    icon: string;
    iconRTL: string;
    name: string;
  };
} = {
  center: {
    icon: 'center-align',
    iconRTL: 'center-align',
    name: translateI18n('[TODO] 国际化 Center Align', {
      placeholder: '居中对齐',
    }),
  },
  end: {
    icon: 'right-align',
    iconRTL: 'left-align',
    name: translateI18n('[TODO] 国际化 End Align', {placeholder: '尾部对齐'}),
  },
  justify: {
    icon: 'justify-align',
    iconRTL: 'justify-align',
    name: translateI18n('[TODO] 国际化 Justify Align', {
      placeholder: '两端对齐',
    }),
  },
  left: {
    icon: 'left-align',
    iconRTL: 'left-align',
    name: translateI18n('[TODO] 国际化 Left Align', {
      placeholder: '左对齐',
    }),
  },
  right: {
    icon: 'right-align',
    iconRTL: 'right-align',
    name: translateI18n('[TODO] 国际化 Right Align', {
      placeholder: '右对齐',
    }),
  },
  start: {
    icon: 'left-align',
    iconRTL: 'right-align',
    name: translateI18n('[TODO] 国际化 Start Align', {
      placeholder: '头部对齐',
    }),
  },
};

function dropDownActiveClass(active: boolean) {
  if (active) {
    return 'active dropdown-item-active';
  } else {
    return '';
  }
}

const BlockFormatDropDown = React.memo(function ({
  editor,
  blockType,
  rootType,
  disabled = false,
}: {
  blockType: keyof typeof blockTypeToBlockName;
  rootType: keyof typeof rootTypeToRootName;
  editor: LexicalEditor;
  disabled?: boolean;
}): JSX.Element {
  return (
    <DropDown
      disabled={disabled}
      buttonClassName="toolbar-item block-controls"
      buttonIconClassName={'icon block-type ' + blockType.toLowerCase()}
      buttonLabel={blockTypeToBlockName[blockType]}
      buttonAriaLabel="Formatting options for text style">
      <DropDownItem
        className={
          'item wide ' +
          dropDownActiveClass(['paragraph', 'Paragraph'].includes(blockType))
        }
        onClick={() => formatParagraph(editor)}>
        <div className="icon-text-container">
          <i className="icon paragraph" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Normal', {placeholder: '正文'})}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.NORMAL}</span>
      </DropDownItem>
      <DropDownItem
        className={'item wide ' + dropDownActiveClass(blockType === 'h1')}
        onClick={() => formatHeading(editor, blockType, 'h1')}>
        <div className="icon-text-container">
          <i className="icon h1" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Heading 1', {placeholder: '标题1'})}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.HEADING1}</span>
      </DropDownItem>
      <DropDownItem
        className={'item wide ' + dropDownActiveClass(blockType === 'h2')}
        onClick={() => formatHeading(editor, blockType, 'h2')}>
        <div className="icon-text-container">
          <i className="icon h2" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Heading 2', {placeholder: '标题2'})}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.HEADING2}</span>
      </DropDownItem>
      <DropDownItem
        className={'item wide ' + dropDownActiveClass(blockType === 'h3')}
        onClick={() => formatHeading(editor, blockType, 'h3')}>
        <div className="icon-text-container">
          <i className="icon h3" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Heading 3', {placeholder: '标题3'})}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.HEADING3}</span>
      </DropDownItem>
      <DropDownItem
        className={'item wide ' + dropDownActiveClass(blockType === 'bullet')}
        onClick={() => formatBulletList(editor, blockType)}>
        <div className="icon-text-container">
          <i className="icon bullet-list" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Bullet List', {
              placeholder: '无序列表',
            })}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.BULLET_LIST}</span>
      </DropDownItem>
      <DropDownItem
        className={'item wide ' + dropDownActiveClass(blockType === 'number')}
        onClick={() => formatNumberedList(editor, blockType)}>
        <div className="icon-text-container">
          <i className="icon numbered-list" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Numbered List', {
              placeholder: '有序列表',
            })}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.NUMBERED_LIST}</span>
      </DropDownItem>
      <DropDownItem
        className={'item wide ' + dropDownActiveClass(blockType === 'check')}
        onClick={() => formatCheckList(editor, blockType)}>
        <div className="icon-text-container">
          <i className="icon check-list" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Check List', {
              placeholder: '待办列表',
            })}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.CHECK_LIST}</span>
      </DropDownItem>
      <DropDownItem
        className={
          'item wide ' +
          dropDownActiveClass(['quote', 'Quote'].includes(blockType))
        }
        onClick={() => formatQuote(editor, blockType)}>
        <div className="icon-text-container">
          <i className="icon quote" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Quote', {placeholder: '引用'})}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.QUOTE}</span>
      </DropDownItem>
      <DropDownItem
        className={'item wide ' + dropDownActiveClass(blockType === 'code')}
        onClick={() => formatCode(editor, blockType)}>
        <div className="icon-text-container">
          <i className="icon code" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Code Block', {placeholder: '代码块'})}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.CODE_BLOCK}</span>
      </DropDownItem>
    </DropDown>
  );
});

function Divider(): JSX.Element {
  return <div className="divider" />;
}

const FontDropDown = React.memo(function ({
  editor,
  value,
  style,
  disabled = false,
}: {
  editor: LexicalEditor;
  value: string;
  style: string;
  disabled?: boolean;
}): JSX.Element {
  const handleClick = useCallback(
    (option: string) => {
      editor.update(() => {
        const selection = $getSelection();
        if (selection !== null) {
          $patchStyleText(selection, {
            [style]: option,
          });
        }
      });
    },
    [editor, style],
  );

  const buttonAriaLabel =
    style === 'font-family'
      ? 'Formatting options for font family'
      : 'Formatting options for font size';

  return (
    <DropDown
      disabled={disabled}
      buttonClassName={'toolbar-item ' + style}
      buttonLabel={value}
      buttonIconClassName={
        style === 'font-family' ? 'icon block-type font-family' : ''
      }
      buttonAriaLabel={buttonAriaLabel}>
      {(style === 'font-family' ? FONT_FAMILY_OPTIONS : FONT_SIZE_OPTIONS).map(
        ([option, text]) => (
          <DropDownItem
            className={`item ${dropDownActiveClass(value === option)} ${
              style === 'font-size' ? 'fontsize-item' : ''
            }`}
            onClick={() => handleClick(option)}
            key={option}>
            <span className="text">{text}</span>
          </DropDownItem>
        ),
      )}
    </DropDown>
  );
});

const ElementFormatDropdown = React.memo(function ({
  editor,
  value,
  isRTL,
  disabled = false,
}: {
  editor: LexicalEditor;
  value: ElementFormatType;
  isRTL: boolean;
  disabled: boolean;
}) {
  const formatOption = ELEMENT_FORMAT_OPTIONS[value || 'left'];

  return (
    <DropDown
      disabled={disabled}
      buttonLabel={formatOption.name}
      buttonIconClassName={`icon ${
        isRTL ? formatOption.iconRTL : formatOption.icon
      }`}
      buttonClassName="toolbar-item spaced alignment"
      buttonAriaLabel="Formatting options for text alignment">
      <DropDownItem
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'left');
        }}
        className="item wide">
        <div className="icon-text-container">
          <i className="icon left-align" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Left Align', {
              placeholder: '左对齐',
            })}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.LEFT_ALIGN}</span>
      </DropDownItem>
      <DropDownItem
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'center');
        }}
        className="item wide">
        <div className="icon-text-container">
          <i className="icon center-align" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Center Align', {
              placeholder: '居中对齐',
            })}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.CENTER_ALIGN}</span>
      </DropDownItem>
      <DropDownItem
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'right');
        }}
        className="item wide">
        <div className="icon-text-container">
          <i className="icon right-align" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Right Align', {
              placeholder: '右对齐',
            })}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.RIGHT_ALIGN}</span>
      </DropDownItem>
      <DropDownItem
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'justify');
        }}
        className="item wide">
        <div className="icon-text-container">
          <i className="icon justify-align" />
          <span className="text">
            {translateI18n('[TODO] 国际化 Justify Align', {
              placeholder: '两端对齐',
            })}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.JUSTIFY_ALIGN}</span>
      </DropDownItem>
      <DropDownItem
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'start');
        }}
        className="item wide">
        <i
          className={`icon ${
            isRTL
              ? ELEMENT_FORMAT_OPTIONS.start.iconRTL
              : ELEMENT_FORMAT_OPTIONS.start.icon
          }`}
        />
        <span className="text">
          {translateI18n('[TODO] 国际化 Start Align', {
            placeholder: '头部对齐',
          })}
        </span>
      </DropDownItem>
      <DropDownItem
        onClick={() => {
          editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, 'end');
        }}
        className="item wide">
        <i
          className={`icon ${
            isRTL
              ? ELEMENT_FORMAT_OPTIONS.end.iconRTL
              : ELEMENT_FORMAT_OPTIONS.end.icon
          }`}
        />
        <span className="text">
          {translateI18n('[TODO] 国际化 End Align', {
            placeholder: '尾部对齐',
          })}
        </span>
      </DropDownItem>
      <Divider />
      <DropDownItem
        onClick={() => {
          editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
        }}
        className="item wide">
        <div className="icon-text-container">
          <i className={'icon ' + (isRTL ? 'outdent' : 'indent')} />
          <span className="text">
            {translateI18n('[TODO] 国际化 Indent', {
              placeholder: '缩进',
            })}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.INDENT}</span>
      </DropDownItem>
      <DropDownItem
        onClick={() => {
          editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
        }}
        className="item wide">
        <div className="icon-text-container">
          <i className={'icon ' + (isRTL ? 'indent' : 'outdent')} />
          <span className="text">
            {translateI18n('[TODO] 国际化 Outdent', {
              placeholder: '取消缩进',
            })}
          </span>
        </div>
        <span className="shortcut">{SHORTCUTS.OUTDENT}</span>
      </DropDownItem>
    </DropDown>
  );
});

export default React.memo(function ToolbarPlugin({
  editor,
  activeEditor,
  setActiveEditor,
  setIsLinkEditMode,
}: {
  editor: LexicalEditor;
  activeEditor: LexicalEditor;
  setActiveEditor: Dispatch<LexicalEditor>;
  setIsLinkEditMode: Dispatch<boolean>;
}): JSX.Element {
  const [selectedElementKey, setSelectedElementKey] = useState<NodeKey | null>(
    null,
  );
  const [modal, showModal] = useModal();
  const [isGlobalEditable, setIsGlobalEditable] = useState(() =>
    editor.isEditable(),
  );
  const {toolbarState, updateToolbarState} = useToolbarState();
  const {contentEditable} = useContentEditable();

  const isEditable = useMemo(() => {
    return contentEditable && isGlobalEditable;
  }, [isGlobalEditable, contentEditable]);

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      if (activeEditor !== editor && $isEditorIsNestedEditor(activeEditor)) {
        const rootElement = activeEditor.getRootElement();
        updateToolbarState(
          'isImageCaption',
          !!rootElement?.parentElement?.classList.contains(
            'image-caption-container',
          ),
        );
      } else {
        updateToolbarState('isImageCaption', false);
      }

      const anchorNode = selection.anchor.getNode();
      // 以修改为指定锚点以兼容InstanceNode
      let element = $getAnchorRootNode(anchorNode);
      if (element === null) {
        element = anchorNode.getTopLevelElementOrThrow();
      }

      const elementKey = element.getKey();
      const elementDOM = activeEditor.getElementByKey(elementKey);

      updateToolbarState('isRTL', $isParentElementRTL(selection));

      // Update links
      const node = getSelectedNode(selection);
      const parent = node.getParent();
      const isLink = $isLinkNode(parent) || $isLinkNode(node);
      updateToolbarState('isLink', isLink);

      const tableNode = $findMatchingParent(node, $isTableNode);
      if ($isTableNode(tableNode)) {
        updateToolbarState('rootType', 'table');
      } else {
        updateToolbarState('rootType', 'root');
      }

      if (elementDOM !== null) {
        setSelectedElementKey(elementKey);
        if ($isListNode(element)) {
          const parentList = $getNearestNodeOfType<ListNode>(
            anchorNode,
            ListNode,
          );
          const type = parentList
            ? parentList.getListType()
            : element.getListType();

          updateToolbarState('blockType', type);
        } else {
          const type = $isHeadingNode(element)
            ? element.getTag()
            : element.getType();
          if (type in blockTypeToBlockName) {
            updateToolbarState(
              'blockType',
              type as keyof typeof blockTypeToBlockName,
            );
          }
          if ($isCodeNode(element)) {
            const language =
              element.getLanguage() as keyof typeof CODE_LANGUAGE_MAP;
            updateToolbarState(
              'codeLanguage',
              language ? CODE_LANGUAGE_MAP[language] || language : '',
            );
            return;
          }
        }
      }
      // Handle buttons
      updateToolbarState(
        'fontColor',
        $getSelectionStyleValueForProperty(selection, 'color', '#000'),
      );
      updateToolbarState(
        'bgColor',
        $getSelectionStyleValueForProperty(
          selection,
          'background-color',
          '#fff',
        ),
      );
      updateToolbarState(
        'fontFamily',
        $getSelectionStyleValueForProperty(selection, 'font-family', 'Arial'),
      );
      let matchingParent;
      if ($isLinkNode(parent)) {
        // If node is a link, we need to fetch the parent paragraph node to set format
        matchingParent = $findMatchingParent(
          node,
          (parentNode) => $isElementNode(parentNode) && !parentNode.isInline(),
        );
      }

      // If matchingParent is a valid node, pass it's format type
      updateToolbarState(
        'elementFormat',
        $isElementNode(matchingParent)
          ? matchingParent.getFormatType()
          : $isElementNode(node)
          ? node.getFormatType()
          : parent?.getFormatType() || 'left',
      );
    }
    if ($isRangeSelection(selection) || $isTableSelection(selection)) {
      // Update text format
      updateToolbarState('isBold', selection.hasFormat('bold'));
      updateToolbarState('isItalic', selection.hasFormat('italic'));
      updateToolbarState('isUnderline', selection.hasFormat('underline'));
      updateToolbarState(
        'isStrikethrough',
        selection.hasFormat('strikethrough'),
      );
      updateToolbarState('isSubscript', selection.hasFormat('subscript'));
      updateToolbarState('isSuperscript', selection.hasFormat('superscript'));
      updateToolbarState('isHighlight', selection.hasFormat('highlight'));
      updateToolbarState('isCode', selection.hasFormat('code'));
      updateToolbarState(
        'fontSize',
        $getSelectionStyleValueForProperty(selection, 'font-size', '12px'),
      );
      updateToolbarState('isLowercase', selection.hasFormat('lowercase'));
      updateToolbarState('isUppercase', selection.hasFormat('uppercase'));
      updateToolbarState('isCapitalize', selection.hasFormat('capitalize'));
    }
  }, [activeEditor, editor, updateToolbarState]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      (_payload, newEditor) => {
        setActiveEditor(newEditor);
        $updateToolbar();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL,
    );
  }, [editor, $updateToolbar, setActiveEditor]);

  useEffect(() => {
    activeEditor.getEditorState().read(() => {
      $updateToolbar();
    });
  }, [activeEditor, $updateToolbar]);

  useEffect(() => {
    return mergeRegister(
      editor.registerEditableListener((editable) => {
        setIsGlobalEditable(editable);
      }),
      activeEditor.registerUpdateListener(({editorState}) => {
        editorState.read(() => {
          $updateToolbar();
        });
      }),
      activeEditor.registerCommand<boolean>(
        CAN_UNDO_COMMAND,
        (payload) => {
          updateToolbarState('canUndo', payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      activeEditor.registerCommand<boolean>(
        CAN_REDO_COMMAND,
        (payload) => {
          updateToolbarState('canRedo', payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
  }, [$updateToolbar, activeEditor, editor, updateToolbarState]);

  const applyStyleText = useCallback(
    (styles: Record<string, string>, skipHistoryStack?: boolean) => {
      activeEditor.update(
        () => {
          const selection = $getSelection();
          if (selection !== null) {
            $patchStyleText(selection, styles);
          }
        },
        skipHistoryStack ? {tag: HISTORIC_TAG} : {},
      );
    },
    [activeEditor],
  );

  const onFontColorSelect = useCallback(
    (value: string, skipHistoryStack: boolean) => {
      applyStyleText({color: value}, skipHistoryStack);
    },
    [applyStyleText],
  );

  const onBgColorSelect = useCallback(
    (value: string, skipHistoryStack: boolean) => {
      applyStyleText({'background-color': value}, skipHistoryStack);
    },
    [applyStyleText],
  );

  const insertLink = useCallback(() => {
    if (!toolbarState.isLink) {
      setIsLinkEditMode(true);
      activeEditor.dispatchCommand(
        TOGGLE_LINK_COMMAND,
        sanitizeUrl('https://'),
      );
    } else {
      setIsLinkEditMode(false);
      activeEditor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  }, [activeEditor, setIsLinkEditMode, toolbarState.isLink]);

  const onCodeLanguageSelect = useCallback(
    (value: string) => {
      activeEditor.update(() => {
        if (selectedElementKey !== null) {
          const node = $getNodeByKey(selectedElementKey);
          if ($isCodeNode(node)) {
            node.setLanguage(value);
          }
        }
      });
    },
    [activeEditor, selectedElementKey],
  );
  // const insertGifOnClick = (payload: InsertImagePayload) => {
  //   activeEditor.dispatchCommand(INSERT_IMAGE_COMMAND, payload);
  // };

  const canViewerSeeInsertDropdown = !toolbarState.isImageCaption;
  const canViewerSeeInsertCodeButton = !toolbarState.isImageCaption;

  // useEffect(() => {
  //   console.log(toolbarState.blockType, "blockType")
  // }, [toolbarState.blockType])

  return (
    <div className={Styles.bar}>
      <ScrollBarAssembly className={Styles.toolbar}>
        <button
          disabled={!toolbarState.canUndo || !isGlobalEditable}
          onClick={() => {
            activeEditor.dispatchCommand(UNDO_COMMAND, undefined);
          }}
          title={translateI18n('[TODO] Undo ({sk})', {
            placeholder: '上一步({sk})',
            variate: {sk: IS_APPLE ? '(⌘Z)' : '(Ctrl+Z)'},
          })}
          type="button"
          className="toolbar-item spaced"
          aria-label="Undo">
          <i className="format undo" />
        </button>
        <button
          disabled={!toolbarState.canRedo || !isGlobalEditable}
          onClick={() => {
            activeEditor.dispatchCommand(REDO_COMMAND, undefined);
          }}
          title={translateI18n('[TODO] Redo ({sk})', {
            placeholder: '下一步({sk})',
            variate: {sk: IS_APPLE ? '(⇧⌘Z)' : '(Ctrl+Y)'},
          })}
          type="button"
          className="toolbar-item"
          aria-label="Redo">
          <i className="format redo" />
        </button>
        <Divider />
        {toolbarState.blockType in blockTypeToBlockName &&
          activeEditor === editor && (
            <>
              <BlockFormatDropDown
                disabled={!isEditable}
                blockType={toolbarState.blockType}
                rootType={toolbarState.rootType}
                editor={activeEditor}
              />
              <Divider />
            </>
          )}
        {toolbarState.blockType === 'code' ? (
          <DropDown
            disabled={!isEditable}
            buttonClassName="toolbar-item code-language"
            buttonLabel={getLanguageFriendlyName(toolbarState.codeLanguage)}
            buttonAriaLabel="Select language">
            {CODE_LANGUAGE_OPTIONS.map(([value, name]) => {
              return (
                <DropDownItem
                  className={`item ${dropDownActiveClass(
                    value === toolbarState.codeLanguage,
                  )}`}
                  onClick={() => onCodeLanguageSelect(value)}
                  key={value}>
                  <span className="text">{name}</span>
                </DropDownItem>
              );
            })}
          </DropDown>
        ) : (
          <>
            <FontDropDown
              disabled={!isEditable}
              style={'font-family'}
              value={toolbarState.fontFamily}
              editor={activeEditor}
            />
            <Divider />
            <FontSize
              selectionFontSize={toolbarState.fontSize.slice(0, -2)}
              editor={activeEditor}
              disabled={!isEditable}
            />
            <Divider />
            <button
              disabled={!isEditable}
              onClick={() => {
                activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
              }}
              className={
                'toolbar-item spaced ' + (toolbarState.isBold ? 'active' : '')
              }
              title={translateI18n('[TODO] Bold ({sk})', {
                placeholder: '粗体({sk})',
                variate: {sk: SHORTCUTS.BOLD},
              })}
              type="button"
              aria-label={`Format text as bold. Shortcut: ${SHORTCUTS.BOLD}`}>
              <i className="format bold" />
            </button>
            <button
              disabled={!isEditable}
              onClick={() => {
                activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
              }}
              className={
                'toolbar-item spaced ' + (toolbarState.isItalic ? 'active' : '')
              }
              title={translateI18n('[TODO] Italic ({sk})', {
                placeholder: '斜体({sk})',
                variate: {sk: SHORTCUTS.ITALIC},
              })}
              type="button"
              aria-label={`Format text as italics. Shortcut: ${SHORTCUTS.ITALIC}`}>
              <i className="format italic" />
            </button>
            <button
              disabled={!isEditable}
              onClick={() => {
                activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
              }}
              className={
                'toolbar-item spaced ' +
                (toolbarState.isUnderline ? 'active' : '')
              }
              title={translateI18n('[TODO] Underline ({sk})', {
                placeholder: '下划线({sk})',
                variate: {sk: SHORTCUTS.UNDERLINE},
              })}
              type="button"
              aria-label={`Format text to underlined. Shortcut: ${SHORTCUTS.UNDERLINE}`}>
              <i className="format underline" />
            </button>
            {canViewerSeeInsertCodeButton && (
              <button
                disabled={!isEditable}
                onClick={() => {
                  activeEditor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code');
                }}
                className={
                  'toolbar-item spaced ' + (toolbarState.isCode ? 'active' : '')
                }
                title={translateI18n('[TODO] Insert code block ({sk})', {
                  placeholder: '行内代码块({sk})',
                  variate: {sk: SHORTCUTS.INSERT_CODE_BLOCK},
                })}
                type="button"
                aria-label="Insert code block">
                <i className="format code" />
              </button>
            )}
            <button
              disabled={!isEditable}
              onClick={insertLink}
              className={
                'toolbar-item spaced ' + (toolbarState.isLink ? 'active' : '')
              }
              aria-label="Insert link"
              title={translateI18n('[TODO] Insert link ({sk})', {
                placeholder: '插入链接({sk})',
                variate: {sk: SHORTCUTS.INSERT_LINK},
              })}
              type="button">
              <i className="format link" />
            </button>
            <DropdownColorPicker
              disabled={!isEditable}
              buttonClassName="toolbar-item color-picker"
              buttonAriaLabel="Formatting text color"
              buttonIconClassName="icon font-color"
              color={toolbarState.fontColor}
              onChange={onFontColorSelect}
              title="text color"
            />
            <DropdownColorPicker
              disabled={!isEditable}
              buttonClassName="toolbar-item color-picker"
              buttonAriaLabel="Formatting background color"
              buttonIconClassName="icon bg-color"
              color={toolbarState.bgColor}
              onChange={onBgColorSelect}
              title="bg color"
            />
            <DropDown
              disabled={!isEditable}
              buttonClassName="toolbar-item spaced"
              buttonLabel=""
              buttonAriaLabel="Formatting options for additional text styles"
              buttonIconClassName="icon dropdown-more">
              <DropDownItem
                onClick={() => {
                  activeEditor.dispatchCommand(
                    FORMAT_TEXT_COMMAND,
                    'lowercase',
                  );
                }}
                className={
                  'item wide ' + dropDownActiveClass(toolbarState.isLowercase)
                }
                aria-label="Format text to lowercase">
                <div className="icon-text-container">
                  <i className="icon lowercase" />
                  <span className="text">
                    {translateI18n('[TODO] Lowercase', {
                      placeholder: '小写',
                    })}
                  </span>
                </div>
                <span className="shortcut">{SHORTCUTS.LOWERCASE}</span>
              </DropDownItem>
              <DropDownItem
                onClick={() => {
                  activeEditor.dispatchCommand(
                    FORMAT_TEXT_COMMAND,
                    'uppercase',
                  );
                }}
                className={
                  'item wide ' + dropDownActiveClass(toolbarState.isUppercase)
                }
                aria-label="Format text to uppercase">
                <div className="icon-text-container">
                  <i className="icon uppercase" />
                  <span className="text">
                    {translateI18n('[TODO] Uppercase', {
                      placeholder: '大写',
                    })}
                  </span>
                </div>
                <span className="shortcut">{SHORTCUTS.UPPERCASE}</span>
              </DropDownItem>
              <DropDownItem
                onClick={() => {
                  activeEditor.dispatchCommand(
                    FORMAT_TEXT_COMMAND,
                    'capitalize',
                  );
                }}
                className={
                  'item wide ' + dropDownActiveClass(toolbarState.isCapitalize)
                }
                aria-label="Format text to capitalize">
                <div className="icon-text-container">
                  <i className="icon capitalize" />
                  <span className="text">
                    {translateI18n('[TODO] Capitalize', {
                      placeholder: '首字母大写',
                    })}
                  </span>
                </div>
                <span className="shortcut">{SHORTCUTS.CAPITALIZE}</span>
              </DropDownItem>
              <DropDownItem
                onClick={() => {
                  activeEditor.dispatchCommand(
                    FORMAT_TEXT_COMMAND,
                    'strikethrough',
                  );
                }}
                className={
                  'item wide ' +
                  dropDownActiveClass(toolbarState.isStrikethrough)
                }
                aria-label="Format text with a strikethrough">
                <div className="icon-text-container">
                  <i className="icon strikethrough" />
                  <span className="text">
                    {translateI18n('[TODO] Strikethrough', {
                      placeholder: '删除线',
                    })}
                  </span>
                </div>
                <span className="shortcut">{SHORTCUTS.STRIKETHROUGH}</span>
              </DropDownItem>
              <DropDownItem
                onClick={() => {
                  activeEditor.dispatchCommand(
                    FORMAT_TEXT_COMMAND,
                    'subscript',
                  );
                }}
                className={
                  'item wide ' + dropDownActiveClass(toolbarState.isSubscript)
                }
                aria-label="Format text with a subscript">
                <div className="icon-text-container">
                  <i className="icon subscript" />
                  <span className="text">
                    {translateI18n('[TODO] Subscript', {
                      placeholder: '下标',
                    })}
                  </span>
                </div>
                <span className="shortcut">{SHORTCUTS.SUBSCRIPT}</span>
              </DropDownItem>
              <DropDownItem
                onClick={() => {
                  activeEditor.dispatchCommand(
                    FORMAT_TEXT_COMMAND,
                    'superscript',
                  );
                }}
                className={
                  'item wide ' + dropDownActiveClass(toolbarState.isSuperscript)
                }
                aria-label="Format text with a superscript">
                <div className="icon-text-container">
                  <i className="icon superscript" />
                  <span className="text">
                    {translateI18n('[TODO] Superscript', {
                      placeholder: '上标',
                    })}
                  </span>
                </div>
                <span className="shortcut">{SHORTCUTS.SUPERSCRIPT}</span>
              </DropDownItem>
              <DropDownItem
                onClick={() => {
                  activeEditor.dispatchCommand(
                    FORMAT_TEXT_COMMAND,
                    'highlight',
                  );
                }}
                className={
                  'item wide ' + dropDownActiveClass(toolbarState.isHighlight)
                }
                aria-label="Format text with a highlight">
                <div className="icon-text-container">
                  <i className="icon highlight" />
                  <span className="text">
                    {translateI18n('[TODO] Highlight', {
                      placeholder: '高亮显示',
                    })}
                  </span>
                </div>
              </DropDownItem>
              <DropDownItem
                onClick={() => clearFormatting(activeEditor)}
                className="item wide"
                aria-label="Clear all text formatting">
                <div className="icon-text-container">
                  <i className="icon clear" />
                  <span className="text">
                    {translateI18n('[TODO] Clear Formatting', {
                      placeholder: '清除格式',
                    })}
                  </span>
                </div>
                <span className="shortcut">{SHORTCUTS.CLEAR_FORMATTING}</span>
              </DropDownItem>
            </DropDown>
            {canViewerSeeInsertDropdown && (
              <>
                <Divider />
                <DropDown
                  disabled={!isEditable}
                  buttonClassName="toolbar-item spaced"
                  buttonLabel={translateI18n('[TODO] 国际化 Insert', {
                    placeholder: '插入',
                  })}
                  buttonAriaLabel="Insert specialized editor node"
                  buttonIconClassName="icon plus">
                  <DropDownItem
                    onClick={() => {
                      activeEditor.dispatchCommand(
                        INSERT_INS_HORIZONTAL_RULE_COMMAND,
                        undefined,
                      );
                    }}
                    className="item">
                    <i className="icon horizontal-rule" />
                    <span className="text">
                      {translateI18n('[TODO] Horizontal Rule', {
                        placeholder: '分割线',
                      })}
                    </span>
                  </DropDownItem>
                  <DropDownItem
                    onClick={() => {
                      activeEditor.dispatchCommand(
                        INSERT_PAGE_BREAK,
                        undefined,
                      );
                    }}
                    className="item">
                    <i className="icon page-break" />
                    <span className="text">
                      {translateI18n('[TODO] Page Break', {
                        placeholder: '分页符',
                      })}
                    </span>
                  </DropDownItem>
                  <DropDownItem
                    onClick={() => {
                      showModal(
                        translateI18n('[TODO] Insert Image', {
                          placeholder: '插入图片',
                        }),
                        (onClose) => (
                          <InsertImageDialog
                            activeEditor={activeEditor}
                            onClose={onClose}
                          />
                        ),
                      );
                    }}
                    className="item">
                    <i className="icon image" />
                    <span className="text">
                      {translateI18n('[TODO] Image', {
                        placeholder: '图片',
                      })}
                    </span>
                  </DropDownItem>
                  {/* <DropDownItem
                    onClick={() => {
                      showModal('Insert Inline Image', (onClose) => (
                        <InsertInlineImageDialog
                          activeEditor={activeEditor}
                          onClose={onClose}
                        />
                      ));
                    }}
                    className="item">
                    <i className="icon image" />
                    <span className="text">Inline Image</span>
                  </DropDownItem>
                  <DropDownItem
                    onClick={() =>
                      insertGifOnClick({
                        altText: 'Cat typing on a laptop',
                        src: 'https://i.pinimg.com/originals/46/41/61/4641611401ecb508c625eebe448da663.gif',
                      })
                    }
                    className="item">
                    <i className="icon gif" />
                    <span className="text">GIF</span>
                  </DropDownItem> */}
                  {/* <DropDownItem
                    onClick={() => {
                      activeEditor.dispatchCommand(
                        INSERT_EXCALIDRAW_COMMAND,
                        undefined,
                      );
                    }}
                    className="item">
                    <i className="icon diagram-2" />
                    <span className="text">Excalidraw</span>
                  </DropDownItem> */}
                  <DropDownItem
                    onClick={() => {
                      showModal('Insert Table', (onClose) => (
                        <InsertTableDialog
                          activeEditor={activeEditor}
                          onClose={onClose}
                        />
                      ));
                    }}
                    className="item">
                    <i className="icon table" />
                    <span className="text">
                      {translateI18n('[TODO] Table', {
                        placeholder: '表格',
                      })}
                    </span>
                  </DropDownItem>
                  {/* <DropDownItem
                    onClick={() => {
                      showModal('Insert Poll', (onClose) => (
                        <InsertPollDialog
                          activeEditor={activeEditor}
                          onClose={onClose}
                        />
                      ));
                    }}
                    className="item">
                    <i className="icon poll" />
                    <span className="text">Poll</span>
                  </DropDownItem> */}
                  {/* <DropDownItem
                    onClick={() => {
                      showModal('Insert Columns Layout', (onClose) => (
                        <InsertLayoutDialog
                          activeEditor={activeEditor}
                          onClose={onClose}
                        />
                      ));
                    }}
                    className="item">
                    <i className="icon columns" />
                    <span className="text">Columns Layout</span>
                  </DropDownItem> */}

                  <DropDownItem
                    onClick={() => {
                      showModal(
                        translateI18n('[TODO] Insert Equation', {
                          placeholder: '插入公式',
                        }),
                        (onClose) => (
                          <InsertEquationDialog
                            activeEditor={activeEditor}
                            onClose={onClose}
                          />
                        ),
                      );
                    }}
                    className="item">
                    <i className="icon equation" />
                    <span className="text">
                      {translateI18n('[TODO] Equation', {
                        placeholder: '公式',
                      })}
                    </span>
                  </DropDownItem>
                  {/* <DropDownItem
                    onClick={() => {
                      editor.update(() => {
                        const root = $getRoot();
                        const stickyNode = $createStickyNode(0, 0);
                        root.append(stickyNode);
                      });
                    }}
                    className="item">
                    <i className="icon sticky" />
                    <span className="text">Sticky Note</span>
                  </DropDownItem> */}
                  <DropDownItem
                    onClick={() => {
                      editor.dispatchCommand(
                        INSERT_COLLAPSIBLE_COMMAND,
                        undefined,
                      );
                    }}
                    className="item">
                    <i className="icon caret-right" />
                    <span className="text">
                      {translateI18n('[TODO] Collapsible container', {
                        placeholder: '折叠内容',
                      })}
                    </span>
                  </DropDownItem>
                  {EmbedConfigs.map((embedConfig) => (
                    <DropDownItem
                      key={embedConfig.type}
                      onClick={() => {
                        activeEditor.dispatchCommand(
                          INSERT_BASE_EMBED_COMMAND,
                          embedConfig.type,
                        );
                      }}
                      className="item">
                      {embedConfig.icon}
                      <span className="text">{embedConfig.contentName}</span>
                    </DropDownItem>
                  ))}
                </DropDown>
              </>
            )}
          </>
        )}
        <Divider />
        <ElementFormatDropdown
          disabled={!isEditable}
          value={toolbarState.elementFormat}
          editor={activeEditor}
          isRTL={toolbarState.isRTL}
        />

        {modal}
      </ScrollBarAssembly>
    </div>
  );
});
