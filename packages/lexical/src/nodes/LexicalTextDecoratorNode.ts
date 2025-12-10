/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {
  KlassConstructor,
  LexicalEditor,
  TextNodeThemeClasses,
} from '../LexicalEditor';
import type {ElementNode} from './LexicalElementNode';
import type {
  BaseSelection,
  EditorConfig,
  ElementFormatType,
  LexicalUpdateJSON,
  SerializedLexicalNode,
  Spread,
  TextFormatType,
} from 'lexical';

import invariant from 'shared/invariant';

import {
  ELEMENT_FORMAT_TO_TYPE,
  ELEMENT_TYPE_TO_FORMAT,
  IS_BOLD,
  IS_CODE,
  IS_HIGHLIGHT,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_UNDERLINE,
  TEXT_TYPE_TO_FORMAT,
} from '../LexicalConstants';
import {LexicalNode} from '../LexicalNode';
import {getCachedClassNameArray, toggleTextFormatType} from '../LexicalUtils';
import {DecoratorNode} from './LexicalDecoratorNode';

export type SerializedTextDecoratorNode = Spread<
  {
    direction: 'ltr' | 'rtl' | null;
    format: ElementFormatType;
    indent: number;
    textFormat?: number;
    style?: string;
    tag?: string;
    className?: string;
  },
  SerializedLexicalNode
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface TextDecoratorNode<T> {
  getTopLevelElement(): ElementNode | this | null;
  getTopLevelElementOrThrow(): ElementNode | this;
}

