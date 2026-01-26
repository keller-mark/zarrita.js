import type { AbsolutePath, AsyncReadable, RangeQuery } from "@zarrita/storage";
import { registry } from "./codecs.js";
import type {
	ArrayMetadata,
	ArrayMetadataV2,
	CodecMetadata,
	DataType,
} from "./metadata.js";
import {
	json_decode_object,
	json_encode_object,
	v2_to_v3_array_metadata,
} from "./util.js";

function get_prefix(key: string): string | undefined {
	for (const suffix of ["/zarr.json", "/.zarray"]) {
		if (key.endsWith(suffix)) {
			// key=/foo/bar/zarr.json -> prefix=/foo/bar
			// key=.zarray -> prefix=""
			return key.slice(0, -suffix.length);
		}
	}
}

function range_slice(data: Uint8Array, range: RangeQuery): Uint8Array {
	if ("suffixLength" in range) {
		return data.slice(-range.suffixLength);
	}
	const offset = range.offset ?? 0;
	const length = range.length;
	const end = length !== undefined ? offset + length : undefined;
	return data.slice(offset, end);
}

// Helper to identify and strip bytes-to-bytes codecs (compressors)
// returns the "peeled" codecs list (for client) and "codecs to decode" (for store)
async function split_codecs(
	meta: ArrayMetadata<DataType>,
): Promise<{ client_codecs: CodecMetadata[]; decode_codecs: CodecMetadata[] }> {
	const all_codecs = meta.codecs;
	let split_idx = all_codecs.length;

	// Iterate backwards to find the sequence of bytes-to-bytes codecs
	for (let i = all_codecs.length - 1; i >= 0; i--) {
		const c = all_codecs[i];
		const entry = await registry.get(c.name)?.();
		if (!entry) break; // Unknown codec, stop peeling
		// We need to instantiate to check 'kind' reliably as per current codecs.ts implementation
		const codec = entry.fromConfig(c.configuration, {
			data_type: meta.data_type,
			shape: meta.chunk_grid.configuration.chunk_shape,
			codecs: meta.codecs,
		});

		if (
			codec.kind === "array_to_array" ||
			codec.kind === "array_to_bytes"
		) {
			break;
		}
		split_idx = i;
	}

	return {
		client_codecs: all_codecs.slice(0, split_idx),
		decode_codecs: all_codecs.slice(split_idx),
	};
}

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
	#metadata_cache = new Map<string, ArrayMetadata<DataType>>();

	constructor(store: AsyncReadable) {
		this.#inner_store = store;
	}

	#resolve_metadata(key: string): ArrayMetadata<DataType> | undefined {
		let best_prefix = "";
		let best_meta: ArrayMetadata<DataType> | undefined;

		for (const [prefix, meta] of this.#metadata_cache) {
			// Check if key is a descendant of prefix.
			// Path Logic:
			//   prefix="/foo", key="/foo/c/0/0" -> match
			//   prefix="", key="0.0" -> match (for root array v2)
			//   prefix="/", key="/0.0" -> match
			//   prefix="/foo", key="/foobar/..." -> no match
			if (key.startsWith(prefix)) {
				const rest = key.slice(prefix.length);
				if (
					rest.length === 0 ||
					rest.startsWith("/") ||
					rest.startsWith(".") ||
					prefix === "/" ||
					prefix === ""
				) {
					// Found a valid prefix match. Keep the longest one.
					if (prefix.length >= best_prefix.length) {
						best_prefix = prefix;
						best_meta = meta;
					}
				}
			}
		}
		return best_meta;
	}

	async get(key: AbsolutePath): Promise<Uint8Array | undefined> {
		const prefix = get_prefix(key);
		if (prefix !== undefined) {
			// Is metadata file
			const bytes = await this.#inner_store.get(key);
			if (!bytes) return undefined;

			if (key.endsWith(".zarray")) {
				// V2
				const meta: ArrayMetadataV2 = json_decode_object(bytes);
				this.#metadata_cache.set(prefix, v2_to_v3_array_metadata(meta));
				const { compressor, filters, ...rest } = meta;
				return json_encode_object({
					...rest,
					compressor: null, // Removed
					filters: filters, // Kept
				});
			}

			if (key.endsWith("zarr.json")) {
				// V3
				const meta: ArrayMetadata<DataType> = json_decode_object(bytes);
				if (meta.node_type === "array") {
					this.#metadata_cache.set(prefix, meta);
					const { client_codecs } = await split_codecs(meta);
					return json_encode_object({
						...meta,
						codecs: client_codecs,
					});
				}
				// Pass through group metadata
				return bytes;
			}
		}

		// Try to find array metadata for this chunk
		const meta = this.#resolve_metadata(key);
		if (meta) {
			const { decode_codecs } = await split_codecs(meta);
			if (decode_codecs.length > 0) {
				let data = await this.#inner_store.get(key);
				if (!data) return undefined;

				// Decode using the identified bytes-to-bytes codecs (in reverse order of application during encode,
				// but here we have them in metadata order... wait.
				// Metadata order: [filters, compressor].
				// Encode: filter -> compressor.
				// Decode: compressor -> filter.
				// split_codecs returns the tail of the list.
				// e.g. [A, B, C, D] where C, D are bytes-to-bytes.
				// decode_codecs = [C, D].
				// Decode order should be D -> C.
				for (let i = decode_codecs.length - 1; i >= 0; i--) {
					const c = decode_codecs[i];
					const entry = await registry.get(c.name)?.();
					if (entry) {
						const codec = entry.fromConfig(c.configuration, {
							data_type: meta.data_type,
							shape: meta.chunk_grid.configuration.chunk_shape,
							codecs: meta.codecs,
						});
						// We know it is bytes_to_bytes from split_codecs check
						data = await codec.decode(data);
					}
				}
				return data;
			}
		}

		// Fallback: just return what we find (chunk without compression, or unknown file)
		return this.#inner_store.get(key);
	}

	async getRange(
		key: AbsolutePath,
		range: RangeQuery,
	): Promise<Uint8Array | undefined> {
		const data = await this.get(key);
		if (!data) return undefined;
		return range_slice(data, range);
	}
}

export default DecompressionStore;
