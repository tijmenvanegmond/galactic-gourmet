import { CAMERA, VIEW } from './config';
import type { Camera, Payload, Vec2 } from './types';

export function createCamera(x: number, y: number): Camera {
  return { x, y, zoom: CAMERA.aimZoom, targetZoom: CAMERA.aimZoom };
}

export function followPayload(cam: Camera, pod: Payload): void {
  cam.x += (pod.x - cam.x) * CAMERA.followLerp;
  cam.y += (pod.y - cam.y) * CAMERA.followLerp;
  const speed = Math.hypot(pod.vx, pod.vy);
  cam.targetZoom = Math.max(
    CAMERA.minZoom,
    Math.min(CAMERA.maxZoom, CAMERA.maxZoom - speed * CAMERA.speedZoom),
  );
}

/** Parked in orbit: hold tight on the pod and push in for the beauty shot. */
export function followOrbit(cam: Camera, pod: Payload): void {
  cam.x += (pod.x - cam.x) * CAMERA.followLerp * 1.6;
  cam.y += (pod.y - cam.y) * CAMERA.followLerp * 1.6;
  cam.targetZoom = CAMERA.orbitZoom;
}

/** One-shot zoom punch. It recovers on its own as the zoom lerps back. */
export function kick(cam: Camera, amount: number): void {
  cam.zoom = Math.max(CAMERA.kickFloor, cam.zoom - amount);
}

export function followHome(cam: Camera, pos: Vec2): void {
  cam.x += (pos.x - cam.x) * CAMERA.idleLerp;
  cam.y += (pos.y - cam.y) * CAMERA.idleLerp;
  cam.targetZoom = CAMERA.aimZoom;
}

export function settleZoom(cam: Camera): void {
  cam.zoom += (cam.targetZoom - cam.zoom) * CAMERA.zoomLerp;
}

export function toScreen(cam: Camera, x: number, y: number): Vec2 {
  return {
    x: (x - cam.x) * cam.zoom + VIEW.width / 2,
    y: (y - cam.y) * cam.zoom + VIEW.height / 2,
  };
}

export function toWorld(cam: Camera, sx: number, sy: number): Vec2 {
  return {
    x: (sx - VIEW.width / 2) / cam.zoom + cam.x,
    y: (sy - VIEW.height / 2) / cam.zoom + cam.y,
  };
}
