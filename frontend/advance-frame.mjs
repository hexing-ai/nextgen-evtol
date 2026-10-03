import {stepFlight} from '../backend/src/flight.mjs';
// Preserve wall time on slower GPUs while keeping each physics step within its contract.
// Long suspension is handled by visibility pause; cap an unexpected foreground stall at 1s.
export function advanceFrame(scene,state,input,delta){
  if(!Number.isFinite(delta)||delta<0)throw new RangeError('Invalid frame duration');
  let remaining=Math.min(delta,1),next=state;
  while(remaining>1e-9){const dt=Math.min(remaining,.25);next=stepFlight(scene,next,input,dt);remaining-=dt;}
  return next;
}
