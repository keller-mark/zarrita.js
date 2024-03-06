
### Sources of data
- https://github.com/TileDB-Inc/napari-tiledb-bioimg/tree/1a3a787/tests/rand_uint16.tdb
- https://github.com/single-cell-data/TileDB-SOMA/tree/29c55e1/apis/r/inst/extdata

### Resources
- https://github.com/TileDB-Inc/TileDB/tree/dev/format_spec
- https://tiledb.com/blog/tiledb-101-single-cell
- https://docs.tiledb.com/main/integrations-and-extensions/bioimaging#export-to-ome-formats
- https://tiledb.com/blog/a-deep-dive-into-the-tiledb-data-format-storage-engine
- https://github.com/TileDB-Inc/TileDB-CF-Py/blob/dev/examples/core/group-basics.ipynb
- https://docs.tiledb.com/main/how-to/object-management
- https://github.com/BiocPy/tiledbarray

#### Thoughts

TileDB relies on timestamps such that we cannot know the Zarr key(s) required to read a particular data element a-priori. Their cloud object storage support relies on using a "virtual file system" that requires s3::ListBucket permissions.

Zarr does not require ListBucket or any directory listing because the full keys are predictable. To get around this, we can require ReferenceSpec JSON to be generated and we may also want to require [fragment consolidation](https://docs.tiledb.com/main/background/key-concepts-and-data-format#fragment-metadata) so that data generated via multiple write operations do not require multiple reads

