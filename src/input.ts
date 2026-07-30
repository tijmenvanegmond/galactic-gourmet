import { VIEW } from './config';
import { unlock } from './audio';
import type { Input, InputHandlers, Vec2 } from './types';

export function createInput(): Input {
  return { steer: 0, thrust: false, dragging: false };
}

function canvasPoint(canvas: HTMLCanvasElement, e: PointerEvent): Vec2 {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (VIEW.width / r.width),
    y: (e.clientY - r.top) * (VIEW.height / r.height),
  };
}

export function attachInput(
  canvas: HTMLCanvasElement,
  input: Input,
  handlers: InputHandlers,
): void {
  // The audio context cannot start until the player has interacted with the
  // page, so every input path nudges it awake.
  canvas.addEventListener('pointerdown', e => {
    unlock();
    const pt = canvasPoint(canvas, e);
    if (handlers.onDragStart(pt)) input.dragging = true;
  });

  canvas.addEventListener('pointermove', e => {
    if (input.dragging) handlers.onDragMove(canvasPoint(canvas, e));
  });

  window.addEventListener('pointerup', () => {
    if (!input.dragging) return;
    input.dragging = false;
    handlers.onRelease();
  });

  window.addEventListener('keydown', e => {
    unlock();
    const k = e.key.toLowerCase();
    if ([' ', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    if (k === ' ') input.thrust = true;
    if (k === 'arrowleft' || k === 'a') input.steer = -1;
    if (k === 'arrowright' || k === 'd') input.steer = 1;
    if (k === 's' || k === 'shift') handlers.onStage();
    if (k === 'r') handlers.onRestart();
    if (k === 'm') handlers.onMute();
  });

  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === ' ') input.thrust = false;
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(k)) input.steer = 0;
  });

  const hold = (id: string, down: () => void, up: () => void): void => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', e => { e.preventDefault(); down(); });
    (['pointerup', 'pointerleave', 'pointercancel'] as const)
      .forEach(evt => el.addEventListener(evt, up));
  };

  hold('btn-left', () => { input.steer = -1; }, () => { input.steer = 0; });
  hold('btn-right', () => { input.steer = 1; }, () => { input.steer = 0; });
  hold('btn-burn', () => { input.thrust = true; }, () => { input.thrust = false; });
  document.getElementById('btn-stage')?.addEventListener('click', handlers.onStage);
  document.getElementById('btn-restart')?.addEventListener('click', handlers.onRestart);
}
