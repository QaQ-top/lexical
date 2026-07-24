/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
declare module '*.less' {
  const styles: Record<string, string>;
  export default styles;
}

declare type TranslateI18nParams = [
  string,
  {
    variate?: object;
    placeholder?: string;
  },
];

interface Window {
  translateI18n: (...params: TranslateI18nParams) => string;
  PlaygroundNodes: Array<Klass<LexicalNode>>;
}

interface BaseComponentProps<T = unknown> {
  className?: string;
  children?: React.ReactNode;
  id?: string;
  ref?: React.Ref<T>;
  style?: React.CSSProperties;
}
// 补充缺失的全局类型
declare type TranslateI18nParams = Record<string, any>;

interface Window {
  translateI18n: (params: TranslateI18nParams) => string;
}

// 扩展 HTMLElement 的 onbeforematch 属性（用于 collapsible）
interface HTMLElement {
  onbeforematch: ((this: HTMLElement, ev: Event) => any) | null;
}

// 声明 CSS 模块
declare module '*.module.less' {
  const classes: { readonly [key: string]: string };
  export default classes;
}