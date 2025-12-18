/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

import {generateSecureUUID} from '../base';

export function getBase64Regular() {
  return /data:(.+?)\/(.+?);base64,(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?/g;
}

export function base64ToMimeType(base64Src: string) {
  const regular = new RegExp(`^data:(.*?)/(.*?);base64`);
  const [, type, suffix] = base64Src.match(regular) || [];
  return {
    mimeType: `${type}/${suffix}`,
    suffix,
    type,
  };
}

/** base64 转 文件 */
export function base64ToFile({
  type,
  text,
  suffix,
  filename,
}: {
  text: string;
  type?: string;
  filename?: string;
  suffix?: string;
}) {
  const mimeType =
    type && suffix ? `${type}/${suffix}` : base64ToMimeType(text).mimeType;
  const base64WithoutPrefix = text.split(';base64,').pop()!;

  const byteCharacters = atob(base64WithoutPrefix);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, {type: mimeType});

  return new File([blob], `${filename || generateSecureUUID()}.${suffix}`, {
    type: mimeType,
  });
}

export function toBase64UTF8<T>(str: T): string {
  const bytes = new TextEncoder().encode(JSON.stringify(str));
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    '',
  );
  return btoa(binString);
}

export function fromBase64UTF8<T>(base64: string): T {
  const binString = atob(base64);
  const bytes = Uint8Array.from(binString, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