/** @noInheritDoc */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TextDecoratorNode<T> extends DecoratorNode<T> {
  ['constructor']!: KlassConstructor<typeof DecoratorNode<T>>;
  __first = null;
  __last = null;
  __size = 0;
  __format = 0;
  __style = '';
  __indent = 0;
  __dir: 'ltr' | 'rtl' | null = null;
  __className = '';

  /**
   * The returned value is added to the LexicalEditor._decorators
   */
  decorate(editor: LexicalEditor, config: EditorConfig): T {
    invariant(false, 'decorate: base method not extended');
  }

  isIsolated(): boolean {
    return false;
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  isSelected(selection?: null | BaseSelection): boolean {
    return true;
  }

  canHaveFormat(): boolean {
    return true;
  }

  createDOM(config: EditorConfig, editor?: LexicalEditor) {
    const format = this.__format;
    const outerTag = getElementOuterTag(this, format);
    const innerTag = getElementInnerTag(this, format);
    const tag = outerTag === null ? innerTag : outerTag;

    const dom = document.createElement(tag);
    let innerDOM = dom;
    if (outerTag !== null) {
      innerDOM = document.createElement(innerTag);
      dom.appendChild(innerDOM);
    }
    createTextInnerDOM(innerDOM, this, innerTag, format, config);
    const style = this.__style;
    if (style !== '') {
      dom.style.cssText = style;
    }
    return innerDOM || dom;
  }

  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const prevFormat = prevNode.__format;
    const nextFormat = this.__format;
    const prevOuterTag = getElementOuterTag(this, prevFormat);
    const nextOuterTag = getElementOuterTag(this, nextFormat);
    const prevInnerTag = getElementInnerTag(this, prevFormat);
    const nextInnerTag = getElementInnerTag(this, nextFormat);
    const prevTag = prevOuterTag === null ? prevInnerTag : prevOuterTag;
    const nextTag = nextOuterTag === null ? nextInnerTag : nextOuterTag;
    if (prevTag !== nextTag) {
      return true;
    }
    if (prevOuterTag === nextOuterTag && prevInnerTag !== nextInnerTag) {
      // should always be an element
      const prevInnerDOM: HTMLElement = dom.firstChild as HTMLElement;
      if (prevInnerDOM == null) {
        invariant(false, 'updateDOM: prevInnerDOM is null or undefined');
      }
      const nextInnerDOM = document.createElement(nextInnerTag);
      createTextInnerDOM(nextInnerDOM, this, nextInnerTag, nextFormat, config);
      dom.replaceChild(nextInnerDOM, prevInnerDOM);
      return false;
    }
    let innerDOM = dom;
    if (nextOuterTag !== null) {
      if (prevOuterTag !== null) {
        innerDOM = dom.firstChild as HTMLElement;
        if (innerDOM == null) {
          invariant(false, 'updateDOM: innerDOM is null or undefined');
        }
      }
    }
    const theme = config.theme;
    // Apply theme class names
    const textClassNames = theme.text;

    if (textClassNames !== undefined && prevFormat !== nextFormat) {
      setTextThemeClassNames(
        nextInnerTag,
        prevFormat,
        nextFormat,
        innerDOM,
        textClassNames,
      );
    }
    const prevStyle = prevNode.__style;
    const nextStyle = this.__style;
    if (prevStyle !== nextStyle) {
      dom.style.cssText = nextStyle;
    }
    return false;
  }

  afterCloneFrom(prevNode: this) {
    super.afterCloneFrom(prevNode);
    this.__first = prevNode.__first;
    this.__last = prevNode.__last;
    this.__size = prevNode.__size;
    this.__indent = prevNode.__indent;
    this.__format = prevNode.__format;
    this.__style = prevNode.__style;
    this.__dir = prevNode.__dir;
    this.__className = prevNode.__className;
  }

  exportJSON(): SerializedTextDecoratorNode {
    const json: SerializedTextDecoratorNode = {
      className: this.getClassName(),
      direction: this.getDirection(),
      format: this.getFormatType(),
      indent: this.getIndent(),
      ...super.exportJSON(),
    };
    const textFormat = this.getTextFormat();
    const style = this.getStyle();
    if (textFormat !== 0) {
      json.textFormat = textFormat;
    }
    if (style !== '') {
      json.style = style;
    }
    return json;
  }

  updateFromJSON(
    serializedNode: LexicalUpdateJSON<SerializedTextDecoratorNode>,
  ): this {
    return super
      .updateFromJSON(serializedNode)
      .setFormat(serializedNode.format)
      .setIndent(serializedNode.indent)
      .setDirection(serializedNode.direction)
      .setStyle(serializedNode.style || '')
      .setClassName(serializedNode.className);
  }

  getFormat(): number {
    const self = this.getLatest();
    return self.__format;
  }
  getFormatType(): ElementFormatType {
    const format = this.getFormat();
    return ELEMENT_FORMAT_TO_TYPE[format] || '';
  }
  getStyle(): string {
    const self = this.getLatest();
    return self.__style;
  }
  getTextStyle(): string {
    const self = this.getLatest();
    return self.__style;
  }
  getIndent(): number {
    const self = this.getLatest();
    return self.__indent;
  }
  getDirection(): 'ltr' | 'rtl' | null {
    const self = this.getLatest();
    return self.__dir;
  }
  getTextFormat(): number {
    const self = this.getLatest();
    return self.__format;
  }
  getClassName(): string {
    const self = this.getLatest();
    return self.__className;
  }
  hasFormat(type: ElementFormatType): boolean {
    if (type !== '') {
      const formatFlag = ELEMENT_TYPE_TO_FORMAT[type];
      return (this.getFormat() & formatFlag) !== 0;
    }
    return false;
  }
  hasTextFormat(type: TextFormatType): boolean {
    const formatFlag = TEXT_TYPE_TO_FORMAT[type];
    return (this.getTextFormat() & formatFlag) !== 0;
  }
  /**
   * Returns the format flags applied to the node as a 32-bit integer.
   *
   * @returns a number representing the TextFormatTypes applied to the node.
   */
  getFormatFlags(type: TextFormatType, alignWithFormat: null | number): number {
    const self = this.getLatest();
    const format = self.__format;
    return toggleTextFormatType(format, type, alignWithFormat);
  }

  setDirection(direction: 'ltr' | 'rtl' | null): this {
    const self = this.getWritable();
    self.__dir = direction;
    return self;
  }
  setFormat(type: ElementFormatType): this {
    const self = this.getWritable();
    self.__format = type !== '' ? ELEMENT_TYPE_TO_FORMAT[type] : 0;
    return this;
  }
  setTextFormat(type: number): this {
    const self = this.getWritable();
    self.__format = type;
    return self;
  }
  setTextStyle(style: string): this {
    const self = this.getWritable();
    self.__style = style;
    return self;
  }
  setIndent(indentLevel: number): this {
    const self = this.getWritable();
    self.__indent = indentLevel;
    return this;
  }
  setStyle(style: string): this {
    const self = this.getWritable();
    self.__style = style || '';
    return this;
  }
  setClassName(className?: string) {
    const self = this.getWritable();
    self.__className = className || '';
    return this;
  }

  getTextContent(): string {
    return '';
  }
}

