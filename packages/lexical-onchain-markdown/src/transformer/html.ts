/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {$createLinkNode} from '@lexical/link';
import {ListType} from '@lexical/list';
import {ElementTransformer} from '@lexical/markdown';
import {$isHorizontalRuleNode} from '@lexical/react/LexicalHorizontalRuleNode';
import {HeadingTagType} from '@lexical/rich-text';
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
  $isElementNode,
  $isLineBreakNode,
  $isTextNode,
  ElementNode,
  LexicalNode,
  TEXT_TYPE_TO_FORMAT,
  TextNode,
} from 'lexical';
import {
  $createCollapsibleContainerNode,
  $createCollapsibleContentNode,
  $createCollapsibleTitleNode,
  $createFragmentNode,
  $createImageNode,
  $createInstanceCodeNode,
  $createInstanceEquationNode,
  $createInstanceHeadingNode,
  $createInstanceHorizontalRuleNode,
  $createInstanceListItemNode,
  $createInstanceListNode,
  $createInstanceParagraphNode,
  $createInstanceQuoteNode,
  $createInstanceTableNode,
  $createInternalLinkNode,
  $createPageBreakNode,
  $createParametersNode,
  $isImageNode,
} from 'onchain-lexical-instance';
import {dfs, getHTMLTagString} from 'onchain-utility';
import {fromBase64UTF8} from 'onchain-utility/base64';

import {$convertFromMarkdownString} from '../fromMarkdownString';
import {MultilineElementTransformer} from '../MarkdownTransformers';
import {$convertToMarkdownString} from '../toMarkdownString';
import {TransFormerGather} from '.';
import {getHtmlTagAttrValue, parseHtmlToCustomStructure} from './utils';

const interval = '{-|-}';

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
    start: /^[\u0020\t]*<p[^a-z]+(?:[^>]*?)>/,
  },
  {
    end: /[\u0020\t]*<\/div>$/,
    start: /^[\u0020\t]*<div(?:[^>]*?)>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      optional: true,
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      if (linesInBetween) {
        const context = linesInBetween.join('\n');
        // console.log('PARAGRAPH CONTEXT', context);
        const paragraph = optimizeNesting(
          $createInstanceParagraphNode(),
          context,
        );
        rootNode.append(paragraph);
      }
    },
    type: 'multiline-element',
  };
});

export const HTML_LIST_TRANSFORMER: MultilineElementTransformer[] = [
  ...[
    {
      end: /[\u0020\t]*<\/ul>$/,
      start: /^[\u0020\t]*<ul(?:[^>]*?)>/,
    },
    {
      end: /[\u0020\t]*<\/ol>$/,
      start: /^[\u0020\t]*<ol(?:[^>]*?)>/,
    },
  ].map(({start, end}) => {
    const TRANSFORMER: MultilineElementTransformer = {
      dependencies: [],
      regExpEnd: {
        optional: true,
        regExp: end,
      },
      regExpStart: start,
      replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
        // console.log('LIST', linesInBetween);
        const type =
          getHtmlTagAttrValue<ListType>(startMatch[0], 'list-type') || 'bullet';
        if (linesInBetween) {
          const context = linesInBetween.join('\n');
          const list = $createInstanceListNode(type);
          $convertFromMarkdownString(context, TransFormerGather.value, list);
          rootNode.append(list);
        }
      },
      type: 'multiline-element',
    };
    return TRANSFORMER;
  }),
  {
    dependencies: [],
    regExpEnd: {
      optional: true,
      regExp: /[\u0020\t]*<\/li>$/,
    },
    regExpStart: /^[\u0020\t]*<li(?:[^>]*?)>/,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      const checked =
        getHtmlTagAttrValue(startMatch[0], 'aria-checked') || 'false';
      if (linesInBetween) {
        const context = linesInBetween.join('\n');
        const listItem = $createInstanceListItemNode(checked === 'true');
        const nodes = parseTagContent(context);
        listItem.append(...nodes);
        rootNode.append(listItem);
      }
    },
    type: 'multiline-element',
  },
];

