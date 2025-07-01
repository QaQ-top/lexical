/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */

import {useCreation, useUpdate} from 'ahooks';
import {isMoment} from 'moment';
import {useRef} from 'react';

import {
  createEnumObject,
  hasOwnProperty,
  isIntegerKey,
  toRawType,
} from '../../base';

const ITERATE_KEY = Symbol('iterate');

const TargetType = createEnumObject({
  /** 集合 */
  COLLECTION: 'COLLECTION',
  /** 数组 */
  COMMON: 'COMMON',

  /** 无效的代理数据 */
  INVALID: 'INVALID',

  /** map */
  MAPPING: 'MAPPING',
});

function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON;
    case 'Map':
      return TargetType.MAPPING;
    case 'Set':
      return TargetType.COLLECTION;
    case 'WeakMap':
      return TargetType.MAPPING;
    case 'WeakSet':
      return TargetType.COLLECTION;
    default:
      return TargetType.INVALID;
  }
}

function getTargetType<T extends Record<string, any>>(value: T) {
  if (!Object.isExtensible(value)) {
    return TargetType.INVALID;
  }
  return targetTypeMap(toRawType(value));
}

const ReactiveFlags = createEnumObject({
  __MAP_SET: '__MAP_SET',
  __RAW: '__RAW',
});

export const TrackOpTypes = createEnumObject({
  GET: 'GET',
  HAS: 'HAS',
  ITERATE: 'ITERATE',
});

export const TriggerOpTypes = createEnumObject({
  ADD: 'ADD',
  CLEAR: 'CLEAR',
  DELETE: 'DELETE',
  SET: 'SET',
});

export type DebuggerEventExtraInfo = {
  target: object;
  key: any;
};

export type TrackDebuggerEventExtraInfo = {
  type: keyof typeof TrackOpTypes;
} & DebuggerEventExtraInfo;

export type TriggerDebuggerEventExtraInfo = {
  type: keyof typeof TriggerOpTypes;
  newValue?: any;
  oldValue?: any;
  oldTarget?: Map<any, any> | Set<any>;
} & DebuggerEventExtraInfo;

/** k:v 原对象:代理过的对象 */
const proxyMap = new WeakMap();
/** k:v 代理过的对象:原对象  */
const rawMap = new WeakMap();
/** v 禁止代理的数据 */
const protectionSet = new WeakSet();

/**
 * @description 保护数据 禁止代理
 * @date 2023-04-18 22:43:22
 * @export
 * @param {*} value
 * @returns {*}
 */
export function protection<S>(value: S): S {
  const data = value as any;
  const targetType = getTargetType(data);
  if (targetType !== TargetType.INVALID) {
    if (!protectionSet.has(data)) {
      protectionSet.add(data);
    }
  }
  return data;
}

/**
 * @description 预设保护对象
 * @date 2023-04-19 11:14:31
 * @template S
 * @param {S} value
 * @returns {*}  {boolean}
 */
function presetProtection<S>(value: S): boolean {
  if (isMoment(value)) {
    return true;
  }

  return false;
}

/**
 * @description 读取代理对象原始数据
 * @date 2023-04-18 22:43:40
 * @export
 * @template S
 * @param {S} state
 * @param {...any} params
 * @returns {*}  {S}
 */
export function toRaw<S>(state: S, ...params: any): S {
  if (rawMap.has(state as object)) {
    return rawMap.get(state as object);
  } else {
    return state;
  }
}

/**
 * @description 读取原始对象的代理数据
 * @date 2023-04-18 22:43:40
 * @export
 * @template S
 * @param {S} state
 * @param {...any} params
 * @returns {*}  {S}
 */
export function toProxy<S>(state: S, ...params: any): S {
  if (proxyMap.has(state as object)) {
    return proxyMap.get(state as object);
  } else {
    return state;
  }
}

