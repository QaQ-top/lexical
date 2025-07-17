/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export function _isMoment(obj: any) {
  return (
    obj != null &&
    typeof obj === 'object' &&
    // 检查内部标志
    obj._isAMomentObject === true &&
    // 检查特有方法
    typeof obj.format === 'function' &&
    typeof obj.add === 'function' &&
    // 检查内部属性
    '_d' in obj &&
    '_i' in obj
  );
}

export function makeDestructurable<
  T extends Record<string, unknown>,
  A extends readonly [any, ...any],
>(obj: T, arr: A): T & A {
  if (typeof Symbol !== 'undefined') {
    const clone = {...obj};
    Object.defineProperty(clone, Symbol.iterator, {
      enumerable: false,
      value() {
        let index = 0;
        return {
          next: () => ({
            done: index > arr.length,
            value: arr[index++],
          }),
        };
      },
    });

    return clone as T & A;
  } else {
    return Object.assign([...arr], obj) as unknown as T & A;
  }
}

export function createEnumObject<T extends string>(o: {[P in T]: P}) {
  return o;
}

export function toTypeString<T>(value: T): string {
  return Object.prototype.toString.call(value);
}
export function toRawType<T>(value: T): string {
  // 从字符串中提取“RawType”，如“[object RawType]”
  return toTypeString(value).slice(8, -1);
}
export function hasOwnProperty<T>(data: T, key: string | symbol | number) {
  return data && Object.prototype.hasOwnProperty.call(data, key);
}

export function isIntegerKey(key: unknown) {
  return (
    typeof key === 'string' &&
    key !== 'NaN' &&
    key[0] !== '-' &&
    '' + parseInt(key, 10) === key
  );
}
export function isEmptyObject(obj: object | undefined | null) {
  return obj ? !Object.keys(obj).length : true;
}

export function getHTMLTagString(params: {
  type: string;
  attributes?: Record<string, any>;
  context?: string;
}) {
  const attrsString = Object.entries(params.attributes || {})
    .map(([key, value]) => {
      return ` ${key}="${value}"`;
    })
    .join();
  return `<${params.type}${attrsString}>${params.context ?? ''}</${
    params.type
  }>`;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** 生成UUID */
export function generateSecureUUID() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);

    buffer[6] = (buffer[6] & 0x0f) | 0x40;
    buffer[8] = (buffer[8] & 0x3f) | 0x80;

    return Array.from(buffer)
      .map((b, i) => {
        return (
          (i === 4 || i === 6 || i === 8 || i === 10 ? '-' : '') +
          b.toString(16).padStart(2, '0')
        );
      })
      .join('');
  }

  return generateUUID();
}
