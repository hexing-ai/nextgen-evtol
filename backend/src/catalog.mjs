import { readFileSync } from 'node:fs';
import { validateCatalog } from './validation.mjs';

function freezeDeep(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freezeDeep); } return value; }
export const catalog = freezeDeep(validateCatalog(JSON.parse(readFileSync(new URL('../data/hong-kong.json', import.meta.url), 'utf8'))));
export const routeSummary = scene => ({ id: scene.route.id, version: scene.route.version, title: scene.title, description: scene.description, durationSeconds: scene.route.durationSeconds,
  origin: scene.vertiports.find(v => v.id === scene.route.originId), destination: scene.vertiports.find(v => v.id === scene.route.destinationId), contentStatus: scene.contentStatus, readiness: scene.readiness });

export function staticDocuments() {
  return {
    'manifest.json': { schemaVersion: 1, product: catalog.product, sceneId: catalog.scene.id, sceneVersion: catalog.scene.version,
      resources: { scene: 'scene.json', routes: 'routes/index.json', aircraft: 'aircraft.json', landmarks: 'landmarks.json', sources: 'sources.json', route: `routes/${catalog.scene.route.id}.json` },
      runtimeMode: 'browser-local', notice: '香港开放DEM与OSM建筑轮廓；起降场与航线为概念设计，未使用官方精细三维模型。' },
    'scene.json': catalog.scene,
    'routes/index.json': [routeSummary(catalog.scene)],
    [`routes/${catalog.scene.route.id}.json`]: catalog.scene.route,
    'aircraft.json': [catalog.scene.aircraft],
    'landmarks.json': catalog.scene.landmarks,
    'sources.json': catalog.sources
  };
}
