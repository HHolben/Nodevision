// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/KmlRegions.mjs
// This adapter reuses the editor KML parser and extracts only explicit polygon regions with holes, rejecting unsupported features rather than fetching external resources or inventing terrain.
import { parseKML, parseCoordinates } from '../../PanelInstances/ViewPanels/FileViewers/KML/KMLParser.mjs';
import { project } from './Coordinates.mjs';
import { GEOGRAPHIC_BIOMES } from './Biomes.mjs';
export function parseRegions(text) {
  if(text.length>1024*1024)throw Error('KML exceeds 1 MiB.');
  const {xmlDoc}=parseKML(text),all=name=>Array.from(xmlDoc.getElementsByTagNameNS('*',name));
  for(const type of ['NetworkLink','Point','LineString','MultiGeometry','Model','GroundOverlay'])if(all(type).length)throw Error(`KML ${type} is unsupported; supply Polygon placemarks only. External resources are never fetched.`);
  const regions=all('Placemark').map((node,index)=>{
    const nodes=name=>Array.from(node.getElementsByTagNameNS('*',name));
    if(nodes('Polygon').length!==1)throw Error('Each KML placemark must contain one Polygon.');
    const boundaries=[...nodes('outerBoundaryIs'),...nodes('innerBoundaryIs')];
    const rings=boundaries.map(boundary=>{
      const ringNodes=boundary.getElementsByTagNameNS('*','LinearRing');
      if(ringNodes.length!==1)throw Error('Each boundary requires one LinearRing.');
      const r=ringNodes[0],raw=r.getElementsByTagNameNS('*','coordinates')[0]?.textContent?.trim()??'';
      if(raw.split(/\s+/).some(s=>{const v=s.split(',');return v.length<2||v.length>3||v.some(n=>!n.trim()||!Number.isFinite(Number(n)));}))throw Error('Invalid KML coordinate tuple.');
      const coords=parseCoordinates(r.getElementsByTagNameNS('*','coordinates')[0]?.textContent);
      if(coords.length<4||coords.length>4096||coords.some(p=>p.lon<18||p.lon>24||p.lat<0||p.lat>84))throw Error('KML rings need 4–4096 valid coordinates in UTM zone 34N.');
      if(coords[0].lon!==coords.at(-1).lon||coords[0].lat!==coords.at(-1).lat)throw Error('KML rings must be closed.');
      return coords.map(p=>project([p.lon,p.lat]));
    });
    if(!rings.length||nodes('outerBoundaryIs').length!==1)throw Error('Polygon requires one outer boundary.');
    const data=nodes('Data').find(n=>n.getAttribute('name')==='biome'),simple=nodes('SimpleData').find(n=>n.getAttribute('name')==='biome');
    const biome=(data?.getElementsByTagNameNS('*','value')[0]?.textContent??simple?.textContent??'').trim();
    if(biome&&!GEOGRAPHIC_BIOMES.includes(biome))throw Error(`Unknown KML biome "${biome}". Valid values: ${GEOGRAPHIC_BIOMES.join(', ')}.`);
    return {id:String(index),name:nodes('name')[0]?.textContent||`Polygon ${index+1}`,biome,rings};
  });
  if(regions.length>64)throw Error('At most 64 KML polygons are supported.');
  return regions;
}
