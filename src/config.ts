// ---------------------------------------------------------------------------
// Galactic Gourmet — tuning
// Everything adjustable lives here. No numbers in the logic files.
// ---------------------------------------------------------------------------

import type { Band, BandLabel, Level, Planet, Spice, SpiceName, Stage } from './types';

export const SIM = {
  // Seconds of simulation advanced per rendered frame, in arbitrary sim units.
  // 1.0 = the old breakneck pace. Lower is slower. Live-adjustable in the HUD.
  dt: 0.40,
  dtMin: 0.10,
  dtMax: 1.00,
};

// The live viewport in CSS pixels. These are only the values before the first
// fit — viewport.ts overwrites both from the canvas's real size and keeps them
// current, so a resize shows more or less of the world instead of stretching.
export const VIEW = {
  width: 640,
  height: 480,
};

/** Screen-space chrome drawn onto the canvas rather than around it. */
export const PANELS = {
  consoleHeight: 70,
  profileWidth: 218,
  profileHeight: 66,
  margin: 10,
  chatterWidth: 300,
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
  worldBoundary: 2400,  // past this the payload is lost to deep space
  // Radians per sim-second the pod can swing its nose. Fast enough that
  // pointing at a target reads as pointing rather than as waiting: a
  // half-turn takes well under a second, so the burn is what you steer with.
  turnRate: 0.33,
};

