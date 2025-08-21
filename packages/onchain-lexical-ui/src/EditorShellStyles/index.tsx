/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import * as React from 'react';

import Styles from './index.module.less';

const EditorShellStyles: React.FC<{
  children: React.ReactNode;
}> = ({children}) => {
  return (
    <div className={`${Styles['editor-shell']} editor-shell`}>{children}</div>
  );
};

export default EditorShellStyles;
