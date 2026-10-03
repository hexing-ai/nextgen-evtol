import { finiteVector, movementAllowed, distance, length } from './geometry.mjs';
import { sampleRoute, MODES, CAMERAS } from './flight.mjs';

export class ValidationError extends Error {
  constructor(message, field = 'body') { super(message); this.name = 'ValidationError'; this.field = field; }
}
export function requireObject(value, field = 'body') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('Expected a JSON object', field);
  return value;
}
export function number(value, min, max, field) {
  if (!Number.isFinite(value) || value < min || value > max) throw new ValidationError(`Expected a finite number between ${min} and ${max}`, field);
  return value;
}
export function enumValue(value, options, field) {
  if (!options.includes(value)) throw new ValidationError(`Expected one of: ${options.join(', ')}`, field);
  return value;
}
function vector(value, field) {
  if (!finiteVector(value)) throw new ValidationError('Expected finite x, y and z', field);
  return { x: value.x, y: value.y, z: value.z };
}

export function validateCatalog(catalog) {
  requireObject(catalog);
  if (catalog.schemaVersion !== 1 || catalog.product?.name !== 'Nextgen eVTOL') throw new ValidationError('Unsupported catalog');
  const scene = requireObject(catalog.scene, 'scene');
  for (const key of ['id', 'version']) if (typeof scene[key] !== 'string' || !scene[key]) throw new ValidationError('Missing identifier', `scene.${key}`);
  vector(scene.bounds?.min, 'scene.bounds.min'); vector(scene.bounds?.max, 'scene.bounds.max');
  for (const k of ['x', 'y', 'z']) if (scene.bounds.min[k] >= scene.bounds.max[k]) throw new ValidationError('Invalid bounds', 'scene.bounds');
  const craft = requireObject(scene.aircraft, 'scene.aircraft');
  for (const key of ['radius', 'maxSpeed', 'maxClimbRate', 'acceleration', 'yawRate']) number(craft[key], 0.001, 200, `aircraft.${key}`);
  if (!Array.isArray(scene.vertiports) || scene.vertiports.length < 2) throw new ValidationError('At least two vertiports required');
  const padIds = new Set();
  for (const p of scene.vertiports) {
    if (typeof p.id !== 'string' || padIds.has(p.id)) throw new ValidationError('Duplicate or missing vertiport ID');
    padIds.add(p.id); vector(p.position, 'vertiport.position');
    number(p.captureRadius, 1, 1000, 'vertiport.captureRadius'); number(p.landingRadius, 1, p.captureRadius, 'vertiport.landingRadius');
  }
  if (!Array.isArray(scene.obstacles)) throw new ValidationError('Obstacles must be an array');
  for (const o of scene.obstacles) {
    vector(o.min, 'obstacle.min'); vector(o.max, 'obstacle.max');
    for (const k of ['x', 'y', 'z']) if (o.min[k] >= o.max[k]) throw new ValidationError('Invalid obstacle box');
  }
  const route = requireObject(scene.route, 'scene.route');
  if (!padIds.has(route.originId) || !padIds.has(route.destinationId) || route.originId === route.destinationId) throw new ValidationError('Invalid route endpoints');
  number(route.durationSeconds, 1, 3600, 'route.durationSeconds');
  if (!Array.isArray(route.waypoints) || route.waypoints.length < 2 || route.waypoints.length > 500) throw new ValidationError('Invalid route waypoint count');
  let previousTime = -1;
  for (const [i, p] of route.waypoints.entries()) {
    number(p.t, 0, route.durationSeconds, 'waypoint.t'); vector(p.position, 'waypoint.position'); number(p.heading, -Math.PI, Math.PI, 'waypoint.heading');
    enumValue(p.phase, ['takeoff', 'transition', 'cruise', 'approach', 'landing', 'arrived'], 'waypoint.phase');
    if (p.t <= previousTime) throw new ValidationError('Waypoint timestamps must be increasing');
    if (!movementAllowed(scene, p.position, p.position)) throw new ValidationError('Waypoint intersects protected area', `waypoints.${i}`);
    if (i > 0 && !movementAllowed(scene, route.waypoints[i - 1].position, p.position)) throw new ValidationError('Route segment intersects protected area', `waypoints.${i}`);
    previousTime = p.t;
  }
  if (route.waypoints[0].t !== 0 || previousTime !== route.durationSeconds) throw new ValidationError('Route timing mismatch');
  for (const [point, id] of [[route.waypoints[0], route.originId], [route.waypoints.at(-1), route.destinationId]]) if (distance(point.position, scene.vertiports.find(p => p.id === id).position) > 0.001) throw new ValidationError('Route must meet vertiport platform');
  if (!Array.isArray(scene.landmarks) || !Array.isArray(catalog.sources)) throw new ValidationError('Missing content sources');
  const ids = new Set(), sources = new Set(catalog.sources.map(s => s.id));
  for (const l of scene.landmarks) {
    if (ids.has(l.id) || !sources.has(l.sourceId)) throw new ValidationError('Invalid landmark/source reference');
    ids.add(l.id); number(l.longitude, -180, 180, 'landmark.longitude'); number(l.latitude, -90, 90, 'landmark.latitude');
  }
  return catalog;
}

