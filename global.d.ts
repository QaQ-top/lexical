/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
// 把文件变成 module（顶部的 `export {};` 触发 TS 的 module 判定）。
// 但全局 augmentation 仍走真正的全局——见下面 `declare global` 的注释。
// bundle-types 把这个文件平铺进 lib/index.d.ts，entry 段的 `export {}`
// 已经让 bundle 整体是 module；如果这里不加 `export {};`，里面的
// `interface HTMLElement { ... }` 会以 module-local interface 形式
// shadow lib.dom 的 HTMLElement，消费方 IDE 导入后调用
// `HTMLElement.querySelectorAll` 会报"属性不存在"。
export {};

declare module '*.less' {
  const styles: Record<string, string>;
  export default styles;
}

declare module '*.module.less' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare global {
  // 历史遗留：translateI18n 实际调用存在两种参数形态（tuple 形式带
  // variate/placeholder、宽 Record 形式），合并为一个 union。
  type TranslateI18nParams =
    | [string, { variate?: object; placeholder?: string }]
    | Record<string, unknown>;

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

  // 扩展 HTMLElement 的 onbeforematch 属性（用于 collapsible）
  interface HTMLElement {
    onbeforematch: ((this: HTMLElement, ev: Event) => unknown) | null;
  }
}
