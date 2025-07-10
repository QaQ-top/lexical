/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import {
  $createInstanceEquationNode,
  $isInstanceEquationNode,
  InstanceEquationNode,
} from 'onchain-lexical-instance';

import {
  MultilineElementTransformer,
  TextMatchTransformer,
} from '../MarkdownTransformers';

export const EQUATION: TextMatchTransformer = {
  dependencies: [InstanceEquationNode],
  export: (node) => {
    if (!$isInstanceEquationNode(node)) {
      return null;
    }
    if (node.__inline) {
      return `$${node.getEquation()}$`;
    } else {
      return `$$\n${node.getTextContent()}\n$$`;
    }
  },
  importRegExp: /\$([^$]+?)\$/,
  regExp: /\$([^$]+?)\$$/,
  replace: (textNode, match) => {
    const [, equation] = match;
    const equationNode = $createInstanceEquationNode(equation, true);
    textNode.replace(equationNode);
  },
  trigger: '$',
  type: 'text-match',
};

export const BLOCK_EQUATION: MultilineElementTransformer = {
  dependencies: [InstanceEquationNode],
  export: (node) => {
    if (!$isInstanceEquationNode(node)) {
      return null;
    }
    if (node.__inline) {
      return `$${node.getEquation()}$`;
    } else {
      return `$$\n${node.getTextContent()}\n$$`;
    }
  },
  regExpEnd: {
    optional: true,
    regExp: /[\u0020\t]*\$\$$/,
  },
  regExpStart: /^[\u0020\t]*\$\$(\u0020*)?/,
  replace: (
    rootNode,
    children,
    startMatch,
    endMatch,
    linesInBetween,
    isImport,
  ) => {
    if (linesInBetween) {
      const node = $createInstanceEquationNode(
        linesInBetween.join('\n').trim(),
      );
      rootNode.append(node);
    } else {
      rootNode.append($createInstanceEquationNode(''));
    }
  },
  type: 'multiline-element',
};
