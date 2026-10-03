export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (v, n) => ({ x: v.x * n, y: v.y * n, z: v.z * n });
export const length = v => Math.hypot(v.x, v.y, v.z);
export const distance = (a, b) => length(sub(a, b));
export const lerp = (a, b, t) => add(a, scale(sub(b, a), t));
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export const lerpAngle = (a, b, t) => wrapAngle(a + wrapAngle(b - a) * t);
export const finiteVector = v => v !== null && typeof v === 'object' && ['x', 'y', 'z'].every(k => Number.isFinite(v[k]));

export function within(point, box, inset = 0) {
  return ['x', 'y', 'z'].every(k => point[k] >= box.min[k] + inset && point[k] <= box.max[k] - inset);
}

// Slab intersection over the entire movement segment prevents high-speed tunnelling.
export function segmentIntersectsBox(a, b, box, padding = 0) {
  let enter = 0, leave = 1;
  for (const k of ['x', 'y', 'z']) {
    const delta = b[k] - a[k], low = box.min[k] - padding, high = box.max[k] + padding;
    if (Math.abs(delta) < 1e-10) { if (a[k] < low || a[k] > high) return false; continue; }
    const t1 = (low - a[k]) / delta, t2 = (high - a[k]) / delta;
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
    if (enter > leave) return false;
  }
  return true;
}

export function floorAt(scene, point) {
  let floor = scene.bounds.min.z + scene.aircraft.radius;
  const terrain = scene.terrainProtection;
  if (terrain) {
    const b = terrain.bounds;
    const x = clamp((point.x - b.minX) / (b.maxX - b.minX) * (terrain.width - 1), 0, terrain.width - 1);
    const y = clamp((point.y - b.minY) / (b.maxY - b.minY) * (terrain.height - 1), 0, terrain.height - 1);
    const i = Math.floor(x), j = Math.floor(y), i1 = Math.min(i + 1, terrain.width - 1), j1 = Math.min(j + 1, terrain.height - 1);
    const a = terrain.values[j * terrain.width + i] * (1 - (x - i)) + terrain.values[j * terrain.width + i1] * (x - i);
    const c = terrain.values[j1 * terrain.width + i] * (1 - (x - i)) + terrain.values[j1 * terrain.width + i1] * (x - i);
    floor = Math.max(floor, a * (1 - (y - j)) + c * (y - j) + scene.aircraft.radius);
  }
  for (const pad of scene.vertiports) {
    if (Math.hypot(point.x - pad.position.x, point.y - pad.position.y) <= pad.captureRadius) floor = Math.max(floor, pad.position.z);
  }
  return floor;
}

export function movementAllowed(scene, a, b) {
  const radius = scene.aircraft.radius;
  const box = scene.bounds;
  const horizontalInside = p => p.x >= box.min.x + radius && p.x <= box.max.x - radius && p.y >= box.min.y + radius && p.y <= box.max.y - radius && p.z <= box.max.z - radius;
  if (![a, b].every(p => finiteVector(p) && horizontalInside(p))) return false;
  // Sweep the platform protection volume as well as the ground plane.
  if (a.z < floorAt(scene, a) - 1e-6 || b.z < floorAt(scene, b) - 1e-6) return false;
  if (scene.terrainProtection) {
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10);
    for (let i = 1; i < steps; i++) {
      const p = lerp(a, b, i / steps);
      if (p.z < floorAt(scene, p) - 1e-6) return false;
    }
  }
  for (const pad of scene.vertiports) {
    const platform = { min: { x: pad.position.x - pad.captureRadius, y: pad.position.y - pad.captureRadius, z: box.min.z - 100 }, max: { x: pad.position.x + pad.captureRadius, y: pad.position.y + pad.captureRadius, z: pad.position.z - 1e-5 } };
    if (segmentIntersectsBox(a, b, platform)) return false;
  }
  return !scene.obstacles.some(o => segmentIntersectsBox(a, b, o, radius));
}

export function moveToward(current, target, maxDelta) {
  const delta = sub(target, current), size = length(delta);
  return size <= maxDelta || size === 0 ? { ...target } : add(current, scale(delta, maxDelta / size));
}

// Local, short-range approximation only. z is preserved as an uncalibrated scene height.
export function localToGeographic(scene, point) {
  const r = 6378137, origin = scene.coordinateSystem.origin;
  return { longitude: origin.longitude + point.x / (r * Math.cos(origin.latitude * Math.PI / 180)) * 180 / Math.PI, latitude: origin.latitude + point.y / r * 180 / Math.PI, sceneHeightMeters: point.z };
}
