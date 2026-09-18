/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {EditorThemeClasses} from 'lexical';

import Styles from './PlaygroundEditorTheme.module.less';

const theme: EditorThemeClasses = {
  autocomplete: Styles.PlaygroundEditorTheme__autocomplete,
  blockCursor: Styles.PlaygroundEditorTheme__blockCursor,
  characterLimit: Styles.PlaygroundEditorTheme__characterLimit,
  code: Styles.PlaygroundEditorTheme__code,
  codeHighlight: {
    atrule: Styles.PlaygroundEditorTheme__tokenAttr,
    attr: Styles.PlaygroundEditorTheme__tokenAttr,
    boolean: Styles.PlaygroundEditorTheme__tokenProperty,
    builtin: Styles.PlaygroundEditorTheme__tokenSelector,
    cdata: Styles.PlaygroundEditorTheme__tokenComment,
    char: Styles.PlaygroundEditorTheme__tokenSelector,
    class: Styles.PlaygroundEditorTheme__tokenFunction,
    'class-name': Styles.PlaygroundEditorTheme__tokenFunction,
    comment: Styles.PlaygroundEditorTheme__tokenComment,
    constant: Styles.PlaygroundEditorTheme__tokenProperty,
    deleted: Styles.PlaygroundEditorTheme__tokenProperty,
    doctype: Styles.PlaygroundEditorTheme__tokenComment,
    entity: Styles.PlaygroundEditorTheme__tokenOperator,
    function: Styles.PlaygroundEditorTheme__tokenFunction,
    important: Styles.PlaygroundEditorTheme__tokenVariable,
    inserted: Styles.PlaygroundEditorTheme__tokenSelector,
    keyword: Styles.PlaygroundEditorTheme__tokenAttr,
    namespace: Styles.PlaygroundEditorTheme__tokenVariable,
    number: Styles.PlaygroundEditorTheme__tokenProperty,
    operator: Styles.PlaygroundEditorTheme__tokenOperator,
    prolog: Styles.PlaygroundEditorTheme__tokenComment,
    property: Styles.PlaygroundEditorTheme__tokenProperty,
    punctuation: Styles.PlaygroundEditorTheme__tokenPunctuation,
    regex: Styles.PlaygroundEditorTheme__tokenVariable,
    selector: Styles.PlaygroundEditorTheme__tokenSelector,
    string: Styles.PlaygroundEditorTheme__tokenSelector,
    symbol: Styles.PlaygroundEditorTheme__tokenProperty,
    tag: Styles.PlaygroundEditorTheme__tokenProperty,
    url: Styles.PlaygroundEditorTheme__tokenOperator,
    variable: Styles.PlaygroundEditorTheme__tokenVariable,
  },
  embedBlock: {
    base: Styles.PlaygroundEditorTheme__embedBlock,
    focus: Styles.PlaygroundEditorTheme__embedBlockFocus,
  },
  hashtag: Styles.PlaygroundEditorTheme__hashtag,
  heading: {
    h1: Styles.PlaygroundEditorTheme__h1,
    h2: Styles.PlaygroundEditorTheme__h2,
    h3: Styles.PlaygroundEditorTheme__h3,
    h4: Styles.PlaygroundEditorTheme__h4,
    h5: Styles.PlaygroundEditorTheme__h5,
    h6: Styles.PlaygroundEditorTheme__h6,
  },
  hr: Styles.PlaygroundEditorTheme__hr,
  hrSelected: Styles.PlaygroundEditorTheme__hrSelected,
  image: Styles['editor-image'],
  indent: Styles.PlaygroundEditorTheme__indent,
  inlineImage: Styles['inline-editor-image'],
  layoutContainer: Styles.PlaygroundEditorTheme__layoutContainer,
  layoutItem: Styles.PlaygroundEditorTheme__layoutItem,
  link: Styles.PlaygroundEditorTheme__link,
  list: {
    checklist: Styles.PlaygroundEditorTheme__checklist,
    listitem: Styles.PlaygroundEditorTheme__listItem,
    listitemChecked: Styles.PlaygroundEditorTheme__listItemChecked,
    listitemUnchecked: Styles.PlaygroundEditorTheme__listItemUnchecked,
    nested: {
      listitem: Styles.PlaygroundEditorTheme__nestedListItem,
    },
    olDepth: [
      Styles.PlaygroundEditorTheme__ol1,
      Styles.PlaygroundEditorTheme__ol2,
      Styles.PlaygroundEditorTheme__ol3,
      Styles.PlaygroundEditorTheme__ol4,
      Styles.PlaygroundEditorTheme__ol5,
    ],
    ul: Styles.PlaygroundEditorTheme__ul,
  },
  ltr: Styles.PlaygroundEditorTheme__ltr,
  mark: Styles.PlaygroundEditorTheme__mark,
  markOverlap: Styles.PlaygroundEditorTheme__markOverlap,
  paragraph: Styles.PlaygroundEditorTheme__paragraph,
  quote: Styles.PlaygroundEditorTheme__quote,
  rtl: Styles.PlaygroundEditorTheme__rtl,
  specialText: Styles.PlaygroundEditorTheme__specialText,
  tab: Styles.PlaygroundEditorTheme__tabNode,
  table: Styles.PlaygroundEditorTheme__table,
  tableAddColumns: Styles.PlaygroundEditorTheme__tableAddColumns,
  tableAddRows: Styles.PlaygroundEditorTheme__tableAddRows,
  tableAlignment: {
    center: Styles.PlaygroundEditorTheme__tableAlignmentCenter,
    right: Styles.PlaygroundEditorTheme__tableAlignmentRight,
  },
  tableCell: Styles.PlaygroundEditorTheme__tableCell,
  tableCellActionButton: Styles.PlaygroundEditorTheme__tableCellActionButton,
  tableCellActionButtonContainer:
    Styles.PlaygroundEditorTheme__tableCellActionButtonContainer,
  tableCellHeader: Styles.PlaygroundEditorTheme__tableCellHeader,
  tableCellResizer: Styles.PlaygroundEditorTheme__tableCellResizer,
  tableCellSelected: Styles.PlaygroundEditorTheme__tableCellSelected,
  tableFrozenColumn: Styles.PlaygroundEditorTheme__tableFrozenColumn,
  tableFrozenRow: Styles.PlaygroundEditorTheme__tableFrozenRow,
  tableRowStriping: Styles.PlaygroundEditorTheme__tableRowStriping,
  tableScrollableWrapper: Styles.PlaygroundEditorTheme__tableScrollableWrapper,
  tableSelected: Styles.PlaygroundEditorTheme__tableSelected,
  tableSelection: Styles.PlaygroundEditorTheme__tableSelection,
  text: {
    bold: Styles.PlaygroundEditorTheme__textBold,
    capitalize: Styles.PlaygroundEditorTheme__textCapitalize,
    code: Styles.PlaygroundEditorTheme__textCode,
    highlight: Styles.PlaygroundEditorTheme__textHighlight,
    italic: Styles.PlaygroundEditorTheme__textItalic,
    lowercase: Styles.PlaygroundEditorTheme__textLowercase,
    strikethrough: Styles.PlaygroundEditorTheme__textStrikethrough,
    subscript: Styles.PlaygroundEditorTheme__textSubscript,
    superscript: Styles.PlaygroundEditorTheme__textSuperscript,
    underline: Styles.PlaygroundEditorTheme__textUnderline,
    underlineStrikethrough:
      Styles.PlaygroundEditorTheme__textUnderlineStrikethrough,
    uppercase: Styles.PlaygroundEditorTheme__textUppercase,
  },
};

export default theme;
