/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import type {InternalSerializedNode} from 'lexical';

import {base64ToMimeType, getBase64Regular} from 'onchain-utility/base64';
import {asyncDfs} from 'onchain-utility/traversal';

import {InstanceConfig} from './types';

type Base64Src = string;
type NodeKey = string;

const uploadMap = new Map<
  Base64Src,
  {
    upload(): Promise<string[]>;
    result: Promise<string[]>;
  }
>();
const base64SrcMap = new Map<NodeKey, Base64Src>();

export function deleteUpload(nodeKey: string) {
  return base64SrcMap.delete(nodeKey);
}

export function getUpload(nodeKey: string) {
  const base64Src = base64SrcMap.get(nodeKey);
  if (base64Src) {
    return uploadMap.get(base64Src);
  } else {
    return undefined;
  }
}

export function hasUpload(nodeKey: string) {
  const base64Src = base64SrcMap.get(nodeKey);
  if (base64Src) {
    return uploadMap.has(base64Src);
  } else {
    return false;
  }
}

export function upload({
  nodeKey,
  src,
  hasError,
  uploadFiles,
}: {
  nodeKey: string;
  src: string;
  hasError?: boolean;
  uploadFiles: InstanceConfig['uploadFiles'];
}) {
  const {type, suffix} = base64ToMimeType(src);
  if (!hasError && type && suffix) {
    const _upload = () => {
      const result = uploadFiles([{suffix, text: src, type}]);
      base64SrcMap.set(nodeKey, src);
      uploadMap.set(src, {
        result,
        upload: _upload,
      });
      return result;
    };
    if (!uploadMap.has(src)) {
      _upload();
    } else {
      base64SrcMap.set(nodeKey, src);
    }
  }
}

export async function markdownBase64StringToUpLoadUrl(markdown: string) {
  const base64Regular = getBase64Regular();
  const base64List = Array.from(markdown.match(base64Regular) || []);
  for (const base64 of base64List) {
    if (uploadMap.has(base64)) {
      markdown = markdown.replace(
        base64,
        (await uploadMap.get(base64)!.result)[0],
      );
    }
  }
  return markdown;
}

export async function jsonBase64StringToUpLoadUrl(
  node: InternalSerializedNode,
) {
  await asyncDfs([node], async (node) => {
    const src = node.src;
    if (src && uploadMap.has(src)) {
      node.src = (await uploadMap.get(src)!.result)[0];
    }
    return node.children || [];
  });
  return node;
}
