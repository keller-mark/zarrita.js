// @ts-check
import { KeyError } from './errors.js';
import { BasicIndexer } from './indexing.js';
import { create_queue } from './util.js';

/** @typedef {import('../types').DataType} DataType */
/** @typedef {import('../types').Store} Store */
/** @typedef {import('../types').ArraySelection} ArraySelection */

export const register = {
  /** @param {import('../types').BasicSetter<D>} setter */
  basic(setter) {
    /**
     * @template {DataType} D
     *
     * @param {import('./hierarchy').ZarrArray<D, Store>} arr
     * @param {ArraySelection} selection
     * @param {import('../types').GetOptions} opts
     */
    return function (arr, selection, opts = {}) {
      return get(setter, arr, selection, opts);
    };
  },
  /** @param {import('../types').NdArraySetter<D>} setter */
  ndarray(setter) {
    /**
     * @template {DataType} D
     *
     * @param {import('./hierarchy').ZarrArray<D, Store>} arr
     * @param {ArraySelection} selection
     * @param {import('../types').GetOptions} opts
     */
    return function (arr, selection, opts = {}) {
      return get(setter, arr, selection, opts);
    };
  },
};

const get_value = (/** @type {any} */ arr, /** @type {number} */ idx) => {
  return 'get' in arr ? arr.get(idx) : arr[idx];
};

/**
 * @template {DataType} D
 * @template {import('../types').NdArrayLike<D>} A
 *
 * @param {import('../types').Setter<D, A>} setter
 * @param {import('./hierarchy').ZarrArray<D, Store>} arr
 * @param {ArraySelection} selection
 * @param {import('../types').Options} opts
 * @returns {Promise<A | import('../types').Scalar<D>>}
 */
async function get(setter, arr, selection, opts) {
  const indexer = new BasicIndexer({ selection, shape: arr.shape, chunk_shape: arr.chunk_shape });
  // Setup output array
  const outsize = indexer.shape.reduce((a, b) => a * b, 1);
  const out = setter.prepare(new arr.TypedArray(outsize), indexer.shape);
  const queue = opts.create_queue ? opts.create_queue() : create_queue();

  // iterator over chunks
  for (const { chunk_coords, chunk_selection, out_selection } of indexer) {
    queue.add(() =>
      arr.get_chunk(chunk_coords)
        .then(({ data, shape }) => {
          const chunk = setter.prepare(data, shape);
          setter.set_from_chunk(out, out_selection, chunk, chunk_selection);
        })
        .catch((err) => {
          // re-throw error if not a missing chunk
          if (!(err instanceof KeyError)) throw err;
          // KeyError, we need to fill the corresponding array
          if (arr.fill_value) {
            setter.set_scalar(out, out_selection, arr.fill_value);
          }
        })
    );
  }

  await queue.onIdle();

  // If the final out shape is empty, we just return a scalar.
  return indexer.shape.length === 0 ? get_value(out.data, 0) : out;
}