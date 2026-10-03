import { add, sub, scale, length, distance, lerp, lerpAngle, wrapAngle, clamp, movementAllowed, moveToward, floorAt } from './geometry.mjs';

const ZERO = () => ({ x: 0, y: 0, z: 0 });
export const MODES = ['passenger', 'pilot'];
export const CAMERAS = ['window', 'forward', 'chase'];

export function sampleRoute(scene, seconds) {
  const route = scene.route, t = clamp(seconds, 0, route.durationSeconds), points = route.waypoints;
  if (t === route.durationSeconds) return { position: { ...points.at(-1).position }, velocity: ZERO(), heading: points.at(-1).heading, phase: 'arrived', routeSeconds: t };
  const i = points.findIndex((p, j) => j < points.length - 1 && t >= p.t && t < points[j + 1].t);
  const a = points[i], b = points[i + 1], duration = b.t - a.t, u = (t - a.t) / duration;
  const smooth = u * u * (3 - 2 * u), derivative = 6 * u * (1 - u) / duration;
  return { position: lerp(a.position, b.position, smooth), velocity: scale(sub(b.position, a.position), derivative), heading: lerpAngle(a.heading, b.heading, smooth), phase: a.phase, routeSeconds: t };
}

export function createFlight(scene, mode = 'passenger') {
  if (!MODES.includes(mode)) throw new RangeError('Unknown control mode');
  return { schemaVersion: 1, sceneId: scene.id, sceneVersion: scene.version, routeId: scene.route.id, routeVersion: scene.route.version,
    ...sampleRoute(scene, 0), mode, control: mode === 'pilot' ? 'pilot' : 'route', status: 'flying', pauseReason: null,
    elapsedSeconds: 0, camera: 'window', rejoin: null, notice: null, visitedLandmarks: [] };
}

export function setPaused(state, reason = 'user') {
  if (reason !== null && !['user', 'focus', 'resources'].includes(reason)) throw new RangeError('Unknown pause reason');
  return { ...state, pauseReason: reason };
}

export function chooseRejoin(scene, state) {
  const candidates = scene.route.waypoints.filter(p => p.t >= state.routeSeconds && movementAllowed(scene, state.position, p.position));
  candidates.sort((a, b) => distance(a.position, state.position) - distance(b.position, state.position) || a.t - b.t);
  return candidates[0] ? { target: { ...candidates[0].position }, targetSeconds: candidates[0].t } : null;
}

export function setMode(scene, state, mode) {
  if (!MODES.includes(mode)) throw new RangeError('Unknown control mode');
  if ((mode === state.mode && state.control !== 'holding') || state.status === 'arrived') return structuredClone(state);
  if (mode === 'pilot') return { ...structuredClone(state), mode, control: 'pilot', rejoin: null, notice: null };
  const rejoin = chooseRejoin(scene, state);
  return { ...structuredClone(state), mode, control: rejoin ? 'rejoining' : 'holding', rejoin, notice: rejoin ? '正在平顺接回航线' : '暂时无法接回，请继续驾驶或重试' };
}

export function setCamera(state, camera) {
  if (!CAMERAS.includes(camera)) throw new RangeError('Unknown camera');
  return { ...state, camera };
}

export function discoverLandmark(scene, state, id, { visible, opened }) {
  if (!scene.landmarks.some(l => l.id === id)) throw new RangeError('Unknown landmark');
  if (!visible || !opened || state.visitedLandmarks.includes(id)) return structuredClone(state);
  return { ...structuredClone(state), visitedLandmarks: [...state.visitedLandmarks, id] };
}

function guardedMove(scene, state, desired, dt) {
  const velocity = moveToward(state.velocity, desired, scene.aircraft.acceleration * dt);
  const position = add(state.position, scale(velocity, dt));
  if (!movementAllowed(scene, state.position, position)) return { ...state, velocity: ZERO(), notice: '观景区域边界或障碍保护已介入' };
  return { ...state, position, velocity, notice: null };
}

