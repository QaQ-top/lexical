## Base
### _isMoment
判断是否是Moment对象，并且不依赖moment包

```ts
_isMoment({}) // falsesd
_isMoment(Moment()) // truea
```

### makeDestructurable
优化返回值结构  
```ts
const params = makeDestructurable({
  name: 'AIC',
  age: 16
}, ['AIC', 16]);
const { name, age } = params;
const [name, age] = params;
```

### createEnumObject
创建一个对象枚举，主要用于解决真正的枚举导出类型和导出前枚举不相等的问题
```ts
createEnumObject({
  SET: 'SET',
  ADD: 'ADD',
  DELETE: 'DELETE',
  CLEAR: 'CLEAR',
})
```

### toRawType
接收任意数据，生成对应类型的字符串
```ts
toRawType(() => {}) // 'Function'
toRawType(new Map) //'Map'
toRawType({}) // 'Object'
toRawType([]) // 'Array'
toRawType(0) // 'Number'
```

### hasOwnProperty
判断对象是否存在某个属性
```ts
const data  = { name: 'aic' };
hasOwnProperty(data, 'name') // true
hasOwnProperty(data, 24) // false
```

### isEmptyObject
是否是空对象
```ts
isEmptyObject({}) // true,
isEmptyObject({name: 'aic'}) // false
```

### getHTMLTagString
接收一个对象 
- `type`: `string`；标签名称，例如：`div`或`a`或`span`...,
- `attributes`: `Record<string, any>`；html标签属性，例如：`{style:'color:#fff;font-size:12px !important;'}`
- `context`: `string`；标签内容。

返回html字符串
```ts
getHTMLTagString({
  type:"span", 
  attributes: {
    style:'color:#fff;font-size:12px !important;'
  }, 
  context: 'text'
}) // <span style="color:#fff;font-size:12px !important;">text</span>
```

### generateSecureUUID
生成UUID
```ts
generateSecureUUID() // 'a6ab72c0-31ab-49bb-a591-54f776c0b2d9'
```

## Base64
### getBase64Regular
生成base64匹配正则
```ts
const regular = getBase64Regular();
const png = `data:image/png;base64,iVBORwOKGgoAAA
ANSUhEUgAAALgA...whHJTEQgHn4pg1J8
1Av8HEfyAJO5uun8AAAAASUVORK5CYIl=`;
regular.test(png) // true
```

### base64ToMimeType
接收base64字符串，返回
- `mimeType`: `string`；MIME类型；例如："image/png"
- `suffix`: `string`；文件格式；例如："png"
- `type`: `string`；文件类型；例如："image"
```ts
const png = `data:image/png;base64,iVBORwOKGgoAAA
ANSUhEUgAAALgA...whHJTEQgHn4pg1J8
1Av8HEfyAJO5uun8AAAAASUVORK5CYIl=`;
base64ToMimeType(png); // { "mimeType":"image/png", "suffix":"png", "type":"image" }
```

### base64ToFile
接收对象
- `text`: `string`；base64字符串
- `type`: `string | undefined`；文件类型；例如："image"
- `filename`: `string | undefined`；自定义文件名称
- `suffix`: `string | undefined`；文件格式；例如："png"

返回`File`对象
```ts
const png = `data:image/png;base64,iVBORwOKGgoAAA
ANSUhEUgAAALgA...whHJTEQgHn4pg1J8
1Av8HEfyAJO5uun8AAAAASUVORK5CYIl=`;
base64ToFile({text: png}) // File {name: 'f37e4949-f912-45f8-abde-109aa8e60a28.undefined', lastModified: 1768899504506, lastModifiedDate: Tue Jan 20 2026 16:58:24 GMT+0800 (中国标准时间), webkitRelativePath: '', size: 9470, …};
```

### toBase64UTF8
接收任意值返回base64字符串
```ts
const element = document.createElement('equation');
const equation = toBase64UTF8(this.__equation);
element.setAttribute('data-lexical-equation', equation);
```