export function $isTextDecoratorNode<T>(
  node: LexicalNode | null | undefined,
): node is TextDecoratorNode<T> {
  return node instanceof TextDecoratorNode;
}

function getElementOuterTag(
  node: TextDecoratorNode<unknown>,
  format: number,
): string | null {
  if (format & IS_CODE) {
    return 'code';
  }
  if (format & IS_HIGHLIGHT) {
    return 'mark';
  }
  if (format & IS_SUBSCRIPT) {
    return 'sub';
  }
  if (format & IS_SUPERSCRIPT) {
    return 'sup';
  }
  return null;
}

function getElementInnerTag(
  node: TextDecoratorNode<unknown>,
  format: number,
): string {
  if (format & IS_BOLD) {
    return 'strong';
  }
  if (format & IS_ITALIC) {
    return 'em';
  }
  return 'span';
}

function setTextThemeClassNames(
  tag: string,
  prevFormat: number,
  nextFormat: number,
  dom: HTMLElement,
  textClassNames: TextNodeThemeClasses,
): void {
  const domClassList = dom.classList;
  // Firstly we handle the base theme.
  let classNames = getCachedClassNameArray(textClassNames, 'base');
  if (classNames !== undefined) {
    domClassList.add(...classNames);
  }
  // Secondly we handle the special case: underline + strikethrough.
  // We have to do this as we need a way to compose the fact that
  // the same CSS property will need to be used: text-decoration.
  // In an ideal world we shouldn't have to do this, but there's no
  // easy workaround for many atomic CSS systems today.
  classNames = getCachedClassNameArray(
    textClassNames,
    'underlineStrikethrough',
  );
  let hasUnderlineStrikethrough = false;
  const prevUnderlineStrikethrough =
    prevFormat & IS_UNDERLINE && prevFormat & IS_STRIKETHROUGH;
  const nextUnderlineStrikethrough =
    nextFormat & IS_UNDERLINE && nextFormat & IS_STRIKETHROUGH;

  if (classNames !== undefined) {
    if (nextUnderlineStrikethrough) {
      hasUnderlineStrikethrough = true;
      if (!prevUnderlineStrikethrough) {
        domClassList.add(...classNames);
      }
    } else if (prevUnderlineStrikethrough) {
      domClassList.remove(...classNames);
    }
  }

  for (const key in TEXT_TYPE_TO_FORMAT) {
    const format = key;
    const flag = TEXT_TYPE_TO_FORMAT[format];
    classNames = getCachedClassNameArray(textClassNames, key);
    if (classNames !== undefined) {
      if (nextFormat & flag) {
        if (
          hasUnderlineStrikethrough &&
          (key === 'underline' || key === 'strikethrough')
        ) {
          if (prevFormat & flag) {
            domClassList.remove(...classNames);
          }
          continue;
        }
        if (
          (prevFormat & flag) === 0 ||
          (prevUnderlineStrikethrough && key === 'underline') ||
          key === 'strikethrough'
        ) {
          domClassList.add(...classNames);
        }
      } else if (prevFormat & flag) {
        domClassList.remove(...classNames);
      }
    }
  }
}

function createTextInnerDOM(
  innerDOM: HTMLElement,
  node: TextDecoratorNode<unknown>,
  innerTag: string,
  format: number,
  config: EditorConfig,
): void {
  const theme = config.theme;
  // Apply theme class names
  const textClassNames = theme.text;

  if (textClassNames !== undefined) {
    setTextThemeClassNames(innerTag, 0, format, innerDOM, textClassNames);
  }
}
