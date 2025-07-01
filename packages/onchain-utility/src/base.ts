/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

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
export function hasOwnProperty<T>(data: T, key: string | symbol) {
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
