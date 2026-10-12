# Asset credits

## The place (real data)

| Asset | Source | License |
| --- | --- | --- |
| `riffelalp/polar.bin`, `riffelalp/local.bin` (elevation) | swisstopo **swissALTI3D** (2 m) around camp and the Matterhorn; [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) elsewhere | **© swisstopo** (free geodata, attribution required); Terrain Tiles: see [attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md) |
| `riffelalp/ortho.jpg`, `riffelalp/trees_*.bin` | swisstopo **SWISSIMAGE** orthophoto (WMTS), resampled; tree positions classified from it | **© swisstopo** |
| `riffelalp/normals.jpg`, `riffelalp/sunshadow*.png` | derived from the elevation data above | **© swisstopo** |

All of it is baked by [`scripts/build-terrain.mjs`](../../scripts/build-terrain.mjs): camp at
46.00065° N, 7.74672° E (a meadow clearing below Riffelalp, 2,110 m), terrain out to 26 km.

## Textures, models, sky (Poly Haven, CC0)

| Asset | Source |
| --- | --- |
| `sky/golden_2k.hdr` | [syferfontein_6d_clear_puresky](https://polyhaven.com/a/syferfontein_6d_clear_puresky) |
| `ground/meadow_*` | [grass_ground](https://polyhaven.com/a/grass_ground) |
| `ground/needles_*` | [forrest_ground_03](https://polyhaven.com/a/forrest_ground_03) |
| `fir/twig_*`, `fir/bark_*` | [fir_tree_01](https://polyhaven.com/a/fir_tree_01) |
| `pine/twig_*` | [pine_tree_01](https://polyhaven.com/a/pine_tree_01) |
| `fir/log_*` | [pine_bark](https://polyhaven.com/a/pine_bark) |
| `rocks/rock_07`, `rocks/rock_09` | [rock_07](https://polyhaven.com/a/rock_07), [rock_09](https://polyhaven.com/a/rock_09) |
| `firepit/*` | [stone_fire_pit](https://polyhaven.com/a/stone_fire_pit) |
| `fabric/*` | [polar_fleece](https://polyhaven.com/a/polar_fleece), [caban](https://polyhaven.com/a/caban) |
