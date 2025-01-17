# @zarrita/indexing

## 0.1.0-next.9

### Patch Changes

- Updated dependencies [[`b90f16b77bc665d21f572b0790d1a0070d709f41`](https://github.com/manzt/zarrita.js/commit/b90f16b77bc665d21f572b0790d1a0070d709f41)]:
  - @zarrita/core@0.1.0-next.7

## 0.1.0-next.8

### Patch Changes

- Updated dependencies [[`dad2e4e40509f53ffd25ff44f6454776fd52d723`](https://github.com/manzt/zarrita.js/commit/dad2e4e40509f53ffd25ff44f6454776fd52d723)]:
  - @zarrita/core@0.1.0-next.6

## 0.1.0-next.7

### Minor Changes

- feat: Add `withConsolidated` store utility ([#119](https://github.com/manzt/zarrita.js/pull/119))

  **BREAKING**: Replaces [`openConsolidated`](https://github.com/manzt/zarrita.js/pull/91)
  to provide a consistent interface for accessing consolidated and non-consolidated stores.

  ```javascript
  import * as zarr from "zarrita";

  // non-consolidated
  let store = new zarr.FetchStore("https://localhost:8080/data.zarr");
  let grp = await zarr.open(store); // network request for .zgroup/.zattrs
  let foo = await zarr.open(grp.resolve("/foo"), { kind: array }); // network request for .zarray/.zattrs

  // consolidated
  let store = new zarr.FetchStore("https://localhost:8080/data.zarr");
  let consolidatedStore = await zarr.withConsolidated(store); // opens ./zmetadata
  let contents = consolidatedStore.contents(); // [ {path: "/", kind: "group" }, { path: "/foo", kind: "array" }, ...]
  let grp = await zarr.open(consolidatedStore); // no network request
  let foo = await zarr.open(grp.resolve(contents[1].path), {
    kind: contents[1].kind,
  }); // no network request
  ```

### Patch Changes

- Updated dependencies [[`191d95c77d2c7902344cd0175ae0044f740d19ba`](https://github.com/manzt/zarrita.js/commit/191d95c77d2c7902344cd0175ae0044f740d19ba), [`4d177d825f7bc241e0906a1b2890cad93f22d8a6`](https://github.com/manzt/zarrita.js/commit/4d177d825f7bc241e0906a1b2890cad93f22d8a6)]:
  - @zarrita/core@0.1.0-next.5

## 0.1.0-next.6

### Patch Changes

- Updated dependencies [[`e542463`](https://github.com/manzt/zarrita.js/commit/e5424632a6fb69f87308f075b822a0d0ac675577)]:
  - @zarrita/typedarray@0.1.0-next.2
  - @zarrita/core@0.1.0-next.4

## 0.1.0-next.5

### Minor Changes

- feat: Remove `.indices` methods from `Slice` interface ([#121](https://github.com/manzt/zarrita.js/pull/121))

  By making `Slice` a more minimal interface, it is easy to allow compatability with ZarrJS `slice`
  (or slices not generated by the `slice` helper function).

## 0.1.0-next.4

### Patch Changes

- Updated dependencies [[`29ef4b5`](https://github.com/manzt/zarrita.js/commit/29ef4b5771744e116aa5a33a3e0cad744877de88)]:
  - @zarrita/storage@0.1.0-next.3
  - @zarrita/core@0.1.0-next.3

## 0.1.0-next.3

### Patch Changes

- Updated dependencies [[`3ec6538`](https://github.com/manzt/zarrita.js/commit/3ec6538d308198f6d0ad256c308013d17fd120dd)]:
  - @zarrita/storage@0.1.0-next.2
  - @zarrita/core@0.1.0-next.2

## 0.1.0-next.2

### Patch Changes

- Add licenses and READMES to packages ([#107](https://github.com/manzt/zarrita.js/pull/107))

- Updated dependencies [[`9b76a33`](https://github.com/manzt/zarrita.js/commit/9b76a331605be7d7d53188c069cf2dbb8463baec)]:
  - @zarrita/typedarray@0.1.0-next.1
  - @zarrita/storage@0.1.0-next.1
  - @zarrita/core@0.1.0-next.1

## 0.1.0-next.1

### Patch Changes

- feat: generalize chunk-indexing/slicing operations ([#103](https://github.com/manzt/zarrita.js/pull/103))

  Refactors the internals of `get`/`set` to operate on the raw 1D "bytes" for decompressed chunks.

## 0.1.0-next.0

### Minor Changes

- chore: prepare preleases ([`fa43aff`](https://github.com/manzt/zarrita.js/commit/fa43aff50e65ef4b05b9d67d56de2d1b9c5104a5))

### Patch Changes

- Updated dependencies [[`fa43aff`](https://github.com/manzt/zarrita.js/commit/fa43aff50e65ef4b05b9d67d56de2d1b9c5104a5)]:
  - @zarrita/core@0.1.0-next.0
  - @zarrita/storage@0.1.0-next.0
  - @zarrita/typedarray@0.1.0-next.0

## 0.0.3

### Patch Changes

- feat: Support `VLenUTF8` codec in v2 and introduce a strided JS "object" Array. ([#96](https://github.com/manzt/zarrita.js/pull/96))

  ```python
  import zarr
  import numcodecs

  zarr.create_dataset(
      "data.zarr",
      data=np.array(
          [[["a", "aa"], ["aaa", "aaaa"]],
          [["b", "bb"], ["bbb", "bbbb"]]],
          dtype=object
      ),
      dtype="|O",
      object_codec=numcodecs.VLenUTF8(),
      chunks=(1, 1, 2),
  )
  ```

  ```typescript
  import * as zarr from "zarrita";

  let store = zarr.FetchStore("http://localhost:8080/data.zarr");
  let arr = await zarr.open.v2(store, { kind: "array" });
  let result = zarr.get(arr);
  // {
  //   data: ["a", "aa", "aaa", "aaaa", "b", "bb", "bbb", "bbbb"],
  //   shape: [2, 2, 2],
  //   stride: [4, 2, 1],
  // }
  ```

- Updated dependencies [[`97e7df1`](https://github.com/manzt/zarrita.js/commit/97e7df188efa5e6ef343edca35c3d16862149920)]:
  - @zarrita/core@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies [[`6e7df4f`](https://github.com/manzt/zarrita.js/commit/6e7df4fe887cabae81e4e0e842628894082d9c27), [`89a2744`](https://github.com/manzt/zarrita.js/commit/89a27449076c63d176695e53e72bedfb97160f19), [`b90fd33`](https://github.com/manzt/zarrita.js/commit/b90fd339c748084caeccfed017accbcebc7cbafe)]:
  - @zarrita/core@0.0.2
  - @zarrita/storage@0.0.2

## 0.0.1

### Patch Changes

- feat: prefer camelCase for public API ([#83](https://github.com/manzt/zarrita.js/pull/83))

- feat: Support v2 string data types with builtin indexing ([#75](https://github.com/manzt/zarrita.js/pull/75))

- Updated dependencies [[`a2ab3b0`](https://github.com/manzt/zarrita.js/commit/a2ab3b0396096246bd73c923628b64d29175eca9), [`eee6a0e`](https://github.com/manzt/zarrita.js/commit/eee6a0ee80a045efb7bbcb8d6a96740ec8f3ea95), [`0f37caa`](https://github.com/manzt/zarrita.js/commit/0f37caa89a125c92e8d8b812acb2b79b2cb257e8)]:
  - @zarrita/core@0.0.1
  - @zarrita/typedarray@0.0.1
  - @zarrita/storage@0.0.1
