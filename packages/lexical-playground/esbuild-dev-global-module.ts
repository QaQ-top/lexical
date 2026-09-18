/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import ReactDom from 'react-dom';
import {DepOptimizationOptions} from 'vite';

import {getModuleName} from './vite-global-import';

const Modules: Record<string, any> = {
  React,
  ReactDOM: ReactDom,
  ReactDom,
};

export default (
  mode: string,
  externals: string[],
): DepOptimizationOptions['esbuildOptions'] => {
  const isDevelopment = mode === 'development';
  if (isDevelopment) {
    return {
      plugins: isDevelopment
        ? externals.map((name) => {
            const pluginsName = `dev-global-${name}`;
            return {
              name: pluginsName,
              setup(build) {
                build.onResolve({filter: new RegExp(`^${name}$`)}, (args) => ({
                  namespace: pluginsName,
                  path: args.path,
                }));
                build.onLoad({filter: /.*/, namespace: pluginsName}, (args) => {
                  const module = getModuleName(name);
                  // 指定 externals 排除打包的模块为 使用时实际的 window 上挂载的模块
                  return {
                    contents: `
                     ${Object.entries(Modules[module])
                       .map(
                         ([key]) => `const ${key} = window.${module}.${key};`,
                       )
                       .join('')}
                    export {
                    ${Object.entries(Modules[module])
                      .map(([key]) => `${key},`)
                      .join('')}
                    }
                    export default window.${module};
                  `,
                    loader: 'js',
                  };
                });
              },
            };
          })
        : [],
    };
  } else {
    return {
      plugins: [],
    };
  }
};
