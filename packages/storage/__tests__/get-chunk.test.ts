import { afterEach, describe, expect, it, vi } from "vitest";

// @ts-ignore
import { HTTPStore, openArray } from 'zarr';
import { root, open } from '@zarrita/core';
import { slice, get } from '@zarrita/indexing';
import FetchStore from "../src/fetch.js";

// `vitest --api` exposes the port 51204
// ref: https://vitest.dev/config/#api
let href = "http://localhost:51204/fixtures/lowerlimb.zarr";

// References:
// - https://github.com/vitessce/vitessce/blob/1402a2d87ac564908207560d09d944c5ccbcd4c8/packages/utils/zarr-utils/src/adapter.ts#L47
// - https://github.com/hms-dbmi/viv/blob/662c8417c489fe3197e4e68776c2d8dd8f37f979/packages/loaders/src/zarr/pixel-source.ts#L38

describe("Comparison of zarr.js getRawChunk and zarrita.js getChunk", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("zarr.js getRawChunk matches zarrita.js getChunk for every image tile in resolution 1", async () => {
        const oldStore = new HTTPStore(href);
        const oldArr = await openArray({ store: oldStore, path: 'images/region_raw_image/1' }); // Resolution 1


		const newStoreRoot = root(new FetchStore(href));
        const newArr = await open(newStoreRoot.resolve('images/region_raw_image/1'), { kind: "array" }); // Resolution 1

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
	});

    it("zarr.js getRaw matches zarrita.js get for every image tile in resolution 1", async () => {

    });


});
