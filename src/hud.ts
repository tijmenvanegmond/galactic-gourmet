import { SIM } from './config';

// ---------------------------------------------------------------------------
// What is left of the DOM HUD. The readouts, the ticket, the gauges and the
// diner's profile all moved onto the canvas — see panels.ts, which reads game
// state directly. This is only the chrome that lives outside the frame: the
// status line and the two controls.
//
// Every hook is optional. Delete a row from index.html and the thing it fed
// stops updating; only the canvas itself is required, and main.ts checks that.
// ---------------------------------------------------------------------------

function el<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export const dom = {
  status: el('status'),
  speed: el<HTMLInputElement>('speed'),
  speedLabel: el('speed-label'),
};

const setText = (node: HTMLElement | null, value: string): void => {
  if (node) node.textContent = value;
};

export function setStatus(text: string): void {
  setText(dom.status, text);
}

export function bindSpeed(onChange?: () => void): void {
  const slider = dom.speed;
  if (!slider) return;
  slider.min = String(SIM.dtMin);
  slider.max = String(SIM.dtMax);
  slider.step = '0.05';
  slider.value = String(SIM.dt);
  setText(dom.speedLabel, `${SIM.dt.toFixed(2)}×`);
  slider.addEventListener('input', () => {
    SIM.dt = parseFloat(slider.value);
    setText(dom.speedLabel, `${SIM.dt.toFixed(2)}×`);
    onChange?.();
  });
}
