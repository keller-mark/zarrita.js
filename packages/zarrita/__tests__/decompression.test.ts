import * as path from "node:path";
import * as url from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FetchStore } from "@zarrita/storage";
import FileSystemStore from "@zarrita/storage/fs";
import DecompressionStore from "../src/decompression-store.js";
import * as zarr from "../src/index.js";
import { get } from "../src/indexing/ops.js";
import { range } from "../src/indexing/util.js";

let __dirname = path.dirname(url.fileURLToPath(import.meta.url));

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
			    },
			  ],
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

async function get_v2(
	abs_path: `/${string}`,
	...args: unknown[]
): Promise<zarr.Chunk<zarr.DataType>> {
	let root = path.resolve(__dirname, "../../../fixtures/v2/data.zarr");
	let inner_store = new FileSystemStore(root);
	let store = new DecompressionStore(inner_store)
	let store_root = zarr.root(store);

	// Verify metadata - compressor should be null
	let meta_bytes = await store_root
		.resolve(abs_path)
		.resolve(".zarray")
		.store.get(store_root.resolve(abs_path).resolve(".zarray").path);
	if (!meta_bytes) throw new Error("Metadata not found");
	let meta = JSON.parse(new TextDecoder().decode(meta_bytes));
	expect(meta.compressor).toBeNull();

	// Verify that inner_store and DecompressionStore returned data is different.
	let chunk_path: `/${string}` | undefined;
	if (abs_path.startsWith("/1d") && !abs_path.includes("raw")) {
		chunk_path = `${abs_path}/0`;
	} else if(abs_path.startsWith("/2d") && !abs_path.includes("raw")) {
		chunk_path = `${abs_path}/0.0`
	}
	if (chunk_path !== undefined) {
		let inner_bytes = await inner_store.get(chunk_path);
		let decompressed_bytes = await store.get(chunk_path);
		if(inner_bytes !== undefined && decompressed_bytes !== undefined) {
			expect(Array.from(inner_bytes)).not.toEqual(Array.from(decompressed_bytes));
		}
	}

	let arr = await zarr.open.v2(store_root.resolve(abs_path), { kind: "array" });
	// @ts-expect-error - TS not happy about spreading these args and its fine for this func
	return get(arr, ...args);
}

