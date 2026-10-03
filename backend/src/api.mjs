import { createHash } from 'node:crypto';
import { catalog, staticDocuments } from './catalog.mjs';
import { createFlight, sampleRoute, setMode, stepFlight } from './flight.mjs';
import { requireObject, validateState, validateCheckpoint, number, enumValue, ValidationError } from './validation.mjs';
import { openapi } from './openapi.mjs';

const prefix = '/api/v1';
const documents = staticDocuments();
const scene = catalog.scene;
const staticRoutes = new Map([
  [`${prefix}/manifest`, documents['manifest.json']], [`${prefix}/scene`, scene],
  [`${prefix}/routes`, documents['routes/index.json']], [`${prefix}/routes/${scene.route.id}`, scene.route],
  [`${prefix}/aircraft`, documents['aircraft.json']], [`${prefix}/landmarks`, scene.landmarks], [`${prefix}/sources`, catalog.sources],
  [`${prefix}/openapi.json`, openapi]
]);
for (const [path, document] of Object.entries(documents)) staticRoutes.set(`${prefix}/${path}`, document);
export const MAX_BODY_BYTES = 65536;

function send(res, status, payload, method = 'GET', headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', ...headers });
  res.end(method === 'HEAD' ? undefined : body);
}
async function readJSON(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) throw Object.assign(new Error('Use application/json'), { httpStatus: 415 });
  const size = req.headers['content-length'];
  if (size !== undefined && Number(size) > MAX_BODY_BYTES) throw Object.assign(new Error('Request body exceeds 64 KiB'), { httpStatus: 413 });
  let bytes = 0, chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if (bytes > MAX_BODY_BYTES) throw Object.assign(new Error('Request body exceeds 64 KiB'), { httpStatus: 413 }); chunks.push(chunk); }
  try { return requireObject(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
  catch (e) { if (e instanceof ValidationError) throw e; throw Object.assign(new Error('Invalid JSON'), { httpStatus: 400 }); }
}

export function handler({ allowedOrigins = [] } = {}) {
  return async (req, res) => {
    try {
      const origin = req.headers.origin;
      const sameOrigin = origin === `http://${req.headers.host}` || origin === `https://${req.headers.host}`;
      if (origin && !sameOrigin && !allowedOrigins.includes(origin)) return send(res, 403, { error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin not allowed' } });
      if (origin && allowedOrigins.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
      if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' }); return res.end();
      }
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/healthz') {
        if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } }, req.method, { Allow: 'GET, HEAD' });
        return send(res, 200, { status: 'ok', service: 'Nextgen eVTOL', version: '0.1.0', contentStatus: 'concept', productionFlightReady: false }, req.method);
      }
      if (staticRoutes.has(url.pathname)) {
        if (!['GET', 'HEAD'].includes(req.method)) return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET' } }, req.method, { Allow: 'GET, HEAD' });
        const payload = staticRoutes.get(url.pathname), etag = '"' + createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 24) + '"';
        if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': 'public, max-age=0, must-revalidate' }); return res.end(); }
        return send(res, 200, payload, req.method, { ETag: etag, 'Cache-Control': 'public, max-age=0, must-revalidate' });
      }
      const action = url.pathname.slice(prefix.length);
      if (!url.pathname.startsWith(prefix + '/') || !['/flights', '/flights/mode', '/flights/step', '/flights/preview', '/checkpoints/validate'].includes(action)) return send(res, 404, { error: { code: 'NOT_FOUND', message: 'Endpoint not found' } }, req.method);
      if (req.method !== 'POST') return send(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } }, req.method, { Allow: 'POST' });
      const body = await readJSON(req);
      if (action === '/flights') {
        if (body.routeId !== scene.route.id) throw new ValidationError('Unknown routeId', 'routeId');
        const mode = enumValue(body.mode ?? 'passenger', ['passenger', 'pilot'], 'mode');
        return send(res, 201, { state: createFlight(scene, mode), persistence: 'client-local' });
      }
      if (action === '/flights/preview') {
        if (body.routeId !== scene.route.id) throw new ValidationError('Unknown routeId', 'routeId');
        const interval = number(body.intervalSeconds ?? 5, 0.25, 30, 'intervalSeconds');
        const samples = [];
        for (let t = 0; t < scene.route.durationSeconds; t += interval) samples.push(sampleRoute(scene, t));
        samples.push(sampleRoute(scene, scene.route.durationSeconds));
        return send(res, 200, { contentStatus: scene.contentStatus, samples });
      }
      if (action === '/checkpoints/validate') return send(res, 200, validateCheckpoint(scene, body));
      const state = validateState(scene, body.state);
      if (action === '/flights/mode') return send(res, 200, { state: setMode(scene, state, enumValue(body.mode, ['passenger', 'pilot'], 'mode')) });
      const dt = number(body.deltaSeconds, 0, 0.25, 'deltaSeconds');
      const input = requireObject(body.input ?? {}, 'input');
      for (const k of ['throttle', 'turn', 'climb']) if (input[k] !== undefined) number(input[k], -1, 1, `input.${k}`);
      if (input.hover !== undefined && typeof input.hover !== 'boolean') throw new ValidationError('Expected boolean', 'input.hover');
      return send(res, 200, { state: stepFlight(scene, state, input, dt) });
    } catch (error) {
      if (res.headersSent || res.destroyed) return;
      const status = error instanceof ValidationError || error instanceof RangeError ? 422 : error.httpStatus ?? 500;
      send(res, status, { error: { code: status === 422 ? 'VALIDATION_ERROR' : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR', message: status === 500 ? 'Internal server error' : error.message, ...(error.field ? { field: error.field } : {}) } }, req.method);
    }
  };
}