function advance(scene, state, input, dt) {
  let next = { ...state, elapsedSeconds: state.elapsedSeconds + dt };
  if (state.control === 'route') {
    const target = sampleRoute(scene, state.routeSeconds + dt);
    if (!movementAllowed(scene, state.position, target.position)) return { ...state, pauseReason: 'resources', notice: '航线暂不可用，已暂停' };
    next = { ...next, ...target };
    if (target.phase === 'arrived') next.status = 'arrived';
    return next;
  }
  if (state.control === 'holding') return { ...next, velocity: ZERO() };
  if (state.control === 'rejoining') {
    if (!state.rejoin) return { ...next, control: 'holding', velocity: ZERO(), notice: '暂时无法接回，请重试' };
    const delta = sub(state.rejoin.target, state.position), d = length(delta);
    if (d < 0.15 && length(state.velocity) < 0.6) {
      const target = sampleRoute(scene, state.rejoin.targetSeconds);
      if (!movementAllowed(scene, state.position, target.position)) return { ...next, control: 'holding', velocity: ZERO(), rejoin: null, notice: '暂时无法接回，请重试' };
      return { ...next, ...target, control: 'route', rejoin: null, notice: null, status: target.phase === 'arrived' ? 'arrived' : 'flying' };
    }
    const speed = Math.min(12, Math.sqrt(Math.max(0, 2 * scene.aircraft.acceleration * d)), d * 1.5);
    next = guardedMove(scene, next, d > 0 ? scale(delta, speed / d) : ZERO(), dt);
    if (next.notice) return { ...next, control: 'holding', rejoin: null, notice: '接回路径受阻，请继续驾驶或重试' };
    if (Math.hypot(next.velocity.x, next.velocity.y) > 0.1) next.heading = lerpAngle(state.heading, Math.atan2(next.velocity.x, next.velocity.y), Math.min(1, dt * 2));
    return next;
  }
  const controls = { throttle: input.throttle ?? 0, turn: input.turn ?? 0, climb: input.climb ?? 0, hover: input.hover ?? false };
  for (const k of ['throttle', 'turn', 'climb']) if (!Number.isFinite(controls[k]) || Math.abs(controls[k]) > 1) throw new RangeError(`Invalid ${k}`);
  if (typeof controls.hover !== 'boolean') throw new RangeError('Invalid hover');
  const nearPad = scene.vertiports.some(p => Math.hypot(state.position.x - p.position.x, state.position.y - p.position.y) <= p.captureRadius && state.position.z < p.position.z + 25);
  const speedLimit = nearPad ? 4 : scene.aircraft.maxSpeed;
  const heading = wrapAngle(state.heading + controls.turn * scene.aircraft.yawRate * dt);
  const currentSpeed = Math.hypot(state.velocity.x, state.velocity.y);
  const speed = controls.hover ? 0 : clamp(currentSpeed + controls.throttle * scene.aircraft.acceleration * dt, 0, speedLimit);
  const desired = controls.hover ? ZERO() : { x: Math.sin(heading) * speed, y: Math.cos(heading) * speed, z: controls.climb * (nearPad ? 2 : scene.aircraft.maxClimbRate) };
  next = guardedMove(scene, { ...next, heading }, desired, dt);
  next.phase = nearPad ? (desired.z >= 0 ? 'takeoff' : 'landing') : 'cruise';
  const destination = scene.vertiports.find(p => p.id === scene.route.destinationId);
  if (Math.hypot(next.position.x - destination.position.x, next.position.y - destination.position.y) <= destination.landingRadius && Math.abs(next.position.z - destination.position.z) < 0.8 && length(next.velocity) < 2) {
    const landing = { ...next.position, z: floorAt(scene, next.position) };
    if (movementAllowed(scene, next.position, landing)) next = { ...next, position: landing, velocity: ZERO(), status: 'arrived', phase: 'arrived', routeSeconds: scene.route.durationSeconds };
  }
  return next;
}

export function stepFlight(scene, state, input = {}, dt = 1 / 60) {
  if (!Number.isFinite(dt) || dt < 0 || dt > 0.25) throw new RangeError('dt must be between 0 and 0.25 seconds');
  if (state.pauseReason !== null || state.status === 'arrived' || dt === 0) return structuredClone(state);
  let next = structuredClone(state), remaining = dt, protectionNotice = null;
  while (remaining > 1e-9) {
    const step = Math.min(0.025, remaining);
    next = advance(scene, next, input, step);
    if (next.notice === '观景区域边界或障碍保护已介入') protectionNotice = next.notice;
    remaining -= step;
    if (next.pauseReason !== null || next.status === 'arrived') break;
  }
  return { ...next, notice: next.notice ?? protectionNotice };
}
