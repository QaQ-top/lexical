/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import react from '@vitejs/plugin-react';
import {codeInspectorPlugin} from 'code-inspector-plugin';
import path from 'node:path';
import {defineConfig} from 'vite';
import VitePluginStyleInject from 'vite-plugin-style-inject';

import viteMonorepoResolutionPlugin from '../shared/lexicalMonorepoPlugin';
import esbuildDevGlobalModule from './esbuild-dev-global-module';
import viteGlobalImport from './vite-global-import';
import viteCopyEsm from './viteCopyEsm';
import viteCopyExcalidrawAssets from './viteCopyExcalidrawAssets';

const isDebug = Boolean(process.env.NODE_DEBUG);

// https://vitejs.dev/config/
export default defineConfig(({mode}) => ({
  base: isDebug ? '/richTextEditor' : undefined,
  build: {
    lib: {
      entry: path.resolve(__dirname, './index.js'),
      fileName: (format) => `index.${format}.mjs`,
      formats: ['es', 'umd', 'cjs'],
      name: 'index',
    },
    rollupOptions: {
      assetFileNames: '[name].[ext]',
      external: ['react', 'react-dom'],
      input: {
        main: './src/index.ts', // 这里的 './src/main.js' 是你想要打包的入口文件路径
      },
      output: {
        dir: 'lib',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
  define: {
    VITE_IS_DEVELOPMENT: JSON.stringify(mode === 'development'),
  },
  optimizeDeps: {
    esbuildOptions: {
      plugins: isDebug
        ? [
            ...(esbuildDevGlobalModule(mode, ['react', 'react-dom', 'antd'])
              ?.plugins || []),
          ]
        : undefined,
      target: 'es2022',
      treeShaking: true,
    },
  },
  plugins: [
    mode === 'development' ? viteMonorepoResolutionPlugin() : null,
    mode === 'development'
      ? codeInspectorPlugin({
          bundler: 'vite',
        })
      : null,
    isDebug ? viteGlobalImport(mode, ['react', 'react-dom', 'antd']) : null,
    babel({
      babelHelpers: 'bundled',
      babelrc: false,
      configFile: false,
      exclude: '/**/node_modules/**',
      extensions: ['jsx', 'js', 'ts', 'tsx', 'mjs'],
      plugins: [
        // '@babel/plugin-transform-flow-strip-types',
        // ...(mode !== 'production'
        //   ? [
        //       [
        //         require('../../scripts/error-codes/transform-error-messages'),
        //         {
        //           noMinify: true,
        //         },
        //       ],
        //     ]
        //   : []),
      ],
      presets: [['@babel/preset-react', {runtime: 'automatic'}]],
    }),
    react(),
    ...viteCopyExcalidrawAssets(),
    viteCopyEsm(),
    commonjs({
      // This is required for React 19 (at least 19.0.0-beta-26f2496093-20240514)
      // because @rollup/plugin-commonjs does not analyze it correctly
      strictRequires: [/\/node_modules\/(react-dom|react)\/[^/]\.js$/],
    }),
    VitePluginStyleInject(),
  ],
  resolve: {
    alias: {
      './const.less': `${path.resolve(__dirname, '../../')}/const.less`,
    },
  },
  server: {
    cors: true,
  },
}));