export const LAUNCH = {
  minPull: 10,
  maxPull: 100,
  impulse: 0.040,   // pull length -> launch speed
  padOffset: 25,    // spawn distance above the home planet's surface
  /**
   * How much of a real circular orbit's velocity a launch is given for free.
   *
   * The planets ride slow kinematic rails — Earth's is 1.3 units/s where a
   * true orbit at its radius needs 9.8 — so inheriting *their* motion
   * inherited nothing, and every dish had to buy the whole climb out of the
   * star's well from a standing start. That is what made Mercury and Venus a
   * sentence: deepest well, hottest oven, no way back out.
   *
   * Borrowing the orbit the launch point ought to have scales itself. It is
   * largest exactly where the well is deepest, so it fixes Mercury without
   * over-serving Mars, which no single constant could do.
   *
   * At 1 a released dish simply orbits, and reaching the star means throwing
   * retrograde hard enough to kill that speed. Not a gentle dial: anything
   * less than 1 is an ellipse that dips inward, so lowering it makes the star
   * easier to reach and everything else harder to hold — and near the star the
   * dip is fatal rather than useful.
   */
  inheritOrbital: 1.0,
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

// --- drag steering ----------------------------------------------------------
// There is no keyboard on a phone, so a drag during flight flies the pod: it
// turns toward wherever the finger is and burns on the way. Both distances are
// screen pixels — measured from the pod, not from where the drag began.
export const STICK = {
  /** Inside this, a drag is neither steering nor burning: a thumb resting on
   *  the ship should not spin it, and it is where you go to cut the engine. */
  deadzone: 30,
  /** The reticle drawn at the finger. */
  reticle: 13,
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
// Declared as bindings rather than inline so moons can point at their parent.
// structuredClone preserves those references when the level is copied.

const MERCURY: Planet = { name: 'Mercury', orbit: 175, a0: 0.6, w: 0.0075, radius: 11, gm: 260, fill: '#B4B2A9', edge: '#5F5E5A', style: 'rocky', spice: 'peppercorn' };
const VENUS: Planet   = { name: 'Venus',   orbit: 295, a0: 2.4, w: -0.0044, radius: 17, gm: 620, fill: '#FAC775', edge: '#854F0B', style: 'banded', spice: 'paprika' };
const EARTH: Planet   = { name: 'Earth',   orbit: 435, a0: 3.9, w: 0.0029, radius: 19, gm: 700, fill: '#85B7EB', edge: '#0C447C', style: 'terran', home: true };
const MARS: Planet    = { name: 'Mars',    orbit: 600, a0: 1.2, w: 0.0018, radius: 13, gm: 420, fill: '#F0997B', edge: '#712B13', style: 'rocky', spice: 'saffron' };

// The giants are deep wells and nothing to land on. They bend a shot hard
// enough to be worth aiming at, and swallow one that arrives.
const JUPITER: Planet = { name: 'Jupiter', orbit: 880,  a0: 5.1, w: 0.00090, radius: 46, gm: 3000, fill: '#D9A066', edge: '#7A4B22', style: 'giant', gas: true };
const SATURN: Planet  = { name: 'Saturn',  orbit: 1150, a0: 2.0, w: 0.00062, radius: 38, gm: 2300, fill: '#E3C68A', edge: '#8A6B36', style: 'giant', gas: true, rings: true };
const URANUS: Planet  = { name: 'Uranus',  orbit: 1400, a0: 3.4, w: 0.00042, radius: 26, gm: 1200, fill: '#A6E0DF', edge: '#2F6E70', style: 'ice', gas: true };
const NEPTUNE: Planet = { name: 'Neptune', orbit: 1620, a0: 0.9, w: 0.00031, radius: 25, gm: 1300, fill: '#7C9BE6', edge: '#22346E', style: 'ice', gas: true };

// Moons are the only solid ground out there, which is what makes the outer
// system flyable: you cannot park on a giant, but you can park around its moon.
const IO: Planet     = { name: 'Io',     orbit: 82,  a0: 0.3, w: 0.030, radius: 5.5, gm: 95,  fill: '#E8D26B', edge: '#8A7420', style: 'rocky', parent: JUPITER };
const EUROPA: Planet = { name: 'Europa', orbit: 120, a0: 2.6, w: 0.021, radius: 5,   gm: 80,  fill: '#DCE6EA', edge: '#6E7E88', style: 'ice',   parent: JUPITER };
const TITAN: Planet  = { name: 'Titan',  orbit: 94,  a0: 1.4, w: 0.024, radius: 6.5, gm: 115, fill: '#D8A657', edge: '#7A5520', style: 'banded', parent: SATURN };
const TRITON: Planet = { name: 'Triton', orbit: 68,  a0: 4.2, w: -0.026, radius: 4.5, gm: 70, fill: '#CFE0E8', edge: '#5A737F', style: 'rocky', parent: NEPTUNE };

export const SOL: Level = {
  name: 'Sol',
  spiceRing: 36,
  planets: [
    MERCURY, VENUS, EARTH, MARS,
    JUPITER, IO, EUROPA,
    SATURN, TITAN,
    URANUS,
    NEPTUNE, TRITON,
  ],
  payloads: 5,
  hunger: 100,
  kaiju: {
    // Cruise between worlds. It has a whole system to get through, so this is
    // a travel speed rather than the old creep — a hop between neighbouring
    // orbits lands around fifteen seconds of wall clock.
    speed: 1.40,
    // How many worlds it works through before Earth. Every planet is a
    // candidate, but touring all eight would outlast the five dishes you get
    // to answer with, so each run draws a different few.
    tourStops: 3,
    // It arrives just outside the first stop rather than at a fixed radius, so
    // the opening leg is the same short hop wherever the tour begins. The
    // angle is small on purpose: at Neptune's radius even half a radian is a
    // journey.
    spawnMargin: 320,
    spawnAngleOffset: 0.12,
    captureRadius: 34,
    rejectSpeedup: 1.30,   // feeding it something inedible makes it angrier
    // Hunting. Chase and lunge are absolute speeds rather than multiples of
    // the cruise, because they have to beat a planet's orbital motion (~1.3
    // units/sim-second) or a parked dish could never be caught.
    senseRadius: 600,
    loseInterest: 1.35,
    lungeRadius: 170,
    chaseSpeed: 2.20,
    lungeSpeed: 4.60,
    grabReach: 18,
    // It does not dive straight at the planet. It pulls up at this ring and
    // prowls, which is the window you actually get to cook in — and it is
    // close enough that feeding it becomes a much shorter shot.
    loiterRadius: 185,
    // Must beat Earth's own orbital motion (~1.3 units/sim-second) or it could
    // never hold station once it arrived — the ring would slide out from under
    // it every lap.
    loiterSpeed: 2.20,
    loiterLead: 0.30,
    // Once it stops waiting it charges. The cruise is for crossing deep
    // space, not for the last two hundred units.
    devourSpeed: 3.20,
    patience: 900,        // sim-seconds at Earth; ≈37s of wall clock at dt 0.40
    visitTime: 360,       // ≈15s of prowling at each of the other worlds
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
  ink: '#E8E4D6',
  char: '#D85A30',
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
