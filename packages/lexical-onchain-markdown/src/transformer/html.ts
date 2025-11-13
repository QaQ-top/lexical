/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {ElementTransformer} from '@lexical/markdown';
import {getStyleObjectFromCSS} from '@lexical/selection';
import {
  $createTableCellNode,
  $createTableRowNode,
  $isTableNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import {
  $createLineBreakNode,
  $createTextNode,
  $isLineBreakNode,
  $isRootNode,
  LexicalNode,
} from 'lexical';
import {
  $createFragmentNode,
  $createInstanceParagraphNode,
  $createInstanceTableNode,
} from 'onchain-lexical-instance';
import {getHTMLTagString} from 'onchain-utility';

import {$convertFromMarkdownString} from '../fromMarkdownString';
import {MultilineElementTransformer} from '../MarkdownTransformers';
import {$convertToMarkdownString} from '../toMarkdownString';
import {TransFormerGather} from '.';

const HTML_START = /^[\u0020\t]*<html.*?>/;
const HTML_END = /[\u0020\t]*<\/html>$/;

export const HTML: MultilineElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode],

  export: (node: LexicalNode) => {
    if ($isTableNode(node)) {
      const trsString = node
        .getChildren<TableRowNode>()
        .map((rowNode) => {
          const rowStyle = rowNode.getStyle().trim();
          return getHTMLTagString({
            attributes: Object.assign({}, rowStyle ? {style: rowStyle} : {}),
            context: rowNode
              .getChildren<TableCellNode>()
              .map((cellNode) => {
                const cellStyle = rowNode.getStyle().trim();
                const rowSpan = cellNode.getRowSpan();
                const colSpan = cellNode.getColSpan();
                return getHTMLTagString({
                  attributes: Object.assign(
                    {},
                    cellStyle ? {style: cellStyle} : {},
                    rowSpan > 1 ? {rowspan: rowSpan} : {},
                    colSpan > 1 ? {colspan: colSpan} : {},
                  ),
                  context: $convertToMarkdownString(
                    TransFormerGather.value,
                    cellNode,
                  ),
                  type: cellNode.getTag(),
                });
              })
              .join(''),
            type: 'tr',
          });
        })
        .join('');
      return `<html><body><table>${trsString}</table></body></html>`;
    }
    return null;
  },
  regExpEnd: {
    optional: true,
    regExp: HTML_END,
  },
  regExpStart: HTML_START,
  replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
    if (linesInBetween) {
      $convertFromMarkdownString(
        linesInBetween.join('\n'),
        [BODY_TABLE],
        rootNode,
      );
    }
  },
  type: 'multiline-element',
};

const BODY_START = /^[\u0020\t]*<body.*?>/;
const BODY_END = /[\u0020\t]*<\/body>$/;

export const BODY_TABLE: MultilineElementTransformer = {
  dependencies: [],
  regExpEnd: {
    regExp: BODY_END,
  },
  regExpStart: BODY_START,
  replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
    if (linesInBetween) {
      $convertFromMarkdownString(
        linesInBetween.join('\n'),
        [HTML_TABLE],
        rootNode,
      );
    }
  },
  type: 'multiline-element',
};

const HTML_TABLE_START = /^[\u0020\t]*<table.*?>/;
const HTML_TABLE_END = /[\u0020\t]*<\/table>$/;