export const HTML_QUOTE_TRANSFORMER: MultilineElementTransformer[] = [
  {
    end: /[\u0020\t]*<\/blockquote>$/,
    start: /^[\u0020\t]*<blockquote(?:[^>]*?)>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      optional: true,
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      // console.log('QUOTE', linesInBetween);
      if (linesInBetween) {
        const context = linesInBetween.join('\n');
        const quote = $createInstanceQuoteNode();
        const nodes = parseTagContent(context);
        quote.append(...nodes);
        rootNode.append(quote);
      }
    },
    type: 'multiline-element',
  };
});

export const HTML_CODE_TRANSFORMER: MultilineElementTransformer[] = [
  {
    end: /[\u0020\t]*<\/pre>$/,
    start: /^[\u0020\t]*<pre(?:[^>]*?)>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      optional: true,
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      // console.log('CODE', linesInBetween);
      const language =
        getHtmlTagAttrValue(startMatch[0], 'data-language') || 'text';
      if (linesInBetween) {
        const context = linesInBetween.join('\n');
        const code = $createInstanceCodeNode(language);
        const nodes = parseTagContent(context);
        code.append(...nodes);
        rootNode.append(code);
      }
    },
    type: 'multiline-element',
  };
});

export const HTML_LINK_TRANSFORMER: MultilineElementTransformer[] = [
  {
    end: /[\u0020\t]*<\/a>$/,
    start: /^[\u0020\t]*<a[^a-z]+(?:[^>]*?)>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      optional: true,
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      // console.log('LINK', linesInBetween);
      const url = getHtmlTagAttrValue(startMatch[0], 'href') || '';
      if (linesInBetween) {
        const context = linesInBetween.join('\n');
        const link = $createLinkNode(url);
        const nodes = parseTagContent(context);
        link.append(...nodes);
        rootNode.append(link);
      }
    },
    type: 'multiline-element',
  };
});

export const HTML_HEADING_TRANSFORMER: MultilineElementTransformer[] = [
  {
    end: /[\u0020\t]*<\/h[1-6]{1}>$/,
    start: /^[\u0020\t]*<h[1-6]{1}(?:[^>]*?)>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      optional: true,
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      // console.log('HEADING', linesInBetween);
      if (linesInBetween) {
        const tag = `h${(startMatch[0] || '11')[2]}` as HeadingTagType;
        const context = linesInBetween.join('\n');
        const heading = $createInstanceHeadingNode(tag);
        const nodes = parseTagContent(context);
        heading.append(...nodes);
        rootNode.append(heading);
      }
    },
    type: 'multiline-element',
  };
});

export const HTML_EQUATION_TRANSFORMER: MultilineElementTransformer[] = [
  {
    end: /[\u0020\t]*<\/equation>$/,
    start: /^[\u0020\t]*<equation(?:[^>]*?)>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      optional: true,
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      const equation =
        getHtmlTagAttrValue(startMatch[0], 'data-lexical-equation') || '';
      const inline =
        getHtmlTagAttrValue(startMatch[0], 'data-lexical-inline') === 'true';
      const node = $createInstanceEquationNode(
        fromBase64UTF8(equation),
        inline,
      );
      rootNode.append(node);
    },
    type: 'multiline-element',
  };
});

// details

export const HTML_COLLAPSIBLE_TRANSFORMER: MultilineElementTransformer[] = [
  {
    end: /[\u0020\t]*<\/details>$/,
    start: /^[\u0020\t]*<details(?:[^>]*?)>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      optional: true,
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      if (linesInBetween) {
        const [title, content] = linesInBetween
          .join('\n')
          .replace(
            /<summary(?:[^>]*?)>((.|[\n])*)<\/summary>((.|[\n])*)/,
            `$1${interval}$3`,
          )
          .split(interval)
          .map((part) => parseTagContent(part))
          .flat(1);
        const isOpen = getHtmlTagAttrValue(startMatch[0], 'open') === 'true';
        const node = $createCollapsibleContainerNode(isOpen).append(
          $createCollapsibleTitleNode().append(title),
          $createCollapsibleContentNode().append(content),
        );
        rootNode.append(node);
      }
    },
    type: 'multiline-element',
  };
});

export const HTML_FIGURE_TRANSFORMER: MultilineElementTransformer[] = [
  {
    end: /[\u0020\t]*<\/figure>$/,
    start: /^[\u0020\t]*<figure(?:[^>]*?)>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      optional: true,
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      if (linesInBetween) {
        const node = $createPageBreakNode();
        rootNode.append(node);
      }
    },
    type: 'multiline-element',
  };
});

