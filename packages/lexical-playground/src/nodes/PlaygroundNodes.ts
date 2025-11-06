/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {Klass, LexicalNode} from 'lexical';

import {CodeHighlightNode, CodeNode} from '@lexical/code';
import {HashtagNode} from '@lexical/hashtag';
import {AutoLinkNode, LinkNode} from '@lexical/link';
import {ListItemNode, ListNode} from '@lexical/list';
import {MarkNode} from '@lexical/mark';
import {OverflowNode} from '@lexical/overflow';
import {HorizontalRuleNode} from '@lexical/react/LexicalHorizontalRuleNode';
import {HeadingNode, QuoteNode} from '@lexical/rich-text';
import {TableCellNode, TableNode, TableRowNode} from '@lexical/table';
import {
  BarDecoratorNode,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
  Fragment,
  ImageNode,
  InlineImageNode,
  InstanceCodeHighlightNode,
  InstanceCodeNode,
  InstanceEquationNode,
  InstanceHeadingNode,
  InstanceHorizontalRuleNode,
  InstanceListItemNode,
  InstanceListNode,
  InstanceNode,
  InstanceParagraphNode,
  InstanceQuoteNode,
  InstanceTableNode,
  InstanceTitleNode,
  InternalLinkNode,
  KeywordNode,
  NumberDecoratorNode,
  PageBreakNode,
  ParametersNode,
  PlaceholderDecoratorNode,
} from 'onchain-lexical-instance';

import {AutocompleteNode} from './AutocompleteNode';
// import {EmojiNode} from './EmojiNode';
// import {ExcalidrawNode} from './ExcalidrawNode';
import {FigmaNode} from './FigmaNode';
import {LayoutContainerNode} from './LayoutContainerNode';
import {LayoutItemNode} from './LayoutItemNode';
import {MentionNode} from './MentionNode';
import {PollNode} from './PollNode';
import {SpecialTextNode} from './SpecialTextNode';
// import {StickyNode} from './StickyNode';
// import {TweetNode} from './TweetNode';
// import {YouTubeNode} from './YouTubeNode';

const PlaygroundNodes: Array<Klass<LexicalNode>> = [
  HeadingNode,
  ListNode,
  ListItemNode,
  QuoteNode,
  CodeNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  HashtagNode,
  CodeHighlightNode,
  AutoLinkNode,
  LinkNode,
  OverflowNode,
  PollNode,
  // StickyNode,
  ImageNode,
  InlineImageNode,
  MentionNode,
  // EmojiNode,
  // ExcalidrawNode,
  AutocompleteNode,
  KeywordNode,
  HorizontalRuleNode,
  // TweetNode,
  // YouTubeNode,
  FigmaNode,
  MarkNode,
  CollapsibleContainerNode,
  CollapsibleContentNode,
  CollapsibleTitleNode,
  PageBreakNode,
  LayoutContainerNode,
  LayoutItemNode,
  SpecialTextNode,
  InstanceNode,
  InstanceEquationNode,
  BarDecoratorNode,
  NumberDecoratorNode,
  InstanceParagraphNode,
  PlaceholderDecoratorNode,
  InstanceHeadingNode,
  InstanceTitleNode,
  InstanceListItemNode,
  InstanceListNode,
  InstanceQuoteNode,
  InstanceCodeNode,
  InstanceCodeHighlightNode,
  InstanceTableNode,
  InstanceHorizontalRuleNode,
  InternalLinkNode,
  ParametersNode,
  Fragment,
];

window.PlaygroundNodes = PlaygroundNodes;

export default PlaygroundNodes;
