// ---------------------------------------------------------------------------
// Galactic Gourmet — tuning
// Everything adjustable lives here. No numbers in the logic files.
// ---------------------------------------------------------------------------

import type { Band, BandLabel, Level, Spice, SpiceName, Stage } from './types';

export const SIM = {
  // Seconds of simulation advanced per rendered frame, in arbitrary sim units.
  // 1.0 = the old breakneck pace. Lower is slower. Live-adjustable in the HUD.
  dt: 0.40,
  dtMin: 0.10,
  dtMax: 1.00,
};

export const VIEW = {
  width: 640,
  height: 430,
};

export const SUN = {
  x: 0,
  y: 0,
  radius: 54,
  gm: 42000,
  soft: 2600,        // gravity softening, stops the singularity at r→0
  heatRadius: 380,   // outside this, nothing cooks
  heatRate: 1.30,    // roast units per sim-second at the surface
  // Falloff exponent. 2.0 crams all the heat into the corona, which makes the
  // gap between "raw" and "vaporised" almost unflyable. Lower spreads the
  // oven outward and gives the player a real grazing envelope.
  heatFalloff: 1.15,
};

export const PHYSICS = {
  planetSoft: 2200,     // softening for planet wells
  clearance: 46,        // pod ignores a just-left planet inside this margin
  worldBoundary: 1750,  // past this the payload is lost to deep space
};

export const LAUNCH = {
  minPull: 40,
  maxPull: 230,
  impulse: 0.052,   // pull length -> launch speed
  padOffset: 30,    // spawn distance above the home planet's surface
};

// --- capture orbits ---------------------------------------------------------
// Hitting a planet parks the payload in orbit instead of destroying it. It
// keeps cooking up there, so a low orbit near the star is an oven timer, and
// a relaunch inherits the orbital velocity.
export const ORBIT = {
  altitude: 18,      // parking height above the surface
  rate: 0.055,       // radians per sim-second at refRadius
  refRadius: 34,     // orbits tighter than this sweep proportionally faster
  inheritVelocity: 1.0,
};

export const CAMERA = {
  followLerp: 0.09,
  idleLerp: 0.06,
  zoomLerp: 0.05,
  aimZoom: 0.82,
  orbitZoom: 0.95,   // push in for the parked beauty shot
  minZoom: 0.34,
  maxZoom: 0.72,
  speedZoom: 0.022,  // how hard speed pulls the zoom out
  kickFloor: 0.22,   // a zoom punch can never shove past this
};

export const PREDICT = {
  steps: 900,
  sample: 12,
};

// --- game feel --------------------------------------------------------------
export const JUICE = {
  shakeDecay: 0.055,
  shakePixels: 22,    // screen offset at trauma 1
  shakeRoll: 0.012,   // radians of camera roll at trauma 1
  flashDecay: 0.10,
  freezeCapture: 3,
  freezeServe: 7,
  freezeReject: 5,
  freezeVaporise: 5,
  starCount: 260,
  starParallax: 0.30,
  trailLength: 150,
};

export const AUDIO = {
  master: 0.20,
  sizzleGain: 0.055,
};

// --- spices -----------------------------------------------------------------
// heat: multiplies roast rate.  score: multiplies final points.
// Effects stack multiplicatively when a payload carries several.
export const SPICES: Record<SpiceName, Spice> = {
  peppercorn: { heat: 0.55, score: 1.0, color: '#8C8A82', note: 'heat shield' },
  paprika:    { heat: 1.75, score: 1.0, color: '#D85A30', note: 'cooks fast' },
  saffron:    { heat: 1.00, score: 2.0, color: '#EFA827', note: 'double points' },
};

export const SPICE_NAMES = Object.keys(SPICES) as SpiceName[];

// --- roast bands ------------------------------------------------------------
export const BANDS: Band[] = [
  { label: 'raw',             lo: 0,   hi: 26,       fill: '#F1EFE8', edge: '#8C8A82' },
  { label: 'lightly toasted', lo: 26,  hi: 52,       fill: '#FAC775', edge: '#854F0B' },
  { label: 'golden brown',    lo: 52,  hi: 78,       fill: '#D85A30', edge: '#4A1B0C' },
  { label: 'well done',       lo: 78,  hi: 100,      fill: '#993C1D', edge: '#4A1B0C' },
  { label: 'charcoal',        lo: 100, hi: Infinity, fill: '#2C2C2A', edge: '#0B0B0B' },
];
export const SERVEABLE: BandLabel[] = ['lightly toasted', 'golden brown', 'well done'];

