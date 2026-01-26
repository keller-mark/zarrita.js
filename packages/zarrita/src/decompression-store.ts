import type { AbsolutePath, AsyncReadable, RangeQuery } from "@zarrita/storage";
import { create_codec_pipeline } from "./codecs.js";


/**
 * Readonly store which decompresses data.
 *
 * ```typescript
 * import * as zarr from "zarrita";
 * const store = new DecompressionStore("http://localhost:8080/data.zarr");
 * const arr = await zarr.get(store, { kind: "array" });
 * ```
 */
class DecompressionStore implements AsyncReadable {

    #inner_store: AsyncReadable;

    constructor(
        public store: AsyncReadable,
    ) {
        this.#inner_store = store;
    }

    async get(
        key: AbsolutePath,
    ): Promise<Uint8Array | undefined> {
        // TODO: implement decompression logic.
        // Return the post-decompression data.
        // For `.zarray` and `zarr.json` metadata requests,
        // return modified metadata to indicate that the data is being returned without compression,
        // so it does not need to be decompressed again.
        // References:
        // - `packages/zarrita/src/codecs.ts`
        return this.#inner_store.get(key);
    }

    async getRange(
        key: AbsolutePath,
        range: RangeQuery,
    ): Promise<Uint8Array | undefined> {
        // TODO: implement decompression logic for ranged data.
        return this.#inner_store.getRange?.(key, range);
    }
}

export default DecompressionStore;
