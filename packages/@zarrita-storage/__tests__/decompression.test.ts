import { afterEach, describe, expect, it, vi } from "vitest";

import FetchStore from "../src/fetch.js";
import DecompressionStore from "../src/decompression.js";

// `vitest --api` exposes the port 51204
// ref: https://vitest.dev/config/#api
let href = "http://localhost:51204/fixtures/v3/data.zarr";

describe("DecompressionStore", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("reads a file from string url", async () => {
		let inner_store = new FetchStore(href);
        let store = new DecompressionStore(inner_store);
		let bytes = await store.get("/zarr.json");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "consolidated_metadata": null,
			  "node_type": "group",
			  "zarr_format": 3,
			}
		`);
	});

	it("reads data when path contains spaces", async () => {
		let inner_store = new FetchStore(href);
        let store = new DecompressionStore(inner_store);
		let bytes = await store.get("/my group with spaces/zarr.json");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
			  "attributes": {
			    "description": "A group with spaces in the name",
			  },
			  "consolidated_metadata": null,
			  "node_type": "group",
			  "zarr_format": 3,
			}
		`);
	});

	it("reads a file from URL", async () => {
		let inner_store = new FetchStore(new URL(href));
        let store = new DecompressionStore(inner_store);
		let bytes = await store.get("/zarr.json");
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "consolidated_metadata": null,
			  "node_type": "group",
			  "zarr_format": 3,
			}
		`);
	});

	it("reads multi-part path", async () => {
		let inner_store = new FetchStore(href);
        let store = new DecompressionStore(inner_store);
		let bytes = await store.get("/1d.chunked.i2/zarr.json");
		expect(bytes).toBeInstanceOf(Uint8Array);
        // Note that in `codecs` there is only `bytes` codec, no BLOSC compression codec.
		expect(JSON.parse(new TextDecoder().decode(bytes))).toMatchInlineSnapshot(`
			{
			  "attributes": {},
			  "chunk_grid": {
			    "configuration": {
			      "chunk_shape": [
			        2,
			      ],
			    },
			    "name": "regular",
			  },
			  "chunk_key_encoding": {
			    "configuration": {
			      "separator": "/",
			    },
			    "name": "default",
			  },
			  "codecs": [
			    {
			      "configuration": {
			        "endian": "little",
			      },
			      "name": "bytes",
			    }],
			  "data_type": "int16",
			  "dimension_names": null,
			  "fill_value": 0,
			  "node_type": "array",
			  "shape": [
			    4,
			  ],
			  "storage_transformers": [],
			  "zarr_format": 3,
			}
		`);
	});

	it("returns undefined for missing file", async () => {
		let inner_store = new FetchStore(href);
        let store = new DecompressionStore(inner_store);
		expect(await store.get("/some/random/file/missing.duh")).toBeUndefined();
	});

	it("reads partial - suffixLength", async () => {
		let inner_store = new FetchStore(href);
        let store = new DecompressionStore(inner_store);
		let bytes = await store.getRange("/zarr.json", { suffixLength: 50 });
		expect(new TextDecoder().decode(bytes)).toMatchInlineSnapshot(
			`
			"olidated_metadata": null,
			  "node_type": "group"
			}"
		`,
		);
	});

	it("reads partial - offset, length", async () => {
		let inner_store = new FetchStore(href);
        let store = new DecompressionStore(inner_store);
		let bytes = await store.getRange("/zarr.json", { offset: 4, length: 50 });
		expect(new TextDecoder().decode(bytes)).toMatchInlineSnapshot(
			`
			""attributes": {},
			  "zarr_format": 3,
			  "consolida"
		`,
		);
	});
});
