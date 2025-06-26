/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * 用于国际化的文本格式化处理
 */
export function t(strTemp: string, obj?: object) {
  if (!obj) {
    return strTemp;
  }

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const reg = new RegExp(`{(${key})+}`, 'g');
      strTemp = strTemp.replace(reg, (obj as Record<string, string>)[key]);
    }
  }
  return strTemp;
}

/**
 * 国际化-根据pathCode从用户的languageMap查询对应文本
 */
export const getI18nText = (
  languageMap?: Record<string, string | undefined>,
  pathCode?: string,
  placeholder?: string,
) => {
  if (languageMap && pathCode) {
    return languageMap[pathCode] || placeholder;
  }

  return placeholder;
};
/** 处理国际化模板的基础方法 */
export function baseTemplate(
  LanguageMap: Record<string, string>,
  ...params: TranslateI18nParams
) {
  const [key, extra] = params;
  return t(
    getI18nText(LanguageMap, key, extra.placeholder) || '',
    extra.variate,
  );
}
/**
 * 初始化国际化函数 从LanguageMap(Record<string, string>)上获取到字符串模板，生成对应语言
 * ```javascript
 * initTranslateI18nFn((...params) => {
 *  return baseTemplate(LanguageMap, ...params)
 * })
 * ```
 */
export function initTranslateI18nFn(
  fn: (...params: TranslateI18nParams) => string,
) {
  window.translateI18n = fn;
}

export function translateI18n(...params: TranslateI18nParams) {
  if (window.translateI18n) {
    return window.translateI18n(...params);
  } else {
    return baseTemplate({}, ...params);
  }
}