// --- stages -----------------------------------------------------------------
// Dropping a stage forfeits its remaining fuel and arms the next one.
export const STAGES: Stage[] = [
  { name: 'booster', thrust: 0.15, fuel: 120 },
  { name: 'kick',    thrust: 0.36, fuel: 46  },  // brief, violent, for periapsis trims
  { name: 'trim',    thrust: 0.08, fuel: 95  },
];

// --- level 1: Sol -----------------------------------------------------------
export const SOL: Level = {
  name: 'Sol',
  spiceRing: 36,
  planets: [
    { name: 'Mercury', orbit: 175, a0: 0.6, w: 0.0075, radius: 11, gm: 260, fill: '#B4B2A9', edge: '#5F5E5A', style: 'rocky',  spice: 'peppercorn' },
    { name: 'Venus',   orbit: 295, a0: 2.4, w: -0.0044, radius: 17, gm: 620, fill: '#FAC775', edge: '#854F0B', style: 'banded', spice: 'paprika' },
    { name: 'Earth',   orbit: 435, a0: 3.9, w: 0.0029, radius: 19, gm: 700, fill: '#85B7EB', edge: '#0C447C', style: 'terran', home: true },
    { name: 'Mars',    orbit: 600, a0: 1.2, w: 0.0018, radius: 13, gm: 420, fill: '#F0997B', edge: '#712B13', style: 'rocky',  spice: 'saffron' },
  ],
  payloads: 5,
  hunger: 100,
  kaiju: {
    speed: 0.20,           // patient cruise toward the planet — the doom clock
    spawnRadius: 1300,
    spawnAngleOffset: 0.6,
    captureRadius: 34,
    rejectSpeedup: 1.30,   // feeding it something inedible makes it angrier
    // Hunting. Chase and lunge are absolute speeds rather than multiples of
    // the cruise, because they have to beat a planet's orbital motion (~1.3
    // units/sim-second) or a parked dish could never be caught.
    senseRadius: 300,
    loseInterest: 1.35,
    lungeRadius: 120,
    chaseSpeed: 1.50,
    lungeSpeed: 3.60,
    grabReach: 18,
    // It does not dive straight at the planet. It pulls up at this ring and
    // prowls, which is the window you actually get to cook in — and it is
    // close enough that feeding it becomes a much shorter shot.
    loiterRadius: 185,
    // Must beat Earth's own orbital motion (~1.3 units/sim-second) or it could
    // never hold station once it arrived — the ring would slide out from under
    // it every lap.
    loiterSpeed: 1.80,
    loiterLead: 0.30,
    // Once it stops waiting it charges. The slow cruise is for crossing deep
    // space, not for the last two hundred units.
    devourSpeed: 2.40,
    patience: 900,        // sim-seconds; ≈37s of wall clock at dt 0.40
    patienceServe: 260,   // a dish it likes buys you this much more
    patienceReject: 220,  // an insult costs this much, on top of the speed-up
    // Serpent body.
    segments: 11,
    segmentSpacing: 13,
    headRadius: 21,
    tailRadius: 4.5,
    slitherAmp: 0.62,
    slitherChase: 0.30,
    slitherStrike: 0.06,
    slitherFreq: 0.10,
  },
};

// --- scoring ----------------------------------------------------------------
export const SCORE = {
  exactBand: 100,
  offByOne: 40,
  offByMore: 15,
  spiceMatch: 2,   // multiplier when the rack contains the craved spice
};

// --- palette ----------------------------------------------------------------
export const PALETTE = {
  sun: '#EFA827',
  sunCore: '#FFF3D0',
  sunGlowOuter: 'rgba(239,168,39,0.06)',
  sunGlowInner: 'rgba(239,168,39,0.13)',
  orbitLine: 'rgba(140,138,130,0.26)',
  coronaLine: 'rgba(133,79,11,0.40)',
  trail: 'rgba(140,138,130,0.45)',
  heading: '#9FE1CB',
  exhaust: '#EFA827',
  smoke: '#B4B2A9',
  star: '#E8E4D6',
  kaijuBody: '#712B13',
  kaijuEdge: '#2C2C2A',
  kaijuAura: 'rgba(113,43,19,0.20)',
  kaijuEye: '#F1EFE8',
  kaijuRage: '#D85A30',
  label: 'rgba(140,138,130,0.90)',
  predict: 'rgba(186,182,170,0.85)',
  predictEnd: '#712B13',
  predictGolden: '#D85A30',
  predictCapture: '#9FE1CB',
  minimapBg: 'rgba(28,28,26,0.55)',
  minimapEdge: 'rgba(140,138,130,0.50)',
};