/** 数组代理 */
function createArrayInstrumentations(
  cb: () => void,
  options?: WatchEffectOptions,
) {
  const instrumentations: Record<string, Function> = {};
  (['includes', 'indexOf', 'lastIndexOf'] as const).forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      const arr = toRaw(this) as any;
      for (let i = 0, l = this.length; i < l; i++) {
        // 监听读取
        options?.onTrack?.({
          key: i + '',
          target: arr,
          type: TrackOpTypes.GET,
        });
      }
      // 判断当前值是否存在原始对象中
      const res = arr[key](...args);
      if (res === -1 || res === false) {
        // 如果不存在再将函数参数（可能是响应式数据）转成原始值再执行一次
        return arr[key](...args.map(toRaw));
      } else {
        return res;
      }
    };
  });
  // 改变数组的函数，以避免长度被跟踪
  // 在某些情况下会导致无限循环
  (['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach((key) => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      // pauseTracking();
      const arr = toRaw(this) as any;
      const oldValue = [...arr];
      const res = arr[key].apply(this, args);
      // resetTracking();
      options?.onTrigger?.({
        key,
        oldValue: oldValue,
        target: arr,
        type: TriggerOpTypes.SET,
      });
      cb();
      return res;
    };
  });
  return instrumentations;
}

