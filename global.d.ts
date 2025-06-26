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
}
