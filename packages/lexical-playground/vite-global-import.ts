/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {type Plugin} from 'vite';
/* eslint-disable no-useless-escape */

const generateWindowImportRegex = (moduleName: string) => {
  return new RegExp(
    `(import)([\s\w\,{}]*)(from)\s*(['"]${moduleName}['"])`,
    'g',
  );
};

export const getModuleName = (name: string) => {
  name = name
    .split('-')
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join('');
  if (name === 'ReactDom') {
    return 'ReactDOM';
  }
  return name;
};

function replace(moduleName: string[], code: string) {
  moduleName.forEach((name) => {
    const regex = generateWindowImportRegex(name);
    if (regex.test(code)) {
      name = getModuleName(name);
      code = code.replace(regex, (substring, $1, $2: string) => {
        const [a, b] = $2.split(/\,(.*)\{/);
        return `const ${a} = window.${name}; ${
          b?.trim() ? `const {${b} = window.${name};` : ''
        }`;
      });
    }
  });
  return code;
}

export default function (mode: string, externals: string[]): Plugin | null {
  const isDevelopment = mode === 'development';
  return isDevelopment
    ? {
        enforce: 'pre',
        name: 'vite-plugin-global-import',
        transform(code, id, ssr) {
          return replace(externals, code);
        },
      }
    : null;
}