describe("DecompressionStore - get v2", () => {
	it("1d.contiguous.zlib.i2", async () => {
		expect(await get_v2("/1d.contiguous.zlib.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.blosc.i2", async () => {
		expect(await get_v2("/1d.contiguous.blosc.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.lz4.i2", async () => {
		expect(await get_v2("/1d.contiguous.lz4.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.zstd.i2", async () => {
		expect(await get_v2("/1d.contiguous.zstd.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.raw.i2", async () => {
		expect(await get_v2("/1d.contiguous.raw.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.i4", async () => {
		expect(await get_v2("/1d.contiguous.i4")).toMatchInlineSnapshot(`
			{
			  "data": Int32Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.u1", async () => {
		expect(await get_v2("/1d.contiguous.u1")).toMatchInlineSnapshot(`
			{
			  "data": Uint8Array [
			    255,
			    0,
			    255,
			    0,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.f4.le", async () => {
		expect(await get_v2("/1d.contiguous.f4.le")).toMatchInlineSnapshot(`
			{
			  "data": Float32Array [
			    -1000.5,
			    0,
			    1000.5,
			    0,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.f4.be", async () => {
		expect(await get_v2("/1d.contiguous.f4.be")).toMatchInlineSnapshot(`
			{
			  "data": Float32Array [
			    -1000.5,
			    0,
			    1000.5,
			    0,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.f8", async () => {
		expect(await get_v2("/1d.contiguous.f8")).toMatchInlineSnapshot(`
			{
			  "data": Float64Array [
			    1.5,
			    2.5,
			    3.5,
			    4.5,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.contiguous.U13.le", async () => {
		let res = await get_v2("/1d.contiguous.U13.le");
		expect(res.data).toBeInstanceOf(zarr.UnicodeStringArray);
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.U13.be", async () => {
		let res = await get_v2("/1d.contiguous.U13.be");
		expect(res.data).toBeInstanceOf(zarr.UnicodeStringArray);
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.U7", async () => {
		let res = await get_v2("/1d.contiguous.U7");
		expect(res.data).toBeInstanceOf(zarr.UnicodeStringArray);
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.S7", async () => {
		let res = await get_v2("/1d.contiguous.S7");
		expect(res.data).toBeInstanceOf(zarr.ByteStringArray);
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.b1", async () => {
		let res = await get_v2("/1d.contiguous.b1");
		expect(res).toMatchInlineSnapshot(`
			{
			  "data": BoolArray {},
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
		expect(Array.from(res.data)).toStrictEqual([true, false, true, false]);
	});

	it("2d.contiguous.i2", async () => {
		expect(await get_v2("/2d.contiguous.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    2,
			    2,
			  ],
			  "stride": [
			    2,
			    1,
			  ],
			}
		`);
	});

	it("3d.contiguous.i2", async () => {
		expect(await get_v2("/3d.contiguous.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    0,
			    1,
			    2,
			    3,
			    4,
			    5,
			    6,
			    7,
			    8,
			    9,
			    10,
			    11,
			    12,
			    13,
			    14,
			    15,
			    16,
			    17,
			    18,
			    19,
			    20,
			    21,
			    22,
			    23,
			    24,
			    25,
			    26,
			  ],
			  "shape": [
			    3,
			    3,
			    3,
			  ],
			  "stride": [
			    9,
			    3,
			    1,
			  ],
			}
		`);
	});

	it("1d.chunked.i2", async () => {
		expect(await get_v2("/1d.chunked.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    4,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("1d.chunked.ragged.i2", async () => {
		expect(await get_v2("/1d.chunked.ragged.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			    5,
			  ],
			  "shape": [
			    5,
			  ],
			  "stride": [
			    1,
			  ],
			}
		`);
	});

	it("2d.chunked.i2", async () => {
		expect(await get_v2("/2d.chunked.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			  ],
			  "shape": [
			    2,
			    2,
			  ],
			  "stride": [
			    2,
			    1,
			  ],
			}
		`);
	});

	it("2d.chunked.U7", async () => {
		let res = await get_v2("/2d.chunked.U7");
		expect(Array.from(res.data)).toStrictEqual(["a", "b", "cc", "d"]);
		expect(res.shape).toStrictEqual([2, 2]);
	});

	it("2d.chunked.ragged.i2", async () => {
		expect(await get_v2("/2d.chunked.ragged.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    1,
			    2,
			    3,
			    4,
			    5,
			    6,
			    7,
			    8,
			    9,
			  ],
			  "shape": [
			    3,
			    3,
			  ],
			  "stride": [
			    3,
			    1,
			  ],
			}
		`);
	});

	it("3d.chunked.i2", async () => {
		expect(await get_v2("/3d.chunked.i2")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    0,
			    1,
			    2,
			    3,
			    4,
			    5,
			    6,
			    7,
			    8,
			    9,
			    10,
			    11,
			    12,
			    13,
			    14,
			    15,
			    16,
			    17,
			    18,
			    19,
			    20,
			    21,
			    22,
			    23,
			    24,
			    25,
			    26,
			  ],
			  "shape": [
			    3,
			    3,
			    3,
			  ],
			  "stride": [
			    9,
			    3,
			    1,
			  ],
			}
		`);
	});

	it("3d.chunked.mixed.i2.C", async () => {
		expect(await get_v2("/3d.chunked.mixed.i2.C")).toMatchInlineSnapshot(`
			{
			  "data": Int16Array [
			    0,
			    1,
			    2,
			    3,
			    4,
			    5,
			    6,
			    7,
			    8,
			    9,
			    10,
			    11,
			    12,
			    13,
			    14,
			    15,
			    16,
			    17,
			    18,
			    19,
			    20,
			    21,
			    22,
			    23,
			    24,
			    25,
			    26,
			  ],
			  "shape": [
			    3,
			    3,
			    3,
			  ],
			  "stride": [
			    9,
			    3,
			    1,
			  ],
			}
		`);
	});

	it("3d.chunked.mixed.i2.F", async () => {
		let res = await get_v2("/3d.chunked.mixed.i2.F");
		// biome-ignore format: the array should not be formatted
		expect(res.data).toStrictEqual(new Int16Array([
			0, 9, 18, 3, 12, 21, 6, 15, 24,
			1, 10, 19, 4, 13, 22, 7, 16, 25,
			2, 11, 20, 5, 14, 23, 8, 17, 26,
		]));
		expect(res.shape).toStrictEqual([3, 3, 3]);
		expect(res.stride).toStrictEqual([1, 3, 9]);
	});

	it("3d.chunked.O", async () => {
		let arr = await get_v2("/3d.chunked.O");
		expect(arr).toStrictEqual({
			data: ["a", "aa", "aaa", "aaaa", "b", "bb", "bbb", "bbbb"],
			shape: [2, 2, 2],
			stride: [4, 2, 1],
		});
	});
});

async function get_v3(
	abs_path: string,
	...args: unknown[]
): Promise<zarr.Chunk<zarr.DataType>> {
	let root = path.resolve(__dirname, "../../../fixtures/v3/data.zarr");
	let inner_store = new FileSystemStore(root);
	let store = zarr.root(new DecompressionStore(inner_store));

	// Verify metadata - codecs should not contain compressors
	let meta_bytes = await store
		.resolve(abs_path)
		.resolve("zarr.json")
		.store.get(store.resolve(abs_path).resolve("zarr.json").path);
	if (!meta_bytes) throw new Error("Metadata not found");
	let meta = JSON.parse(new TextDecoder().decode(meta_bytes));

	let compressors = ["gzip", "blosc", "zstd", "lz4"];
	let codec_names = meta.codecs.map((c: any) => c.name);
	for (const c of codec_names) {
		expect(compressors).not.toContain(c);
	}

	let arr = await zarr.open.v3(store.resolve(abs_path), { kind: "array" });
	// @ts-expect-error - TS not happy about spreading these args
	return get(arr, ...args);
}

describe("DecompressionStore - get v3", () => {
	it("1d.contiguous.gzip.i2", async () => {
		let res = await get_v3("/1d.contiguous.gzip.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.blosc.i2", async () => {
		let res = await get_v3("/1d.contiguous.blosc.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.raw.i2", async () => {
		let res = await get_v3("/1d.contiguous.raw.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.i4", async () => {
		let res = await get_v3("/1d.contiguous.i4");
		expect(res.data).toStrictEqual(new Int32Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.u1", async () => {
		let res = await get_v3("/1d.contiguous.u1");
		expect(res.data).toStrictEqual(new Uint8Array([255, 0, 255, 0]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.f4.le", async () => {
		let res = await get_v3("/1d.contiguous.f4.le");
		expect(res.data).toStrictEqual(new Float32Array([-1000.5, 0, 1000.5, 0]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.f4.be", async () => {
		let res = await get_v3("/1d.contiguous.f4.be");
		expect(res.data).toStrictEqual(new Float32Array([-1000.5, 0, 1000.5, 0]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.f8", async () => {
		let res = await get_v3("/1d.contiguous.f8");
		expect(res.data).toStrictEqual(new Float64Array([1.5, 2.5, 3.5, 4.5]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.contiguous.b1", async () => {
		let res = await get_v3("/1d.contiguous.b1");
		expect(res.data).toBeInstanceOf(zarr.BoolArray);
		expect(Array.from(res.data as zarr.BoolArray)).toStrictEqual([
			true,
			false,
			true,
			false,
		]);
		expect(res.shape).toStrictEqual([4]);
	});

	it("2d.contiguous.i2", async () => {
		let res = await get_v3("/2d.contiguous.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([2, 2]);
	});

	it("3d.contiguous.i2", async () => {
		let res = await get_v3("/3d.contiguous.i2");
		expect(res.data).toStrictEqual(new Int16Array(range(27)));
		expect(res.shape).toStrictEqual([3, 3, 3]);
	});

	it("1d.chunked.i2", async () => {
		let res = await get_v3("/1d.chunked.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([4]);
	});

	it("1d.chunked.ragged.i2", async () => {
		let res = await get_v3("/1d.chunked.ragged.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4, 5]));
		expect(res.shape).toStrictEqual([5]);
	});

	it("2d.chunked.i2", async () => {
		let res = await get_v3("/2d.chunked.i2");
		expect(res.data).toStrictEqual(new Int16Array([1, 2, 3, 4]));
		expect(res.shape).toStrictEqual([2, 2]);
	});

	it("2d.chunked.ragged.i2", async () => {
		let res = await get_v3("/2d.chunked.ragged.i2");
		expect(res.data).toStrictEqual(new Int16Array(range(1, 10)));
		expect(res.shape).toStrictEqual([3, 3]);
	});

	it("3d.chunked.i2", async () => {
		let res = await get_v3("/3d.chunked.i2");
		expect(res.data).toStrictEqual(new Int16Array(range(27)));
		expect(res.shape).toStrictEqual([3, 3, 3]);
	});

	it("3d.chunked.mixed.i2.C", async () => {
		let res = await get_v3("/3d.chunked.mixed.i2.C");
		expect(res.data).toStrictEqual(new Int16Array(range(27)));
		expect(res.shape).toStrictEqual([3, 3, 3]);
		expect(res.stride).toStrictEqual([9, 3, 1]);
	});

	it("3d.chunked.mixed.i2.F", async () => {
		let res = await get_v3("/3d.chunked.mixed.i2.F");
		// biome-ignore format: the array should not be formatted
		expect(res.data).toStrictEqual(new Int16Array([
			0, 9, 18, 3, 12, 21, 6, 15, 24,
			1, 10, 19, 4, 13, 22, 7, 16, 25,
			2, 11, 20, 5, 14, 23, 8, 17, 26,
		]));
		expect(res.shape).toStrictEqual([3, 3, 3]);
		expect(res.stride).toStrictEqual([1, 3, 9]);
	});
});