export const HTML_INTERNAL_LINK_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [],
  regExpEnd: {
    regExp: /[\u0020\t]*<\/section>$/,
  },
  regExpStart: /^[\u0020\t]*<section internal-link(?:[^>]*?)>/,
  replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
    // console.log('INTERNAL LINK MATCH', linesInBetween);
    const number = getHtmlTagAttrValue(
      startMatch[0],
      'data-internal-link-number',
    );
    if (number) {
      const internalLinkNode = $createInternalLinkNode(number);
      rootNode.append(internalLinkNode);
    }
  },
  type: 'multiline-element',
};

export const HTML_PARAMETERS_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [],
  regExpEnd: {
    regExp: /[\u0020\t]*<\/section>$/,
  },
  regExpStart: /^[\u0020\t]*<section parameter(?:[^>]*?)>/,
  replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
    // console.log('INTERNAL PARAMETERS MATCH', linesInBetween);
    const parameter = JSON.parse(
      fromBase64UTF8(
        getHtmlTagAttrValue(startMatch[0], 'data-parameter') || '',
      ),
    );
    if (parameter) {
      const parameterNode = $createParametersNode(parameter);
      rootNode.append(parameterNode);
    }
  },
  type: 'multiline-element',
};

export const HTML_TEXT_TRANSFORMER: MultilineElementTransformer[] = [
  {
    end: /[\u0020\t]*<\/span>$/,
    start: /^[\u0020\t]*<span(?:[^>]*?)>/,
  },
  {
    end: /[\u0020\t]*<\/em>$/,
    start: /^[\u0020\t]*<em(?:[^>]*?)>/,
  },
  {
    end: /[\u0020\t]*<\/strong>$/,
    start: /^[\u0020\t]*<strong(?:[^>]*?)>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      const input = (startMatch as RegExpMatchArray).input || '';
      const nodes = parseTagContent(input);
      rootNode.append(...nodes);
    },
    type: 'multiline-element',
  };
});