### fromBase64UTF8
接收base64字符串返回任意值
```ts
const element = document.createElement('equation');
const equation = toBase64UTF8(this.__equation);
element.setAttribute('data-lexical-equation', equation);
```

## Hooks
### reactive 
react响应式数据更新
#### useReactive
无限层次响应式代理, 包含`object`,`array`,`set`,`map`,`WeakMap`,`WeakSet`
```tsx
const Dome = () => {
  const store = useReactive({
    name: 'aic',
    age: 12,
    set: new Set,
    map: new Map,
    list: [{hobby: 'play game'}, {hobby: ''}]
  })
  return <div onClick={() => {
    store.age++ // 更新渲染
    store.list[1].hobby = 'play basketball' // 更新渲染
  }}>
    <span>{store.name}</span>
    {store.list.map(({ hobby }) => <span>{hobby}</span>)}
  </div>
}
```

#### useShallowReactive
单层对象响应式代理
```tsx
const Dome = () => {
  const store = useShallowReactive({
    name: 'aic',
    age: 12,
    set: new Set,
    map: new Map,
    list: [{hobby: 'play game'}, {hobby: ''}]
  })
  return <div onClick={() => {
    store.age++ // 更新渲染
    store.list[1].hobby = 'play basketball' // 不会触发渲染
  }}>
    <span>{store.name}</span>
    {store.list.map(({ hobby }) => <span>{hobby}</span>)}
  </div>
}
```

#### protection
在代理的过程中用来保护某些属性不受响应式代理
```tsx
const Dome = () => {
  const store = useReactive({
    name: 'aic',
    age: 12,
    set: new Set,
    map: new Map,
    list: [protection({hobby: 'play game'}), {hobby: ''}]
  })
  return <div onClick={() => {
    store.list[0].hobby = '' // 不会触发渲染          
    store.list[1].hobby = 'play basketball' // 更新渲染
    store.set = protection(new Set); // 设置值的时候进行保护
    store.set.add('1') // 不会触发渲染
  }}>
    <span>{store.name}</span>
    {store.list.map(({ hobby }) => <span>{hobby}</span>)}
  </div>
}
```

#### toRaw
接收一个代理对象，返回这个对象的原始对象，解决某些组件无法使用Proxy后的对象
```ts
const Table = ({list, setHobby}: {list: any[], setHobby: (params: any) => void) => {
  return list.map((item) => <span onClick={(item) => { item.hobby = 'init' }}>{item.hobby}</span>)
}

const Dome = () => {
  const store = useReactive({
    name: 'aic',
    age: 12,
    set: new Set,
    map: new Map,
    list: [{hobby: 'play game'}, {hobby: ''}]
  });
  return <Table list={toRaw(store.list)} setHobby={() => {}} />
}
```


#### toProxy
接收一个原始对象，返回这个对象的代理对象，解决转为原始对象后，修改数据无法更新渲染
```ts
const Table = ({list, setHobby}: {list: any[], setHobby: (params: any) => void) => {
  return list.map((item) => <span onClick={() => setHobby(item)}>{item.hobby}</span>)
}

const Dome = () => {
  const store = useReactive({
    name: 'aic',
    age: 12,
    set: new Set,
    map: new Map,
    list: [{hobby: 'play game'}, {hobby: ''}]
  });
  return <Table list={toRaw(store.list)} setHobby={(item) => {
    const hobby = toProxy(item);
    hobby = 'init'
  }} />
}
```

### useStore
简单的 react hook 状态管理器

```ts

const Dome = () => {
  const { store, setStore, resetStore, latestStore, setSilenceStore } = useStore(() => {
    return {
      name: 'aic',
      age: 12
    }
  });
  useEffect(() => {
    setStore({
      age: 24
    })
  }, []);
  // 使用
  return <div>{store.name}</div>
}

```
