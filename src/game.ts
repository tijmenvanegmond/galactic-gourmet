import {
  SIM, VIEW, LAUNCH, SPICES, SPICE_NAMES, SERVEABLE, SCORE, SOL, PALETTE, JUICE,
} from './config';
import {
  planetPos, planetVel, homePlanet, bandFor, bandIndex,
  scoreMultiplier, heatProximity,
} from './world';
import { predict } from './trajectory';
import {
  createPayload, stepPayload, jettison, currentStage, relaunch,
  LOST_TO_STAR,
} from './payload';
import {
  createKaiju, stepKaiju, kaijuClock, enrage, appease, grabRadius,
} from './kaiju';
import { bark, shortName } from './voice';
import {
  createCamera, followPayload, followOrbit, followHome, settleZoom, toWorld, kick,
} from './camera';
import { render } from './render';
import { createInput, attachInput } from './input';
import { createJuice, shake, freeze, flash, ring, pop, stepJuice } from './juice';
import * as audio from './audio';
import * as hud from './hud';
import type {
  GameState, Order, Particle, ParticleKind, Payload, PayloadHooks, Planet,
  SpicedPlanet, Vec2,
} from './types';

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');
  return ctx;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function startGame(canvas: HTMLCanvasElement): void {
  const ctx = context2d(canvas);
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;

  const input = createInput();

  // ---- lifecycle ----------------------------------------------------------
  function rollOrder(): Order {
    return {
      doneness: SERVEABLE[Math.floor(Math.random() * SERVEABLE.length)],
      spice: SPICE_NAMES[Math.floor(Math.random() * SPICE_NAMES.length)],
    };
  }

  function createState(): GameState {
    const level = structuredClone(SOL);
    const home = homePlanet(level.planets);
    const h = planetPos(home, 0);

    return {
      level,
      home,
      t: 0,
      phase: 'aim',
      score: 0,
      hunger: level.hunger,
      payloads: level.payloads,
      pod: null,
      aim: null,
      dragOffset: null,
      particles: [],
      ghosts: [],
      juice: createJuice(),
      kaiju: createKaiju(level, home, 0),
      cam: createCamera(h.x, h.y),
      order: rollOrder(),
    };
  }

  let state: GameState = createState();

  function reset(): void {
    state = createState();

    hud.resetCounters();
    hud.setKaijuName(state.kaiju.name);
    hud.setKaijuMood('hunt');
    hud.say(bark('arrive'), true);
    hud.setTicket(state.order);
    hud.setCounters(state);
    hud.setRoast(0, 'raw', false);
    hud.setStage(null);
    hud.setRack([]);
    hud.setStatus('Drag back from Earth and release. R restarts.');
  }

  function newOrder(): void {
    state.order = rollOrder();
    hud.setTicket(state.order);
  }

  // ---- effects ------------------------------------------------------------
  function emit(
    x: number,
    y: number,
    color: string,
    n: number,
    spread: number,
    kind: ParticleKind = 'spark',
    size = 2.2,
    decay = 0.022,
  ): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * spread;
      const p: Particle = {
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1,
        decay: decay * (0.7 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8),
        color, kind,
      };
      state.particles.push(p);
    }
  }

  const hooks: PayloadHooks = {
    exhaust(pod: Payload) {
      state.particles.push({
        x: pod.x - Math.cos(pod.angle) * 9,
        y: pod.y - Math.sin(pod.angle) * 9,
        vx: -Math.cos(pod.angle) * 1.8 + (Math.random() - 0.5),
        vy: -Math.sin(pod.angle) * 1.8 + (Math.random() - 0.5),
        life: 0.7, decay: 0.03, size: 2.4,
        color: PALETTE.exhaust, kind: 'ember',
      });
    },
    pickup(pod: Payload, planet: SpicedPlanet) {
      const color = SPICES[planet.spice].color;
      hud.setRack(pod.rack);
      hud.setStatus(`Picked up ${planet.spice} at ${planet.name}.`);
      emit(pod.x, pod.y, color, 18, 3.2);
      ring(state.juice, pod.x, pod.y, color, 2.4, 2, 0.05);
      pop(state.juice, pod.x, pod.y - 14, planet.spice.toUpperCase(), color, 11);
      shake(state.juice, 0.12);
      audio.sfx.pickup();
    },
  };

  // ---- aiming -------------------------------------------------------------
  /** Drags measure from the pod while parked, and from Earth otherwise. */
  function anchor(): Vec2 {
    const pod = state.pod;
    if (pod && pod.orbit) return { x: pod.x, y: pod.y };
    return planetPos(state.home, state.t);
  }

  function setDragOffset(pt: Vec2): void {
    const w = toWorld(state.cam, pt.x, pt.y);
    const a = anchor();
    const dx = w.x - a.x, dy = w.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.max(LAUNCH.minPull, Math.min(LAUNCH.maxPull, len));
    state.dragOffset = { x: (dx / len) * clamped, y: (dy / len) * clamped };
  }

  // Recomputed every frame from the anchor's *current* position, so the pad
  // stays welded to Earth while it orbits — and to the pod while it is parked.
  function refreshAim(): void {
    const off = state.dragOffset;
    if (!off) { state.aim = null; return; }

    const len = Math.hypot(off.x, off.y) || 1;
    const ux = -off.x / len, uy = -off.y / len;
    const pod = state.pod;

    let originX: number, originY: number;
    let baseVx: number, baseVy: number;
    let handleX: number, handleY: number;
    let ignore: Planet;

    if (pod && pod.orbit) {
      originX = pod.x; originY = pod.y;
      baseVx = pod.vx; baseVy = pod.vy;
      handleX = pod.x + off.x; handleY = pod.y + off.y;
      ignore = pod.orbit.planet;
    } else {
      const h = planetPos(state.home, state.t);
      const hv = planetVel(state.home, state.t);
      originX = h.x + ux * (state.home.radius + LAUNCH.padOffset);
      originY = h.y + uy * (state.home.radius + LAUNCH.padOffset);
      baseVx = hv.x; baseVy = hv.y;
      handleX = h.x + off.x; handleY = h.y + off.y;
      ignore = state.home;
    }

    const vx = ux * len * LAUNCH.impulse + baseVx;
    const vy = uy * len * LAUNCH.impulse + baseVy;
    const p = predict(vx, vy, originX, originY, state.t, state.level, ignore);

    state.aim = {
      originX, originY, vx, vy, handleX, handleY,
      power: clamp01((len - LAUNCH.minPull) / (LAUNCH.maxPull - LAUNCH.minPull)),
      points: p.points, heat: p.heat, held: p.held,
    };
  }

  function release(): void {
    const a = state.aim;
    if (!a) return;
    const pod = state.pod;

    if (state.phase === 'orbit' && pod) {
      // Same dish, new shot — a relaunch costs nothing but time.
      relaunch(pod, a.vx, a.vy);
      state.phase = 'flight';
      emit(pod.x, pod.y, PALETTE.exhaust, 20, 3.4, 'ember', 2.6);
      ring(state.juice, pod.x, pod.y, PALETTE.heading, 3.4, 2.2, 0.045);
      shake(state.juice, 0.22 + a.power * 0.2);
      kick(state.cam, 0.10);
      audio.sfx.relaunch(a.power);
      hud.setStatus('Relaunched. Burn to steer it into the kaiju.');
    } else {
      if (state.phase !== 'aim' || state.payloads <= 0) return;
      state.pod = createPayload(a.originX, a.originY, a.vx, a.vy, state.home);
      state.payloads -= 1;
      state.phase = 'flight';
      emit(a.originX, a.originY, PALETTE.exhaust, 24, 3.6, 'ember', 2.6);
      ring(state.juice, a.originX, a.originY, PALETTE.exhaust, 3.6, 2.4, 0.04);
      shake(state.juice, 0.25 + a.power * 0.25);
      kick(state.cam, 0.12);
      audio.sfx.launch(a.power);
      hud.setCounters(state);
      hud.setRack([]);
      hud.setStatus('Hold burn to thrust, arrows to steer, S to drop a stage.');
    }

    state.dragOffset = null;
    state.aim = null;
  }

  // ---- capture ------------------------------------------------------------
  function onCapture(planet: Planet): void {
    const pod = state.pod;
    if (!pod) return;

    state.phase = 'orbit';
    state.dragOffset = null;
    state.aim = null;

    emit(pod.x, pod.y, planet.fill, 20, 3.4, 'debris', 2.2);
    emit(pod.x, pod.y, PALETTE.smoke, 10, 1.6, 'smoke', 3.2, 0.016);
    ring(state.juice, pod.x, pod.y, PALETTE.predictCapture, 4.2, 3, 0.03);
    pop(state.juice, pod.x, pod.y - 20, `${planet.name.toUpperCase()} ORBIT`,
      PALETTE.predictCapture, 12);
    shake(state.juice, 0.5);
    freeze(state.juice, JUICE.freezeCapture);
    kick(state.cam, 0.08);
    audio.sfx.capture();

    hud.setStage(pod);
    hud.setStatus(`Caught by ${planet.name}. It keeps cooking up there — drag to relaunch.`);
  }

  // ---- resolution ---------------------------------------------------------
  function resolve(reason: string, fed: boolean): void {
    const pod = state.pod;
    if (!pod) return;
    const b = bandFor(pod.heat);

    if (fed) {
      const want = bandIndex(state.order.doneness);
      const got = bandIndex(b.label);
      let points = !SERVEABLE.includes(b.label) ? 0
        : got === want ? SCORE.exactBand
        : Math.abs(got - want) === 1 ? SCORE.offByOne
        : SCORE.offByMore;

      if (pod.rack.includes(state.order.spice)) points *= SCORE.spiceMatch;
      points = Math.round(points * scoreMultiplier(pod.rack));

      state.score += points;
      state.hunger = Math.max(0, state.hunger - points);

      if (points === 0) {
        // An insult costs it patience as well as making it faster.
        const lost = enrage(state.kaiju, state.level.kaiju);
        hud.setStatus(
          `Rejected — ${b.label}. ${shortName(state.kaiju.name)} speeds up, −${lost}s patience.`);
        hud.say(bark('reject'), true);
        hud.rejectTicket();
        flash(state.juice, PALETTE.kaijuRage, 0.35);
        shake(state.juice, 0.7);
        freeze(state.juice, JUICE.freezeReject);
        pop(state.juice, pod.x, pod.y - 18, 'REJECTED', PALETTE.kaijuRage, 14);
        if (lost > 0) pop(state.juice, pod.x, pod.y - 36, `−${lost}s`, PALETTE.kaijuRage, 13);
        audio.sfx.reject();
      } else {
        // A dish it likes buys you more time to cook the next one.
        const gained = appease(state.kaiju, state.level.kaiju);
        const rack = pod.rack.length ? ` with ${pod.rack.join(' + ')}` : ' plain';
        const bought = gained > 0 ? ` +${gained}s patience.` : '';
        hud.setStatus(`Served ${b.label}${rack}. +${points}.${bought}`);
        hud.say(bark(got === want ? 'perfect' : 'good'), true);
        flash(state.juice, '#FFFFFF', points >= SCORE.exactBand ? 0.4 : 0.22);
        shake(state.juice, 0.45 + Math.min(0.4, points / 400));
        freeze(state.juice, JUICE.freezeServe);
        pop(state.juice, pod.x, pod.y - 18, `+${points}`, PALETTE.exhaust,
          points >= SCORE.exactBand ? 18 : 14);
        if (gained > 0) {
          pop(state.juice, pod.x, pod.y - 38, `+${gained}s`, PALETTE.heading, 13);
        }
        audio.sfx.serve(got === want ? 2 : 1);
      }
      emit(pod.x, pod.y, b.fill, 34, 5, 'spark', 2.6);
      ring(state.juice, pod.x, pod.y, b.fill, 5, 3.4, 0.028);
    } else {
      hud.setStatus(`Payload lost — ${reason}.`);
      state.ghosts.push({ x: pod.x, y: pod.y, band: Math.max(0, bandIndex(b.label)), life: 1 });

      if (reason === LOST_TO_STAR) {
        emit(pod.x, pod.y, PALETTE.sun, 30, 5.5, 'spark', 3);
        emit(pod.x, pod.y, PALETTE.smoke, 14, 2, 'smoke', 3.4, 0.014);
        ring(state.juice, pod.x, pod.y, PALETTE.sun, 5.5, 3.4, 0.03);
        flash(state.juice, PALETTE.sun, 0.45);
        shake(state.juice, 0.8);
        freeze(state.juice, JUICE.freezeVaporise);
        audio.sfx.vaporise();
      } else {
        emit(pod.x, pod.y, b.fill, 14, 2.4);
        shake(state.juice, 0.2);
        audio.sfx.drift();
      }
    }

    state.pod = null;
    state.phase = 'aim';
    hud.setCounters(state);
    hud.setRoast(0, 'raw', false);
    hud.setStage(null);
    hud.setRack([]);
    audio.setSizzle(0);

    if (state.hunger <= 0) {
      state.phase = 'won';
      flash(state.juice, PALETTE.heading, 0.5);
      audio.sfx.win();
      hud.say(bark('win'), true);
      hud.setStatus(`${shortName(state.kaiju.name)} is satisfied. ${state.level.name} survives — final score ${state.score}. R to play again.`);
    } else if (state.payloads <= 0) {
      state.phase = 'lost';
      audio.sfx.lose();
      hud.say(bark('lose'), true);
      hud.setStatus(`Out of payloads. Earth is on the menu — score ${state.score}. R to try again.`);
    } else {
      newOrder();
    }
  }

  // ---- the diner ----------------------------------------------------------
  // It cruises at Earth until a dish comes within range, then forgets the
  // planet entirely and goes after the food.
  function stepDiner(): void {
    const k = state.kaiju;
    const cfg = state.level.kaiju;
    const step = stepKaiju(k, state.t, state.home, state.pod, cfg);

    if (step.spotted) {
      hud.say(bark('spot'));
      pop(state.juice, k.x, k.y - 36, 'SPOTTED YOU', PALETTE.kaijuRage, 12);
      shake(state.juice, 0.18);
      audio.sfx.growl();
    }
    if (step.lunged) {
      const shout = bark('lunge');
      hud.say(shout);
      pop(state.juice, k.x, k.y - 32, shout, PALETTE.kaijuRage, 16);
      ring(state.juice, k.x, k.y, PALETTE.kaijuRage, 4, 2.6, 0.04);
      shake(state.juice, 0.32);
      audio.sfx.roar();
    }
    if (step.loitered) {
      hud.say(bark('loiter'), true);
      pop(state.juice, k.x, k.y - 40, 'WAITING', PALETTE.kaijuRage, 12);
      audio.sfx.growl();
    }
    if (step.impatient) {
      hud.say(bark('impatient'), true);
      shake(state.juice, 0.25);
      audio.sfx.growl();
    }
    if (step.committed) {
      hud.say(bark('devour'), true);
      pop(state.juice, k.x, k.y - 40, 'DONE WAITING', PALETTE.kaijuRage, 15);
      flash(state.juice, PALETTE.kaijuRage, 0.3);
      ring(state.juice, k.x, k.y, PALETTE.kaijuRage, 5, 3, 0.03);
      shake(state.juice, 0.6);
      audio.sfx.roar();
      hud.setStatus(`${shortName(k.name)} is done waiting. Earth is next.`);
    }

    hud.setKaijuMood(k.mode);

    // drool, as one does
    if ((k.mode === 'chase' || k.mode === 'lunge') && Math.random() < 0.35) {
      emit(k.x + (Math.random() - 0.5) * 22, k.y + 14, PALETTE.heading, 1, 0.4,
        'smoke', 1.6, 0.028);
    }

    if (step.reachedHome) {
      state.phase = 'lost';
      flash(state.juice, PALETTE.kaijuRage, 0.6);
      shake(state.juice, 1);
      audio.sfx.lose();
      hud.say(bark('lose'), true);
      hud.setStatus(`${shortName(k.name)} ate Earth. Score ${state.score}. R to try again.`);
    }

    const clock = kaijuClock(k, cfg);
    hud.setClock(clock.label, clock.seconds, clock.urgent);
  }

  // ---- frame --------------------------------------------------------------
  function update(): void {
    const j = state.juice;

    if (state.phase === 'won' || state.phase === 'lost') {
      stepJuice(j);
      stepEffects();
      return;
    }
    // Hit-stop: the sim holds, the screen keeps shaking.
    if (j.freeze > 0) {
      j.freeze -= 1;
      stepJuice(j);
      return;
    }

    state.t += SIM.dt;

    stepDiner();

    if (state.phase === 'aim' || state.phase === 'orbit') refreshAim();

    const pod = state.pod;
    if (pod) {
      const outcome = stepPayload(pod, state.t, state.level, input, hooks);

      const prox = heatProximity(Math.hypot(pod.x, pod.y));
      if (prox > 0.3 && Math.random() < prox) {
        emit(pod.x, pod.y, prox > 0.6 ? PALETTE.sun : PALETTE.smoke, 1, 0.8,
          prox > 0.6 ? 'ember' : 'smoke', 2.4, 0.02);
      }
      audio.setSizzle(prox * prox);

      const band = bandFor(pod.heat);
      hud.setRoast(pod.heat, band.label, band.label === state.order.doneness);
      hud.setStage(pod);

      const k = state.kaiju;
      if (Math.hypot(pod.x - k.x, pod.y - k.y) < grabRadius(k, state.level.kaiju)) {
        resolve('', true);
      } else if (outcome.kind === 'captured') {
        onCapture(outcome.planet);
      } else if (outcome.kind === 'lost') {
        resolve(outcome.reason, false);
      }

      if (state.pod) {
        state.pod.orbit ? followOrbit(state.cam, state.pod) : followPayload(state.cam, state.pod);
      }
    } else {
      followHome(state.cam, planetPos(state.home, state.t));
      audio.setSizzle(0);
    }

    settleZoom(state.cam);
    stepJuice(j);
    stepEffects();
  }

  function stepEffects(): void {
    for (const p of state.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.life -= p.decay;
    }
    state.particles = state.particles.filter(p => p.life > 0);

    for (const g of state.ghosts) g.life -= 0.003;
    state.ghosts = state.ghosts.filter(g => g.life > 0);
  }

  function frame(): void {
    update();
    hud.step();
    render(ctx, state);
    requestAnimationFrame(frame);
  }

  // ---- wiring -------------------------------------------------------------
  attachInput(canvas, input, {
    onDragStart(pt) {
      if (state.phase === 'orbit' && state.pod) { setDragOffset(pt); return true; }
      if (state.phase !== 'aim' || state.payloads <= 0) return false;
      setDragOffset(pt);
      return true;
    },
    onDragMove(pt) { setDragOffset(pt); },
    onRelease: release,
    onStage() {
      const pod = state.pod;
      if (pod && !pod.orbit && jettison(pod)) {
        emit(pod.x, pod.y, PALETTE.smoke, 14, 2.6, 'debris', 2);
        shake(state.juice, 0.3);
        audio.sfx.stage();
        hud.setStage(pod);
        hud.setStatus(`Stage ${pod.stage + 1} armed — ${currentStage(pod).name}.`);
      }
    },
    onRestart: reset,
    onMute() { hud.setMuted(audio.toggleMute()); },
  });

  hud.bindSpeed();
  hud.bindMute(audio.toggleMute);
  hud.setMuted(audio.isMuted());
  reset();
  frame();
}
