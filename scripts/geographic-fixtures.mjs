// Nodevision/scripts/geographic-fixtures.mjs
// This script emits tiny GeoTIFF and KML fixtures into a test-owned temporary directory.
import { writeFile,mkdir } from 'node:fs/promises';
import { rasterFixture } from '../ApplicationSystem/public/MetaWorld/Geographic/Fixtures.mjs';
const dir=process.argv[2];await mkdir(dir,{recursive:true});
await writeFile(dir+'/changed.tif',new Uint8Array(rasterFixture({point:true})));
await writeFile(dir+'/dem.tif',new Uint8Array(rasterFixture()));await writeFile(dir+'/cover.tif',new Uint8Array(rasterFixture({category:true})));
const polygon=biome=>`<Placemark><name>${biome}</name><ExtendedData><Data name="biome"><value>${biome}</value></Data></ExtendedData><Polygon><outerBoundaryIs><LinearRing><coordinates>23.04,39.34 23.06,39.34 23.06,39.36 23.04,39.36 23.04,39.34</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
await writeFile(dir+'/regions.kml',`<kml xmlns="http://www.opengis.net/kml/2.2"><Document>${polygon('temperate')}${polygon('phrygana')}</Document></kml>`);