export function validateState(scene, raw) {
  requireObject(raw, 'state');
  const identifiers = { schemaVersion: 1, sceneId: scene.id, sceneVersion: scene.version, routeId: scene.route.id, routeVersion: scene.route.version };
  for (const [key, value] of Object.entries(identifiers)) if (raw[key] !== value) throw new ValidationError('State belongs to a different schema, scene or route version', `state.${key}`);
  const position = vector(raw.position, 'state.position'), velocity = vector(raw.velocity, 'state.velocity');
  if (!movementAllowed(scene, position, position)) throw new ValidationError('Position is outside the validated game area', 'state.position');
  if (length(velocity) > scene.aircraft.maxSpeed + scene.aircraft.maxClimbRate + 1) throw new ValidationError('Velocity exceeds game envelope', 'state.velocity');
  const routeSeconds = number(raw.routeSeconds, 0, scene.route.durationSeconds, 'state.routeSeconds');
  const elapsedSeconds = number(raw.elapsedSeconds, 0, 86400, 'state.elapsedSeconds');
  const heading = number(raw.heading, -Math.PI, Math.PI, 'state.heading');
  const mode = enumValue(raw.mode, MODES, 'state.mode');
  const control = enumValue(raw.control, ['route', 'rejoining', 'holding', 'pilot'], 'state.control');
  if ((mode === 'pilot') !== (control === 'pilot')) throw new ValidationError('Mode and control disagree', 'state.control');
  const status = enumValue(raw.status, ['flying', 'arrived'], 'state.status');
  const phase = enumValue(raw.phase, ['takeoff', 'transition', 'cruise', 'approach', 'landing', 'arrived'], 'state.phase');
  const pauseReason = enumValue(raw.pauseReason, [null, 'user', 'focus', 'resources'], 'state.pauseReason');
  const camera = enumValue(raw.camera, CAMERAS, 'state.camera');
  let rejoin = null;
  if (control === 'rejoining') {
    requireObject(raw.rejoin, 'state.rejoin');
    const target = vector(raw.rejoin.target, 'state.rejoin.target');
    const targetSeconds = number(raw.rejoin.targetSeconds, routeSeconds, scene.route.durationSeconds, 'state.rejoin.targetSeconds');
    if (!scene.route.waypoints.some(p => p.t === targetSeconds && distance(p.position, target) < 0.001)) throw new ValidationError('Unknown rejoin waypoint', 'state.rejoin');
    rejoin = { target, targetSeconds };
  } else if (raw.rejoin !== null) throw new ValidationError('Unexpected rejoin target', 'state.rejoin');
  if (control === 'route') {
    const sampled = sampleRoute(scene, routeSeconds);
    if (distance(position, sampled.position) > 0.001 || distance(velocity, sampled.velocity) > 0.001 || phase !== sampled.phase) throw new ValidationError('Route state does not match its clock', 'state.routeSeconds');
  }
  if (status === 'arrived' || phase === 'arrived') {
    const pad = scene.vertiports.find(p => p.id === scene.route.destinationId);
    if (status !== 'arrived' || phase !== 'arrived' || Math.hypot(position.x - pad.position.x, position.y - pad.position.y) > pad.landingRadius || Math.abs(position.z - pad.position.z) > 0.8 || length(velocity) > 0.001 || routeSeconds !== scene.route.durationSeconds) throw new ValidationError('Invalid arrival state', 'state.status');
  }
  if (!Array.isArray(raw.visitedLandmarks) || raw.visitedLandmarks.length > scene.landmarks.length || raw.visitedLandmarks.some(id => !scene.landmarks.some(l => l.id === id))) throw new ValidationError('Unknown landmark record', 'state.visitedLandmarks');
  return { ...identifiers, position, velocity, routeSeconds, elapsedSeconds, heading, mode, control, status, phase, pauseReason, camera, rejoin,
    notice: typeof raw.notice === 'string' ? raw.notice.slice(0, 160) : null, visitedLandmarks: [...new Set(raw.visitedLandmarks)] };
}

export function validateCheckpoint(scene, body) {
  requireObject(body);
  if (body.schemaVersion !== 1 || typeof body.savedAt !== 'string' || !Number.isFinite(Date.parse(body.savedAt))) throw new ValidationError('Invalid checkpoint envelope');
  const state = validateState(scene, body.state);
  return { valid: true, savedAt: body.savedAt, state: { ...state, pauseReason: 'user' }, recovery: 'resume-after-user-action' };
}