function getBaseHandlers(
  cb: () => void,
  shallow: boolean,
  options?: WatchEffectOptions,
): ProxyHandler<any> {
  const arrayInstrumentations = createArrayInstrumentations(cb, options);

  return {
    deleteProperty(target: object, key: string | symbol): boolean {
      const hadKey = hasOwnProperty(target, key);
      const oldValue = (target as any)[key];
      const result = Reflect.deleteProperty(target, key);
      if (result && hadKey) {
        cb();
        options?.onTrigger?.({
          key,
          newValue: undefined,
          oldValue,
          target,
          type: TriggerOpTypes.DELETE,
        });
      }
      return result;
    },

    get(target: object, key: string | symbol, receiver: object) {
      const targetIsArray = Array.isArray(target);

      if (targetIsArray && hasOwnProperty(arrayInstrumentations, key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }
      if (key === 'hasOwnProperty') {
        return hasOwnProperty.bind(null, target);
      }

      const res = Reflect.get(target, key, receiver);

      if (typeof key === 'symbol') {
        return res;
      }

      options?.onTrack?.({
        key,
        target,
        type: TrackOpTypes.GET,
      });

      if (shallow) {
        return res;
      }

      if (target !== null && typeof target === 'object') {
        // 代理深层数据
        return observer(res, cb, shallow, options);
      }

      return res;
    },

    has(target: object, key: string | symbol): boolean {
      const result = Reflect.has(target, key);
      if (typeof key !== 'symbol') {
        options?.onTrack?.({
          key,
          target,
          type: TrackOpTypes.HAS,
        });
      }
      return result;
    },
    ownKeys(target: object): (string | symbol)[] {
      options?.onTrack?.({
        key: Array.isArray(target) ? 'length' : ITERATE_KEY,
        target,
        type: TrackOpTypes.ITERATE,
      });
      return Reflect.ownKeys(target);
    },
    set(
      target: object,
      key: string | symbol,
      value: unknown,
      receiver: object,
    ): boolean {
      let oldValue = (target as any)[key];
      if (!shallow) {
        if (rawMap.has(value as object)) {
          oldValue = toRaw(oldValue);
          value = toRaw(value);
        }
      }

      const hadKey =
        Array.isArray(target) && isIntegerKey(key)
          ? Number(key) < target.length
          : hasOwnProperty(target, key);
      const result = Reflect.set(target, key, value, receiver);

      if (target === toRaw(receiver)) {
        if (!hadKey) {
          options?.onTrigger?.({
            key,
            newValue: value,
            target,
            type: TriggerOpTypes.ADD,
          });
        } else if (!Object.is(value, oldValue)) {
          options?.onTrigger?.({
            key,
            newValue: value,
            oldValue,
            target,
            type: TriggerOpTypes.SET,
          });
        }

        cb();
      }
      return result;
    },
  };
}

type IterableCollections = Map<any, any> | Set<any>;
type WeakCollections = WeakMap<any, any> | WeakSet<any>;
type MapTypes = Map<any, any> | WeakMap<any, any>;
type SetTypes = Set<any> | WeakSet<any>;
type CollectionTypes = IterableCollections | WeakCollections;

function getCollectionHandlers(
  cb: () => void,
  shallow: boolean,
  options?: WatchEffectOptions,
): ProxyHandler<any> {
  const {mutableInstrumentations, shallowInstrumentations} = proxySetMap()(
    observer,
    cb,
    options,
  );
  const instrumentations = shallow
    ? shallowInstrumentations
    : mutableInstrumentations;

  return {
    get: (
      target: CollectionTypes,
      key: string | symbol,
      receiver: CollectionTypes,
    ) => {
      if (key === ReactiveFlags.__MAP_SET) {
        return true;
      }
      if (key === ReactiveFlags.__RAW) {
        return target;
      }
      return Reflect.get(
        hasOwnProperty(instrumentations, key) && key in target
          ? instrumentations
          : target,
        key,
        receiver,
      );
    },
  };
}

/** set map 代理 */
function proxySetMap() {
  function getProto(rawTarget: object) {
    return Reflect.getPrototypeOf(rawTarget) as any;
  }

  function get(
    target: MapTypes,
    key: unknown,
    ob: typeof observer,
    cb: () => void,
    shallow: boolean,
    options?: WatchEffectOptions,
  ) {
    target = (target as any)[ReactiveFlags.__RAW];
    const rawTarget = toRaw(target);
    const rawKey = toRaw(key);
    if (key !== rawKey) {
      options?.onTrack?.({key, target: rawTarget, type: TrackOpTypes.GET});
    }
    options?.onTrack?.({
      key: rawKey,
      target: rawTarget,
      type: TrackOpTypes.GET,
    });
    const {has} = getProto(rawTarget);
    const wrap = (value: any) => {
      if (!shallow) {
        return ob(value, cb, shallow, options);
      } else {
        return value;
      }
    };
    if (has.call(rawTarget, key)) {
      return wrap(target.get(key));
    } else if (has.call(rawTarget, rawKey)) {
      return wrap(target.get(rawKey));
    } else if (target !== rawTarget) {
      // #3602 readonly(reactive(Map))
      // ensure that the nested reactive `Map` can do tracking for itself
      return target.get(key);
    }
  }

  function createHas(cb: () => void, options?: WatchEffectOptions) {
    return function has(
      this: CollectionTypes,
      key: unknown,
      options?: WatchEffectOptions,
    ): boolean {
      const target = (this as any)[ReactiveFlags.__RAW];
      const rawTarget = toRaw(target);
      const rawKey = toRaw(key);
      if (key !== rawKey) {
        options?.onTrack?.({key, target: rawTarget, type: TrackOpTypes.HAS});
      }
      options?.onTrack?.({
        key: rawKey,
        target: rawTarget,
        type: TrackOpTypes.HAS,
      });
      return key === rawKey
        ? target.has(key)
        : target.has(key) || target.has(rawKey);
    };
  }

  function size(target: IterableCollections, options?: WatchEffectOptions) {
    target = (target as any)[ReactiveFlags.__RAW];
    options?.onTrack?.({
      key: ITERATE_KEY,
      target: toRaw(target),
      type: TrackOpTypes.ITERATE,
    });
    return Reflect.get(target, 'size', target);
  }

  function createAdd(cb: () => void, options?: WatchEffectOptions) {
    return function add(this: SetTypes, value: unknown) {
      value = toRaw(value);
      const target = toRaw(this);
      const proto = getProto(target);
      const hadKey = proto.has.call(target, value);
      if (!hadKey) {
        target.add(value);
        cb();
        options?.onTrigger?.({
          key: value,
          newValue: value,
          target,
          type: TriggerOpTypes.ADD,
        });
      }
      return this;
    };
  }
  function createSet(cb: () => void, options?: WatchEffectOptions) {
    return function set(this: MapTypes, key: unknown, value: unknown) {
      value = toRaw(value);
      const target = toRaw(this);
      const {has, get} = getProto(target);

      let hadKey = has.call(target, key);
      if (!hadKey) {
        key = toRaw(key);
        hadKey = has.call(target, key);
      }

      const oldValue = get.call(target, key);
      target.set(key, value);
      if (!hadKey) {
        options?.onTrigger?.({
          key,
          newValue: value,
          target,
          type: TriggerOpTypes.ADD,
        });
      } else if (!Object.is(value, oldValue)) {
        options?.onTrigger?.({
          key,
          newValue: value,
          oldValue,
          target,
          type: TriggerOpTypes.SET,
        });
      }
      cb();
      return this;
    };
  }
  function createDeleteEntry(cb: () => void, options?: WatchEffectOptions) {
    return function deleteEntry(this: CollectionTypes, key: unknown) {
      const target = toRaw(this);
      const {has, get} = getProto(target);
      let hadKey = has.call(target, key);
      if (!hadKey) {
        key = toRaw(key);
        hadKey = has.call(target, key);
      }

      const oldValue = get ? get.call(target, key) : undefined;
      const result = target.delete(key);
      if (hadKey) {
        options?.onTrigger?.({
          key,
          oldValue,
          target,
          type: TriggerOpTypes.DELETE,
        });
      }
      cb();
      return result;
    };
  }

  function createClear(cb: () => void, options?: WatchEffectOptions) {
    return function clear(this: IterableCollections) {
      const target = toRaw(this);
      const hadItems = target.size !== 0;
      const oldTarget = isMap(target) ? new Map(target) : new Set(target);
      const result = target.clear();
      if (hadItems) {
        options?.onTrigger?.({
          key: undefined,
          oldTarget,
          target,
          type: TriggerOpTypes.CLEAR,
        });
      }
      cb();
      return result;
    };
  }

  function createForEach(
    ob: typeof observer,
    cb: () => void,
    shallow: boolean,
    options?: WatchEffectOptions,
  ) {
    return function forEach(
      this: IterableCollections,
      callback: Function,
      thisArg?: unknown,
    ) {
      const observed = this as any;
      const target = observed[ReactiveFlags.__RAW];
      const rawTarget = toRaw(target);
      const wrap = (value: any) => {
        if (!shallow) {
          return ob(value, cb, shallow, options);
        } else {
          return value;
        }
      };
      options?.onTrack?.({
        key: ITERATE_KEY,
        target: rawTarget,
        type: TrackOpTypes.ITERATE,
      });
      return target.forEach((value: unknown, key: unknown) => {
        return callback.call(thisArg, wrap(value), wrap(key), observed);
      });
    };
  }

  function isMap(map: any) {
    return map instanceof Map || map instanceof WeakMap;
  }

  interface Iterable {
    [Symbol.iterator](): Iterator;
  }

  interface Iterator {
    next(value?: any): IterationResult;
  }

  interface IterationResult {
    value: any;
    done: boolean;
  }

  function createIterableMethod(
    method: string | symbol,
    ob: typeof observer,
    cb: () => void,
    shallow: boolean,
    options?: WatchEffectOptions,
  ) {
    return function (
      this: IterableCollections,
      ...args: unknown[]
    ): Iterable & Iterator {
      const target = (this as any)[ReactiveFlags.__RAW];
      const rawTarget = toRaw(target);
      const targetIsMap = isMap(rawTarget);
      const isPair =
        method === 'entries' || (method === Symbol.iterator && targetIsMap);
      // const isKeyOnly = method === 'keys' && targetIsMap;
      const innerIterator = target[method](...args);
      const wrap = (value: any) => {
        if (!shallow) {
          return ob(value, cb, shallow, options);
        } else {
          return value;
        }
      };

      return {
        // iterator protocol
        next() {
          const {value, done} = innerIterator.next();
          return done
            ? {done, value}
            : {
                done,
                value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
              };
        },
        // iterable protocol
        [Symbol.iterator]() {
          return this;
        },
      };
    };
  }

  return function createInstrumentations(
    ob: typeof observer,
    cb: () => void,
    options?: WatchEffectOptions,
  ) {
    const mutableInstrumentations: Record<string, Function | number> = {
      add: createAdd(cb, options),
      clear: createClear(cb, options),
      delete: createDeleteEntry(cb, options),
      forEach: createForEach(ob, cb, false, options),
      get(this: MapTypes, key: unknown) {
        return get(this, key, ob, cb, false, options);
      },
      has: createHas(cb, options),
      set: createSet(cb, options),
      get size() {
        return size(this as unknown as IterableCollections, options);
      },
    };

    const shallowInstrumentations: Record<string, Function | number> = {
      add: createAdd(cb, options),
      clear: createClear(cb, options),
      delete: createDeleteEntry(cb, options),
      forEach: createForEach(ob, cb, true, options),
      get(this: MapTypes, key: unknown) {
        return get(this, key, ob, cb, true, options);
      },
      has: createHas(cb, options),
      set: createSet(cb, options),
      get size() {
        return size(this as unknown as IterableCollections, options);
      },
    };

    const iteratorMethods = ['keys', 'values', 'entries', Symbol.iterator];
    iteratorMethods.forEach((method) => {
      mutableInstrumentations[method as string] = createIterableMethod(
        method,
        ob,
        cb,
        false,
        options,
      );
      shallowInstrumentations[method as string] = createIterableMethod(
        method,
        ob,
        cb,
        true,
        options,
      );
    });

    return {mutableInstrumentations, shallowInstrumentations};
  };
}

export function observer<T extends Record<string, any>>(
  initialVal: T,
  cb: () => void,
  shallow: boolean,
  options?: WatchEffectOptions,
): T {
  // 过滤掉被保护的数据
  if (options?.protection && options.protection(initialVal)) {
    return initialVal;
  }
  if (presetProtection(initialVal)) {
    return initialVal;
  }
  if (protectionSet.has(initialVal)) {
    return initialVal;
  }

  const existingProxy = proxyMap.get(initialVal);
  // 添加缓存 防止重新构建proxy
  if (existingProxy) {
    return existingProxy;
  }

  // 防止代理已经代理过的对象
  if (rawMap.has(initialVal)) {
    return initialVal;
  }

  // 过滤代理
  const targetType = getTargetType(initialVal);
  if (targetType === TargetType.INVALID) {
    return initialVal;
  }

  const isSetMap =
    targetType === TargetType.MAPPING || targetType === TargetType.COLLECTION;

  const proxy = new Proxy(
    initialVal,
    isSetMap
      ? getCollectionHandlers(cb, shallow, options)
      : getBaseHandlers(cb, shallow, options),
  );

  proxyMap.set(initialVal, proxy);
  rawMap.set(proxy, initialVal);
  return proxy;
}

class UpdateTask {
  task = Promise.resolve();
  private readonly = false;
  addTask(fn: Function) {
    if (!this.readonly) {
      this.readonly = true;
      this.task.then(() => {
        fn();
        this.readonly = false;
      });
    }
  }
}

interface WatchEffectOptions {
  asyncOnceUpdate?: boolean;
  /** 是否需要保护（保护后不会被代理） */
  protection?: (value: unknown) => boolean;
  onTrack?: (event: TrackDebuggerEventExtraInfo) => void;
  onTrigger?: (event: TriggerDebuggerEventExtraInfo) => void;
}

export function useShallowReactive<S extends Record<string, any>>(
  initialState: S,
  options?: WatchEffectOptions,
): S {
  const update = useUpdate();
  const stateRef = useRef<S>(initialState);
  const updateTask = useRef(new UpdateTask());

  const state = useCreation(() => {
    return observer(
      stateRef.current,
      () => {
        if (options?.asyncOnceUpdate) {
          updateTask.current.addTask(update);
        } else {
          update();
        }
      },
      true,
      options,
    );
  }, []);

  return state;
}

export function useReactive<S extends Record<string, any>>(
  initialState: S,
  options?: WatchEffectOptions,
): S {
  const update = useUpdate();
  const stateRef = useRef<S>(initialState);
  const updateTask = useRef(new UpdateTask());

  const state = useCreation(() => {
    return observer(
      stateRef.current,
      () => {
        if (options?.asyncOnceUpdate) {
          updateTask.current.addTask(update);
        } else {
          update();
        }
      },
      false,
      options,
    );
  }, []);

  return state;
}
