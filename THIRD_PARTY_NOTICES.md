# Third-party code and data

Nextgen eVTOL uses the following libraries. Their licenses remain in force; notices copied from installed packages are shipped under `public/licenses/` during build.

| Component | License | Source |
| --- | --- | --- |
| CesiumJS | Apache-2.0 | https://github.com/CesiumGS/cesium |
| Resium | MIT | https://github.com/reearth/resium |
| React / React DOM | MIT | https://github.com/facebook/react |
| Lucide React | ISC | https://github.com/lucide-icons/lucide |
| Vite | MIT | https://github.com/vitejs/vite |
| pngjs (data preparation only) | MIT | https://github.com/pngjs/pngjs |

Flight3DView (https://github.com/TioRuben/Flight3DView, MIT, reviewed commit 931bd6499586a88739435b462b8e1cbe95406ef8) informed the architecture and camera/playback design. No source files from that repository are copied. Frame smoothing uses elapsed time, rather than a constant per-frame interpolation factor.

## Geographic data

- **© OpenStreetMap contributors**: https://www.openstreetmap.org/copyright. The derived database `public/geo/hk-buildings.json`, and OSM-derived building obstacle coordinates in `backend/data/hong-kong.json`, are made available under **Open Database License (ODbL) 1.0**: https://opendatacommons.org/licenses/odbl/1-0/. The included data is the modified extract in the form used by the application. Source way IDs are retained. Footprints are simplified only by omission of unclosed or out-of-area features; missing heights are estimated. The extraction script is included. This is not a complete Hong Kong building survey.
- **Mapzen Terrain Tiles**, accessed via AWS Open Data: https://registry.opendata.aws/terrain-tiles/ and https://github.com/tilezen/joerd/blob/master/docs/attribution.md. Hong Kong region was resampled from zoom 11 Terrarium tiles. Derived height grid is in `public/geo/hk-terrain.bin`; its metadata and bounds are adjacent. Source terrain comes from the datasets described by Mapzen (including SRTM in this region); no HKPD vertical datum calibration has been performed. Retain source attribution when reusing the grid.
- **Esri World Imagery** is requested at runtime through the public ArcGIS MapServer. Imagery is not bundled or relicensed by this repository. Cesium displays Esri's provider credits; use is subject to the service's terms and availability: https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer .
- Hong Kong Lands Department 3D data is identified as a future integration source; **it is not bundled or used in the current scene**. The documented API requires an authorized key. https://3d.map.gov.hk/api/swaggerui?api=3d_bit00_api

The NG-01 aircraft mesh, conceptual terminals, and simplified landmark silhouettes are original procedural assets. They are not models of a certified aircraft or real planned vertiports.

## Fonts

Space Grotesk, Noto Sans SC, and IBM Plex Mono are requested through Google Fonts with local system fallbacks; these fonts are distributed by their authors under the SIL Open Font License. No font binaries are checked into this repository.

No license is granted here for original project source beyond any license explicitly provided by its owner. Third-party and open-data licenses above remain independent.
