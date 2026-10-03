import { cp, mkdir } from 'node:fs/promises';
await mkdir('public/cesium', {recursive:true});
for (const folder of ['Workers','Assets','Widgets','ThirdParty']) await cp(`node_modules/cesium/Build/Cesium/${folder}`, `public/cesium/${folder}`, {recursive:true});
console.log('Cesium runtime assets ready.');
await mkdir('public/licenses',{recursive:true});
for(const [pkg,file]of[['cesium','LICENSE.md'],['resium','LICENSE'],['react','LICENSE'],['react-dom','LICENSE'],['lucide-react','LICENSE'],['vite','LICENSE.md'],['pngjs','LICENSE']])await cp(`node_modules/${pkg}/${file}`,`public/licenses/${pkg}.txt`);
for(const file of['ThirdParty.json','ThirdParty.extra.json'])await cp(`node_modules/cesium/${file}`,`public/licenses/cesium-${file}`);
await cp('THIRD_PARTY_NOTICES.md','public/licenses/NOTICES.md');
