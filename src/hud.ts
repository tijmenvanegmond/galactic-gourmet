import { SIM, SPICES, STAGES } from './config';
import { heatMultiplier, scoreMultiplier, bandByLabel } from './world';
import type { BandLabel, KaijuMode, Order, Payload, SpiceName } from './types';

function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`HUD element #${id} is missing from the page`);
  return node as T;
}

function query<T extends HTMLElement = HTMLElement>(selector: string): T {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`HUD element ${selector} is missing from the page`);
  return node;
}

export const dom = {
  eta: el('eta'),
  etaLabel: el('eta-label'),
  hunger: el('hunger'),
  payloads: el('payloads'),
  score: el('score'),
  ticket: query('.ticket'),
  ticketFor: el('ticket-for'),
  ticketDone: el('ticket-done'),
  ticketSpice: el('ticket-spice'),
  kaijuName: el('kaiju-name'),
  kaijuSay: el('kaiju-say'),
  roastTrack: query('.gauge .track'),
  roastBar: el('roast-bar'),
  roastLabel: el('roast-label'),
  roastWindow: query('.window'),
  fuelBar: el('fuel-bar'),
  stageLabel: el('stage-label'),
  rack: el('rack'),
  status: el('status'),
  speed: el<HTMLInputElement>('speed'),
  speedLabel: el('speed-label'),
  mute: el<HTMLButtonElement>('btn-mute'),
};

/** Restarts a CSS animation that may already be running. */
function bump(node: HTMLElement): void {
  node.classList.remove('bump');
  void node.offsetWidth;
  node.classList.add('bump');
}

// The score counts up rather than snapping, so a big serve reads as a big serve.
let shownScore = 0;
let targetScore = 0;
const last = { hunger: -1, payloads: -1 };

export function setCounters(
  { hunger, payloads, score }: { hunger: number; payloads: number; score: number },
): void {
  if (hunger !== last.hunger) {
    dom.hunger.textContent = String(hunger);
    if (last.hunger >= 0) bump(dom.hunger);
    last.hunger = hunger;
  }
  if (payloads !== last.payloads) {
    dom.payloads.textContent = String(payloads);
    if (last.payloads >= 0) bump(dom.payloads);
    last.payloads = payloads;
  }
  targetScore = score;
}

export function resetCounters(): void {
  shownScore = 0;
  targetScore = 0;
  last.hunger = -1;
  last.payloads = -1;
  dom.score.textContent = '0';
}

/** Called once per frame to advance the rolling score. */
export function step(): void {
  if (shownScore === targetScore) return;
  const delta = targetScore - shownScore;
  shownScore += Math.abs(delta) < 1 ? delta : delta * 0.18;
  const shown = Math.round(shownScore);
  if (Math.abs(targetScore - shownScore) < 0.5) shownScore = targetScore;
  dom.score.textContent = String(shown);
}

/** The diner has a name, and it goes on the ticket. */
export function setKaijuName(name: string): void {
  dom.kaijuName.textContent = name;
  dom.ticketFor.textContent = name;
}

// Ambient barks fire on state transitions that can land in the same frame, so
// a quiet one is dropped rather than allowed to stomp the line before it.
// Anything the player must read — a verdict, an ending — forces its way in.
let lastSaid = -Infinity;
const SAY_COOLDOWN = 900;

export function say(line: string, force = false): void {
  const now = performance.now();
  if (!force && now - lastSaid < SAY_COOLDOWN) return;
  lastSaid = now;
  dom.kaijuSay.textContent = `“${line}”`;
  dom.kaijuSay.classList.remove('said');
  void dom.kaijuSay.offsetWidth;
  dom.kaijuSay.classList.add('said');
}

export function setKaijuMood(mode: KaijuMode): void {
  dom.kaijuName.classList.toggle(
    'hunting', mode === 'chase' || mode === 'lunge' || mode === 'devour',
  );
}

/**
 * One readout, two meanings: time until it turns up, then how long it will
 * tolerate waiting once it has.
 */
export function setClock(label: string, seconds: number, urgent: boolean): void {
  if (dom.etaLabel.textContent !== label) {
    dom.etaLabel.textContent = label;
    bump(dom.eta);
  }
  dom.eta.textContent = `${seconds}s`;
  dom.eta.classList.toggle('urgent', urgent);
}

export function setTicket(order: Order): void {
  dom.ticketDone.textContent = order.doneness;
  dom.ticketSpice.textContent = order.spice;
  dom.ticketSpice.style.color = SPICES[order.spice].color;

  // Move the target window on the roast gauge to the band that was ordered.
  const b = bandByLabel(order.doneness);
  dom.roastWindow.style.left = `${b.lo}%`;
  dom.roastWindow.style.right = `${Math.max(0, 100 - Math.min(100, b.hi))}%`;
  bump(dom.ticket);
}

export function rejectTicket(): void {
  dom.ticket.classList.remove('reject');
  void dom.ticket.offsetWidth;
  dom.ticket.classList.add('reject');
}

export function setRoast(heat: number, label: BandLabel, onTarget: boolean): void {
  dom.roastBar.style.width = `${Math.min(100, heat)}%`;
  dom.roastLabel.textContent = label;
  dom.roastTrack.classList.toggle('on-target', onTarget);
}

export function setStage(pod: Payload | null): void {
  if (!pod) {
    dom.fuelBar.style.width = '100%';
    dom.stageLabel.textContent = 'stage 1 · booster';
    return;
  }
  const stage = STAGES[pod.stage];
  dom.fuelBar.style.width = `${Math.max(0, (pod.fuel / stage.fuel) * 100)}%`;
  dom.stageLabel.textContent = pod.orbit
    ? `parked · ${pod.orbit.planet.name.toLowerCase()} orbit`
    : `stage ${pod.stage + 1} · ${stage.name}${pod.fuel <= 0 ? ' (dry)' : ''}`;
}

export function setRack(rack: SpiceName[]): void {
  if (!rack.length) {
    dom.rack.innerHTML = '<span class="muted">rack empty</span>';
    return;
  }
  const chips = rack
    .map(s => `<span class="chip" style="--chip:${SPICES[s].color}">${s}</span>`)
    .join('');
  dom.rack.innerHTML =
    `${chips}<span class="muted">heat ×${heatMultiplier(rack).toFixed(2)} · points ×${scoreMultiplier(rack).toFixed(1)}</span>`;
}

export function setStatus(text: string): void {
  dom.status.textContent = text;
}

export function setMuted(muted: boolean): void {
  dom.mute.textContent = muted ? 'Sound off' : 'Sound on';
  dom.mute.classList.toggle('off', muted);
}

export function bindMute(onToggle: () => boolean): void {
  dom.mute.addEventListener('click', () => setMuted(onToggle()));
}

export function bindSpeed(onChange?: () => void): void {
  dom.speed.min = String(SIM.dtMin);
  dom.speed.max = String(SIM.dtMax);
  dom.speed.step = '0.05';
  dom.speed.value = String(SIM.dt);
  dom.speedLabel.textContent = `${SIM.dt.toFixed(2)}×`;
  dom.speed.addEventListener('input', () => {
    SIM.dt = parseFloat(dom.speed.value);
    dom.speedLabel.textContent = `${SIM.dt.toFixed(2)}×`;
    onChange?.();
  });
}