export const HTML_TEXT_STYLES_TRANSFORMER: MultilineElementTransformer[] = [
  {
    end: /[\u0020\t]*<\/b>$/,
    start: /^[\u0020\t]*<b>/,
  },
  {
    end: /[\u0020\t]*<\/i>$/,
    start: /^[\u0020\t]*<i>/,
  },
  {
    end: /[\u0020\t]*<\/u>$/,
    start: /^[\u0020\t]*<u>/,
  },
  {
    end: /[\u0020\t]*<\/s>$/,
    start: /^[\u0020\t]*<s>/,
  },
  {
    end: /[\u0020\t]*<\/code>$/,
    start: /^[\u0020\t]*<code(?:[^>]*?)>/,
  },
  {
    end: /[\u0020\t]*<\/sub>$/,
    start: /^[\u0020\t]*<sub(?:[^>]*?)>/,
  },
  {
    end: /[\u0020\t]*<\/sup>$/,
    start: /^[\u0020\t]*<sup(?:[^>]*?)>/,
  },
].map(({start, end}) => {
  return {
    dependencies: [],
    regExpEnd: {
      optional: true,
      regExp: end,
    },
    regExpStart: start,
    replace: (rootNode, children, startMatch, endMatch, linesInBetween) => {
      // console.log('TEXT_STYLES', linesInBetween);
      if (linesInBetween) {
        const [
          isBold,
          isItalic,
          isUnderline,
          isStrikethrough,
          isCode,
          isSup,
          isSub,
        ] = [
          startMatch[0].includes('<b'),
          startMatch[0].includes('<i'),
          startMatch[0].includes('<u'),
          startMatch[0].includes('<s'),
          startMatch[0].includes('<code'),
          startMatch[0].includes('<sup'),
          startMatch[0].includes('<sub'),
        ];
        const context = linesInBetween.join('\n');
        const fragment = $createFragmentNode();
        $convertFromMarkdownString(context, TransFormerGather.value, fragment);
        const nodes = fragment.getChildren();
        nodes.forEach((node) => {
          if ($isTextNode(node)) {
            if (isBold) {
              if (node.hasFormat('bold')) {
                return;
              }
              node.setFormat(node.getFormat() | TEXT_TYPE_TO_FORMAT.bold);
            }
            if (isItalic) {
              if (node.hasFormat('italic')) {
                return;
              }
              node.setFormat(node.getFormat() | TEXT_TYPE_TO_FORMAT.italic);
            }
            if (isUnderline) {
              if (node.hasFormat('underline')) {
                return;
              }
              node.setFormat(node.getFormat() | TEXT_TYPE_TO_FORMAT.underline);
            }
            if (isStrikethrough) {
              if (node.hasFormat('strikethrough')) {
                return;
              }
              node.setFormat(
                node.getFormat() | TEXT_TYPE_TO_FORMAT.strikethrough,
              );
            }
            if (isCode) {
              if (node.hasFormat('code')) {
                return;
              }
              node.setFormat(node.getFormat() | TEXT_TYPE_TO_FORMAT.code);
            }
            if (isSup) {
              if (node.hasFormat('superscript')) {
                return;
              }
              node.setFormat(
                node.getFormat() | TEXT_TYPE_TO_FORMAT.superscript,
              );
            }
            if (isSub) {
              if (node.hasFormat('subscript')) {
                return;
              }
              node.setFormat(node.getFormat() | TEXT_TYPE_TO_FORMAT.subscript);
            }
          }
        });
        rootNode.append(...nodes);
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
  regExp: /^<br(?:[^>]*?)\/{0,1}>/,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createLineBreakNode();
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }
  },
  type: 'element',
};

export const HTML_IMAGE: ElementTransformer = {
  dependencies: [],
  export: (node: LexicalNode) => {
    if ($isImageNode(node)) {
      return `![${node.getAltText()}](${node.getSrc()})`;
    }
    return null;
  },
  regExp: /^<img(?:[^>]*?)\/{0,1}>/,
  replace: (parentNode, _1, match, isImport) => {
    const input = (match as RegExpMatchArray).input || '';
    const url = getHtmlTagAttrValue(input, 'href') || '';
    const alt = getHtmlTagAttrValue(input, 'alt') || '';
    const image = $createImageNode({altText: alt, src: url});
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(image);
    } else {
      parentNode.insertBefore(image);
    }
  },
  type: 'element',
};

export const HTML_HR: ElementTransformer = {
  dependencies: [],
  export: (node: LexicalNode) => {
    if ($isHorizontalRuleNode(node)) {
      return '***';
    }
    return null;
  },
  regExp: /^<hr(?:[^>]*?)\/{0,1}>/,
  replace: (parentNode, _1, match, isImport) => {
    const horizontal = $createInstanceHorizontalRuleNode();
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(horizontal);
    } else {
      parentNode.insertBefore(horizontal);
    }
  },
  type: 'element',
};

function optimizeNesting<T extends ElementNode>(node: T, context: string): T {
  const nodes = parseTagContent(context);
  if (nodes.length === 1 && nodes[0] instanceof node.constructor) {
    node = nodes[0] as T;
  } else {
    node.append(...nodes);
  }
  return node;
}

function parseTagContent(input: string) {
  // console.log(input, 'PARSE TAG CONTENT');
  const structure = parseHtmlToCustomStructure(input);
  let htmlFragment: HTMLDivElement | null = document.createElement('div');
  dfs(structure, (object, parent) => {
    if (['span', 'em', 'strong'].includes(object.tag)) {
      const text = $createTextNode();
      object.node = text;
    } else if (object.tag === 'text') {
      if (parent && parent.node) {
        if ($isElementNode(parent.node)) {
          const text = $createTextNode();
          text.setTextContent(object.content);
          parent.node.append(text);
        } else {
          if ($isTextNode(parent.node)) {
            parent.node.setTextContent(object.content);
          }
        }
      }
    } else {
      htmlFragment!.childNodes.forEach((element) => element.remove());
      htmlFragment!.append(object.dom!);
      const fragment = $createFragmentNode();
      $convertFromMarkdownString(
        htmlFragment!.innerHTML,
        TransFormerGather.value,
        fragment,
      );
      object.node = fragment.getChildren<ElementNode>()[0]!;
      object.dom = null;
    }
    return object.children;
  });
  htmlFragment = null;
  return structure.map((object) => object.node).filter(Boolean) as (
    | ElementNode
    | TextNode
  )[];
}
