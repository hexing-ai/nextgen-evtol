import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handler } from '../src/api.mjs';
import { catalog } from '../src/catalog.mjs';
import { createFlight } from '../src/flight.mjs';

test('HTTP contract: content, state validation, method handling, CORS and JSON errors', async t => {
  const server = createServer(handler({ allowedOrigins: ['http://localhost:5173'] }));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path, options) => fetch(base + path, options);
  const post = (path, body) => get(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const state = createFlight(catalog.scene);

  await t.test('health and content readiness are honest', async () => {
    const response = await get('/healthz'); const body = await response.json(); assert.equal(body.status, 'ok'); assert.equal(body.productionFlightReady, false);
  });
  await t.test('manifest resource URLs resolve on both API and static contract', async () => {
    const r = await get('/api/v1/manifest.json'); const m = await r.json();
    for (const relative of Object.values(m.resources)) assert.equal((await fetch(new URL(relative, r.url))).status, 200);
  });
  await t.test('ETag and HEAD do not send duplicate bodies', async () => {
    const r = await get('/api/v1/scene'); const etag = r.headers.get('etag'); assert.ok(etag);
    const cached = await get('/api/v1/scene', { headers: { 'If-None-Match': etag } }); assert.equal(cached.status, 304); assert.equal(await cached.text(), '');
    const head = await get('/api/v1/scene', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  });
  await t.test('creates a stateless flight and changes control without moving', async () => {
    const created = await post('/api/v1/flights', { routeId: catalog.scene.route.id }); assert.equal(created.status, 201);
    const body = await created.json(); assert.equal(body.persistence, 'client-local');
    const changed = await post('/api/v1/flights/mode', { state: body.state, mode: 'pilot' }); const s = (await changed.json()).state;
    assert.equal(s.mode, 'pilot'); assert.deepEqual(s.position, body.state.position);
  });
  await t.test('step and preview produce finite bounded data', async () => {
    const r = await post('/api/v1/flights/step', { state, deltaSeconds: 0.25, input: {} }); assert.equal(r.status, 200); assert.ok((await r.json()).state.position.z >= 12);
    const preview = await post('/api/v1/flights/preview', { routeId: catalog.scene.route.id, intervalSeconds: 10 }); const data = await preview.json(); assert.equal(data.samples.length, 34); assert.equal(data.samples.at(-1).phase, 'arrived');
  });
  await t.test('save validation returns paused state without storing it', async () => {
    const r = await post('/api/v1/checkpoints/validate', { schemaVersion: 1, savedAt: '2026-10-03T00:00:00Z', state }); assert.equal(r.status, 200); assert.equal((await r.json()).state.pauseReason, 'user');
  });
  await t.test('invalid input and tampered states return 422', async () => {
    for (const body of [{ state, deltaSeconds: 1 }, { state: { ...state, sceneVersion: 'wrong' }, deltaSeconds: 0.1 }, { state, deltaSeconds: 0.1, input: { turn: 2 } }]) assert.equal((await post('/api/v1/flights/step', body)).status, 422);
    assert.equal((await post('/api/v1/flights', { routeId: 'unknown' })).status, 422);
  });
  await t.test('invalid JSON, body limits and content types are explicit', async () => {
    assert.equal((await get('/api/v1/flights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await get('/api/v1/flights', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status, 415);
    assert.equal((await post('/api/v1/flights', { data: 'x'.repeat(66000) })).status, 413);
  });
  await t.test('CORS is opt-in and never reflects arbitrary origins', async () => {
    const allowed = await get('/api/v1/scene', { headers: { Origin: 'http://localhost:5173' } }); assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    const denied = await get('/api/v1/scene', { headers: { Origin: 'https://untrusted.example' } }); assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), null);
    assert.equal((await get('/api/v1/scene', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } })).status, 204);
  });
  await t.test('unsupported paths and methods produce useful errors', async () => {
    assert.equal((await get('/api/v1/missing')).status, 404); assert.equal((await post('/api/v1/scene', {})).status, 405); assert.equal((await get('/api/v1/flights')).status, 405);
    const schema = await (await get('/api/v1/openapi.json')).json(); assert.equal(schema.openapi, '3.1.0'); assert.ok(schema.components.schemas.FlightState);
  });
});
