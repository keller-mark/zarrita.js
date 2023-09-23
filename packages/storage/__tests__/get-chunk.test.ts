import { afterEach, describe, expect, it, vi } from "vitest";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as url from "node:url";

// @ts-ignore
import { ObjectStore, openArray, slice as oldSlice } from 'zarr';
import { root, open } from '@zarrita/core';
import { slice, get } from '@zarrita/indexing';
import FileSystemStore from "../src/fs.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const store_path = path.join(__dirname, "../../../fixtures/lowerlimb.zarr");

class ZarrJSFileSystemStore extends ObjectStore {

    zarritaStore: FileSystemStore;

    constructor(storePath: string) {
        super();
        this.zarritaStore = new FileSystemStore(storePath);
    }

    async getItem(key: any) {
        return this.zarritaStore.get(`/${key}`);
    }
    async containsItem(item: any): Promise<boolean> {
        return this.zarritaStore.has(`/${item}`);
    }

    async setItem(key: any, value: any) {
        return this.zarritaStore.set(`/${key}`, value);
    }
}

// References:
// - https://github.com/vitessce/vitessce/blob/1402a2d87ac564908207560d09d944c5ccbcd4c8/packages/utils/zarr-utils/src/adapter.ts#L47
// - https://github.com/hms-dbmi/viv/blob/662c8417c489fe3197e4e68776c2d8dd8f37f979/packages/loaders/src/zarr/pixel-source.ts#L38

describe("Comparison of zarr.js getRawChunk and zarrita.js getChunk", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("zarr.js getRawChunk matches zarrita.js getChunk for every image tile in resolution 2", async () => {
		const newStoreRoot = root(new FileSystemStore(store_path));
        const newArr = await open(newStoreRoot.resolve('images/region_raw_image/2'), { kind: "array" }); // Resolution 2

        const oldStore = new ZarrJSFileSystemStore(store_path);
        const oldArr = await openArray({ store: oldStore, mode: "r", path: 'images/region_raw_image/2' }); // Resolution 2

        const oldShape = oldArr.shape;
        const newShape = newArr.shape;

        expect(oldShape).toEqual(newShape);

        const numChunks = newShape.map((d, i) => Math.ceil(d / newArr.chunks[i]));

        let chunkCoords;
        let oldChunk;
        let newChunk;
        // For loop over all possible chunk coords
        for(let zCoord = 0; zCoord < numChunks[0]; zCoord++) {
            for(let yCoord = 0; yCoord < numChunks[1]; yCoord++) {
                for(let xCoord = 0; xCoord < numChunks[2]; xCoord++) {
                    chunkCoords = [zCoord, yCoord, xCoord];
                    oldChunk = await oldArr.getRawChunk(chunkCoords);
                    newChunk = await newArr.getChunk(chunkCoords);
                    expect(oldChunk.data).toEqual(newChunk.data);
                }
            }
        }

        chunkCoords = [0, 0, 0];
        oldChunk = await oldArr.getRawChunk(chunkCoords);
        newChunk = await newArr.getChunk(chunkCoords);
        expect(oldChunk.shape).toEqual(newChunk.shape); // AssertionError: expected [ 256, 256 ] to deeply equal [ 1, 256, 256 ]
	}, 50000);

    it("zarr.js getRaw matches zarrita.js get for every image tile in resolution 2", async () => {
        const newStoreRoot = root(new FileSystemStore(store_path));
        const newArr = await open(newStoreRoot.resolve('images/region_raw_image/2'), { kind: "array" }); // Resolution 2

        const oldStore = new ZarrJSFileSystemStore(store_path);
        const oldArr = await openArray({ store: oldStore, mode: "r", path: 'images/region_raw_image/2' }); // Resolution 2

        const oldShape = oldArr.shape;
        const newShape = newArr.shape;

        expect(oldShape).toEqual(newShape);

        const numChunks = newShape.map((d, i) => Math.ceil(d / newArr.chunks[i]));

        const width = newShape[2];
        const height = newShape[1];
        const tileSize = 256;

        let x = numChunks[2] - 3;
        let y = numChunks[1] - 1;
        const [xStart, xStop] = [
            x * tileSize,
            Math.min((x + 1) * tileSize, width)
        ];
        const [yStart, yStop] = [
            y * tileSize,
            Math.min((y + 1) * tileSize, height)
        ];

        let oldSelection: any = [0, oldSlice(yStart, yStop), oldSlice(xStart, xStop)];
        let newSelection: any = [0, slice(yStart, yStop), slice(xStart, xStop)];

        let oldChunk;
        let newChunk;
        // TODO: For loop over all possible selections
        oldChunk = await oldArr.getRaw(oldSelection);
        newChunk = await get(newArr, newSelection);
        expect(oldChunk.data).toEqual(newChunk.data);
        expect(oldChunk.shape).toEqual(newChunk.shape);


        // Next, test with null selection
        oldSelection = null;
        newSelection = [null, null, null];
        oldChunk = await oldArr.getRaw(oldSelection);
        newChunk = await get(newArr, newSelection);
        expect(oldChunk.data).toEqual(newChunk.data);
        expect(oldChunk.shape).toEqual(newChunk.shape);
    }, 50000);


});
