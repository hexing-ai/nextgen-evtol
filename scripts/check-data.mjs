import { catalog } from '../backend/src/catalog.mjs';
import { sampleRoute } from '../backend/src/flight.mjs';
import { movementAllowed, length } from '../backend/src/geometry.mjs';
const scene = catalog.scene;
for (let t = 0; t <= scene.route.durationSeconds; t += 0.25) {
  const a = sampleRoute(scene, t), b = sampleRoute(scene, t + 0.25);
  if (!movementAllowed(scene, a.position, b.position)) throw new Error(`Blocked concept route at ${t}s`);
  if (length(a.velocity) > scene.aircraft.maxSpeed || Math.abs(a.velocity.z) > scene.aircraft.maxClimbRate) throw new Error(`Game envelope exceeded at ${t}s`);
}
console.log(`Validated ${scene.route.id}: ${scene.route.waypoints.length} waypoints, ${scene.route.durationSeconds}s. Concept geometry only; not official Hong Kong terrain.`);