const SINGLE_LINE_ROW_STYLES = /<tr.*?style=(["|'](.+?)["|']).*?>/;
const SINGLE_LINE_ROWSPAN = /<(th|td).*?rowspan=(["|'](.+?)["|']).*?>/;
const SINGLE_LINE_COLSPAN = /<(th|td).*?colspan=(["|'](.+?)["|']).*?>/;
const SINGLE_LINE_CELL_CONTENT = /<(th|td).*?>(([\n]|.)*?)<\/(th|td)>/;

const HTML_TR = /<tr(.*?)>(([\n]|.)*?)<\/tr>/g;
const HTML_TD = /<(th|td)(.*?)>(([\n]|.)*?)<\/(th|td)>/g;

function getTableRows(context: string) {
  const rows = Array.from(context.match(HTML_TR) || []).map((rowText) => {
    const cells = Array.from(rowText.match(HTML_TD) || []).map((collText) => {
      const tdStyles = collText.match(SINGLE_LINE_ROW_STYLES);
      const css = tdStyles ? tdStyles[2] : null;
      const rowspan = collText.match(SINGLE_LINE_ROWSPAN);
      const colspan = collText.match(SINGLE_LINE_COLSPAN);
      const content = collText.match(SINGLE_LINE_CELL_CONTENT);
      return {
        colspan: colspan ? colspan[3] : null,
        content: content ? content[2] : null,
        css,
        rowspan: rowspan ? rowspan[3] : null,
        styles: css ? getStyleObjectFromCSS(css) : null,
        tag: (content ? content[1] : 'td') as 'td' | 'th',
      };
    });
    const trStyles = rowText.match(SINGLE_LINE_ROW_STYLES);
    const css = trStyles ? trStyles[2] : null;
    return {
      cells,
      css,
      styles: css ? getStyleObjectFromCSS(css) : null,
      tag: 'tr',
    };
  });
  return rows;
}

export const HTML_TABLE: MultilineElementTransformer = {
  dependencies: [],
  regExpEnd: {
    regExp: HTML_TABLE_END,
  },
  regExpStart: HTML_TABLE_START,
  replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
    if (linesInBetween) {
      const context = linesInBetween.join('\n');
      const table = $createInstanceTableNode();
      const rows = getTableRows(context);
      rows.forEach((row) => {
        const rowNode = $createTableRowNode();
        if (row.css) {
          rowNode.setStyle(row.css);
        }
        row.cells.forEach((cell) => {
          const cellNode = $createTableCellNode();
          if (cell.rowspan) {
            cellNode.setRowSpan(Number(cell.rowspan));
          }
          if (cell.colspan) {
            cellNode.setColSpan(Number(cell.colspan));
          }
          if (cell.css) {
            cellNode.setStyle(cell.css);
          }
          if (cell.tag === 'th') {
            cellNode.setHeaderStyles(TableCellHeaderStates.ROW);
          }
          if (cell.content) {
            $convertFromMarkdownString(
              cell.content,
              TransFormerGather.value,
              cellNode,
            );
          }
          rowNode.append(cellNode);
        });
        table.append(rowNode);
      });
      rootNode.append(table);
    }
  },
  type: 'multiline-element',
};

// $convertFromMarkdownString(textContent, TransFormerGather.value, cell);

export const HTML_PARAGRAPH_TRANSFORMER: MultilineElementTransformer[] = [
  {
    end: /[\u0020\t]*<\/p>$/,
    start: /[\u0020\t]*<p.*?>/,
  },
  {
    end: /[\u0020\t]*<\/div>$/,
    start: /[\u0020\t]*<div.*?>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      if (linesInBetween) {
        const context = linesInBetween.join('\n');
        const paragraph = $createInstanceParagraphNode();
        $convertFromMarkdownString(context, TransFormerGather.value, paragraph);
        rootNode.append(paragraph);
      }
    },
    type: 'multiline-element',
  };
});

export const HTML_TEXT_TRANSFORMER: MultilineElementTransformer[] = [
  {
    end: /[\u0020\t]*<\/span>$/,
    start: /[\u0020\t]*<span.*?>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      if (linesInBetween) {
        const context = linesInBetween.join('\n').replace(/<br.*?\/>/g, '\n');
        if (/<([a-z]+).*?>(.*?)<\/\1>/g.test(context)) {
          const fragment = $createFragmentNode();
          $convertFromMarkdownString(
            context,
            TransFormerGather.value,
            fragment,
          );
          const children = fragment.getChildren();
          rootNode.append(...children);
        } else {
          const text = $createTextNode();
          text.setTextContent(context);
          if ($isRootNode(rootNode)) {
            const paragraph = $createInstanceParagraphNode();
            paragraph.append(text);
            rootNode.append(paragraph);
          } else {
            rootNode.append(text);
          }
        }
      }
    },
    type: 'multiline-element',
  };
});

export const HTML_BR: ElementTransformer = {
  dependencies: [],
  export: (node: LexicalNode) => {
    if ($isLineBreakNode(node)) {
      return '\n';
    }
    return null;
  },
  regExp: /^<br.*?\/>$/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createLineBreakNode();
    const paragraph = $createInstanceParagraphNode();
    paragraph.append(line);

    if (isImport || parentNode.getNextSibling() != null) {
      if ($isRootNode(parentNode.getParent())) {
        parentNode.replace(paragraph);
      } else {
        parentNode.replace(line);
      }
    } else {
      if ($isRootNode(parentNode.getParent())) {
        parentNode.insertBefore(paragraph);
      } else {
        parentNode.insertBefore(line);
      }
    }

    line.selectNext();
  },
  type: 'element',
};
