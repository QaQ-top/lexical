/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {useContentEditable as useBaseContentEditable} from 'onchain-lexical-instance';

export {DisableSelector} from 'onchain-lexical-instance';

export default function useContentEditable() {
  return useBaseContentEditable();
}
