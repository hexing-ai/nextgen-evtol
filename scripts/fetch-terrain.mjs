import { PNG } from 'pngjs';
import { mkdir, writeFile } from 'node:fs/promises';
const bounds={west:113.83,east:114.45,south:22.15,north:22.58},width=769,height=577,zoom=11;
const tile=(lon,lat)=>({x:(lon+180)/360*2**zoom,y:(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**zoom});
const nw=tile(bounds.west,bounds.north),se=tile(bounds.east,bounds.south),tiles=new Map(),jobs=[];
for(let x=Math.floor(nw.x);x<=Math.floor(se.x);x++)for(let y=Math.floor(nw.y);y<=Math.floor(se.y);y++)jobs.push({x,y});
let idx=0;
await Promise.all(Array.from({length:3},async()=>{while(idx<jobs.length){const {x,y}=jobs[idx++];let error;for(let attempt=0;attempt<3;attempt++){try{const url=`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(r.status);tiles.set(`${x}/${y}`,PNG.sync.read(Buffer.from(await r.arrayBuffer())));error=null;break;}catch(e){error=e;}}if(error)throw error;console.log('DEM tile',x,y);}}));
const data=new Int16Array(width*height);
for(let j=0;j<height;j++)for(let i=0;i<width;i++){const p=tile(bounds.west+i/(width-1)*(bounds.east-bounds.west),bounds.north-j/(height-1)*(bounds.north-bounds.south));const t=tiles.get(`${Math.floor(p.x)}/${Math.floor(p.y)}`);const k=(Math.min(255,Math.floor(p.y%1*256))*256+Math.min(255,Math.floor(p.x%1*256)))*4;data[j*width+i]=Math.max(0,Math.round(t.data[k]*256+t.data[k+1]+t.data[k+2]/256-32768));}
await mkdir('public/geo',{recursive:true});await writeFile('public/geo/hk-terrain.bin',Buffer.from(data.buffer));await writeFile('public/geo/hk-terrain.json',JSON.stringify({...bounds,width,height,encoding:'int16-le',units:'meters',source:'Mapzen Terrain Tiles (AWS Open Data)',sourceUrl:'https://registry.opendata.aws/terrain-tiles/',sourceZoom:zoom,verticalReference:'source DEM heights used as approximate scene elevations; not HKPD survey heights',fetchedAt:new Date().toISOString()}));console.log('Terrain exported',data.length,Math.max(...data.slice(0,10000)));
