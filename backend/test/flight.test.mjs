import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../src/catalog.mjs';
import { createFlight, stepFlight, setMode, setPaused, sampleRoute, setCamera, discoverLandmark } from '../src/flight.mjs';
import { distance, movementAllowed, segmentIntersectsBox, lerpAngle } from '../src/geometry.mjs';
import { validateState, validateCatalog, validateCheckpoint } from '../src/validation.mjs';
const scene = catalog.scene;
function cruise(mode = 'pilot') { return { ...createFlight(scene, mode), ...sampleRoute(scene, 110), control: mode === 'pilot' ? 'pilot' : 'route' }; }

test('passenger completes the entire concept route and remains in the protected region', () => {
  let state = createFlight(scene);
  for (let i = 0; i < 1321; i++) { const previous = state; state = stepFlight(scene, state, {}, 0.25); assert.ok(movementAllowed(scene, previous.position, state.position)); validateState(scene, state); }
  assert.equal(state.status, 'arrived'); assert.deepEqual(state.position, scene.vertiports[1].position);
  assert.ok(Math.abs(state.elapsedSeconds - 330) < 0.05);
});
test('pause freezes movement, elapsed time, and route time', () => {
  for (const reason of ['user', 'focus', 'resources']) { const state = setPaused(cruise(), reason); assert.deepEqual(stepFlight(scene, state, { throttle: 1 }, 0.25), state); }
});
test('mode handover preserves position, heading, velocity and camera across 20 changes', () => {
  let state = cruise('passenger');
  for (let i = 0; i < 20; i++) { const previous = state; state = setMode(scene, state, i % 2 === 0 ? 'pilot' : 'passenger'); assert.deepEqual(state.position, previous.position); assert.deepEqual(state.velocity, previous.velocity); assert.equal(state.heading, previous.heading); assert.equal(state.camera, previous.camera); validateState(scene, state); }
});
test('pilot can turn, accelerate and climb; release stops commanded turning', () => {
  let state = cruise(); const start = structuredClone(state);
  for (let i = 0; i < 20; i++) state = stepFlight(scene, state, { throttle: 1, turn: 0.5, climb: 1 }, 0.1);
  assert.ok(state.position.z > start.position.z); assert.notEqual(state.heading, start.heading);
  const heading = state.heading; state = stepFlight(scene, state, {}, 0.1); assert.equal(state.heading, heading);
});
test('hover brakes without teleportation', () => {
  let state = cruise(); const initial = structuredClone(state);
  for (let i = 0; i < 100; i++) state = stepFlight(scene, state, { hover: true }, 0.1);
  assert.equal(Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z), 0);
  assert.ok(distance(initial.position, state.position) < 100);
});
test('displaced pilot can rejoin automatically and finish', () => {
  let state = cruise(); state.position.x += 55; state = setMode(scene, state, 'passenger');
  assert.equal(state.control, 'rejoining');
  for (let i = 0; i < 2000 && state.status !== 'arrived'; i++) { const p = state.position; state = stepFlight(scene, state, {}, 0.25); assert.ok(distance(p, state.position) < 8); validateState(scene, state); }
  assert.equal(state.status, 'arrived');
});
test('blocked rejoin holds at current position; retry remains available', () => {
  const blocked = structuredClone(scene); const state = cruise();
  blocked.obstacles.push({ id: 'wall', min: { x: -500, y: state.position.y + 1, z: 0 }, max: { x: 600, y: 2160, z: 220 } });
  const switched = setMode(blocked, state, 'passenger'); assert.equal(switched.control, 'holding');
  const held = stepFlight(blocked, switched, {}, 0.1); assert.deepEqual(held.position, state.position);
  assert.equal(setMode(scene, held, 'passenger').control, 'rejoining');
});
test('swept collision finds an obstacle even when both endpoints are outside', () => {
  assert.ok(segmentIntersectsBox({ x: -10, y: 0, z: 10 }, { x: 10, y: 0, z: 10 }, { min: { x: -1, y: -1, z: 0 }, max: { x: 1, y: 1, z: 20 } }));
  const state = cruise(); state.position = { x: scene.bounds.max.x - 5, y: 500, z: 100 }; state.heading = Math.PI / 2; state.velocity = { x: 28, y: 0, z: 0 };
  const next = stepFlight(scene, state, { throttle: 1 }, 0.25); assert.ok(next.position.x <= scene.bounds.max.x - scene.aircraft.radius); assert.ok(next.notice);
});
test('heading interpolation crosses the dateline of angles via the short arc', () => assert.ok(Math.abs(Math.abs(lerpAngle(3.1, -3.1, 0.5)) - Math.PI) < 1e-8));
test('vertical takeoff maintains a stable heading', () => { assert.equal(sampleRoute(scene, 0).heading, sampleRoute(scene, 20).heading); });
test('camera and landmark discovery do not affect control; discoveries are deduplicated', () => {
  let state = setCamera(cruise(), 'chase'); const original = structuredClone(state);
  state = discoverLandmark(scene, state, 'ifc', { visible: false, opened: true }); assert.equal(state.visitedLandmarks.length, 0);
  for (let i = 0; i < 5; i++) state = discoverLandmark(scene, state, 'ifc', { visible: true, opened: true });
  assert.deepEqual(state.visitedLandmarks, ['ifc']); assert.deepEqual(state.position, original.position); assert.equal(state.mode, original.mode);
});
test('checkpoint resume is paused and rejects incompatible versions', () => {
  const state = cruise(); const body = { schemaVersion: 1, savedAt: '2026-10-03T00:00:00Z', state };
  assert.equal(validateCheckpoint(scene, body).state.pauseReason, 'user');
  assert.throws(() => validateCheckpoint(scene, { ...body, state: { ...state, sceneVersion: 'old' } }));
  assert.throws(() => validateCheckpoint(scene, { ...body, savedAt: 'invalid' }));
});
test('invalid state, forged arrival and malformed input are rejected', () => {
  const s = cruise();
  for (const patch of [{ position: { x: NaN, y: 0, z: 0 } }, { heading: Infinity }, { mode: 'other' }, { control: 'route' }, { status: 'arrived', phase: 'arrived' }, { routeSeconds: -1 }, { visitedLandmarks: ['unknown'] }]) assert.throws(() => validateState(scene, { ...s, ...patch }));
  for (const dt of [-1, 1, NaN]) assert.throws(() => stepFlight(scene, s, {}, dt));
  assert.throws(() => stepFlight(scene, s, { throttle: 100 }, 0.1));
});
test('catalog rejects invalid timing and obstacle-crossing routes', () => {
  const timing = structuredClone(catalog); timing.scene.route.waypoints[2].t = 0; assert.throws(() => validateCatalog(timing));
  const blocked = structuredClone(catalog); blocked.scene.obstacles.push({ min: { x: -20, y: -20, z: 20 }, max: { x: 20, y: 20, z: 80 } }); assert.throws(() => validateCatalog(blocked));
});
test('states are immutable and frame subdivision produces equivalent pilot motion', () => {
  const a = cruise(), snapshot = structuredClone(a); const big = stepFlight(scene, a, { turn: 0.1, throttle: 0.3 }, 0.2);
  let small = a; for (let i = 0; i < 8; i++) small = stepFlight(scene, small, { turn: 0.1, throttle: 0.3 }, 0.025);
  assert.deepEqual(a, snapshot); assert.ok(distance(big.position, small.position) < 1e-8);
});

test('terrain protection catches a ridge between otherwise clear endpoints', () => {
  const terrainScene=structuredClone(scene);
  terrainScene.obstacles=[];terrainScene.vertiports=[];
  terrainScene.terrainProtection={width:3,height:2,bounds:{minX:-100,maxX:100,minY:400,maxY:600},values:[0,120,0,0,120,0]};
  assert.equal(movementAllowed(terrainScene,{x:-100,y:500,z:80},{x:100,y:500,z:80}),false);
  assert.equal(movementAllowed(terrainScene,{x:-100,y:500,z:160},{x:100,y:500,z:160}),true);
});
