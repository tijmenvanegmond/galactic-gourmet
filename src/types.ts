// ---------------------------------------------------------------------------
// Shared shapes. Data types live here; behaviour lives in the module that owns
// them, so nothing has to import a module just to name one of its values.
// ---------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

export type SpiceName = 'peppercorn' | 'paprika' | 'saffron';

export interface Spice {
  heat: number;
  score: number;
  color: string;
  note: string;
}

export type BandLabel =
  | 'raw'
  | 'lightly toasted'
  | 'golden brown'
  | 'well done'
  | 'charcoal';

export interface Band {
  label: BandLabel;
  lo: number;
  hi: number;
  fill: string;
  edge: string;
}

export interface Stage {
  name: string;
  thrust: number;
  fuel: number;
}

/** Surface treatment the sprite baker uses to give each world a face. */
export type PlanetStyle = 'rocky' | 'banded' | 'terran';

export interface Planet {
  name: string;
  orbit: number;
  a0: number;
  w: number;
  radius: number;
  gm: number;
  fill: string;
  edge: string;
  style: PlanetStyle;
  spice?: SpiceName;
  home?: boolean;
}

/** A planet that is known to carry a spice — what `spiceRingsAt` reports. */
export type SpicedPlanet = Planet & { spice: SpiceName };

export interface KaijuConfig {
  speed: number;
  spawnRadius: number;
  spawnAngleOffset: number;
  captureRadius: number;
  rejectSpeedup: number;
  /** Inside this it forgets the planet and goes after the food. */
  senseRadius: number;
  /** Radii are multiplied by this before it gives up, so locks don't flicker. */
  loseInterest: number;
  /** Inside this it commits to the grab. */
  lungeRadius: number;
  /** Absolute speeds, not multipliers of the patient approach. */
  chaseSpeed: number;
  lungeSpeed: number;
  /** Extra reach while mid-lunge. */
  grabReach: number;
  /** It stops here and prowls rather than going straight for the planet. */
  loiterRadius: number;
  loiterSpeed: number;
  /** Committed charge at the planet once patience is gone. */
  devourSpeed: number;
  /** How far ahead on the ring it aims, which is what makes it circle. */
  loiterLead: number;
  /**
   * Sim-seconds of patience while loitering. Divide by 60·dt for wall-clock.
   * At the default dt of 0.40 that is 900 / 24 ≈ 37 seconds.
   */
  patience: number;
  patienceServe: number;
  patienceReject: number;
  /** Body links trailing the head. */
  segments: number;
  segmentSpacing: number;
  headRadius: number;
  tailRadius: number;
  /** Lateral weave, in radians off the bearing to the target. */
  slitherAmp: number;
  slitherChase: number;
  /** A strike goes straight — the weave all but stops. */
  slitherStrike: number;
  slitherFreq: number;
}

export type KaijuMode = 'hunt' | 'loiter' | 'chase' | 'lunge' | 'devour';

export interface Level {
  name: string;
  spiceRing: number;
  planets: Planet[];
  payloads: number;
  hunger: number;
  kaiju: KaijuConfig;
}

export interface Order {
  doneness: BandLabel;
  spice: SpiceName;
}

/** A payload parked in orbit after a planet caught it. */
export interface Orbit {
  planet: Planet;
  radius: number;
  angle: number;
  /** +1 or -1, taken from the direction of approach. */
  dir: number;
  /** Radians of orbit per sim-second. */
  rate: number;
}

export interface Payload {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  heat: number;
  stage: number;
  fuel: number;
  rack: SpiceName[];
  trail: Vec2[];
  /** Live orbit, or null while under free flight. */
  orbit: Orbit | null;
  /** Planet whose gravity and hull are ignored until the pod clears it. */
  ignore: Planet | null;
  /** 0..1 impact squash, decays back to round. */
  squash: number;
  burning: boolean;
}

/** What one simulation step did to the payload. */
export type StepOutcome =
  | { kind: 'flying' }
  | { kind: 'captured'; planet: Planet }
  | { kind: 'lost'; reason: string };

export interface Kaiju {
  x: number;
  y: number;
  speed: number;
  mouth: number;
  distance: number;
  /** Decaying flash after it is fed something it hates. */
  rage: number;
  /** Decaying chew animation after it is fed at all. */
  chew: number;
  name: string;
  mode: KaijuMode;
  /** Direction of travel, for leaning into a lunge. */
  heading: number;
  /** 0..1 excitement; drives the maw, the drool and the grab reach. */
  drool: number;
  /** Body links, head-first. The head itself is `x`/`y`. */
  segments: Vec2[];
  /** Phase of the lateral weave. */
  phase: number;
  /** Sim-seconds left before it stops waiting and goes for the planet. */
  patience: number;
  /** Has it reached the prowling ring at least once. */
  arrived: boolean;
  /** Once true it is committed to Earth and food no longer distracts it. */
  devouring: boolean;
  /** Latch for the running-out-of-patience line. */
  grumbled: boolean;
}

/** What the kaiju did this step, so the caller can react once per transition. */
export interface KaijuStep {
  reachedHome: boolean;
  spotted: boolean;
  lunged: boolean;
  /** Just settled into the prowling ring. */
  loitered: boolean;
  /** Patience just crossed the low-water mark. */
  impatient: boolean;
  /** Patience just ran out. */
  committed: boolean;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  targetZoom: number;
}

export interface PredictPoint extends Vec2 {
  heat?: number;
  pickup?: SpiceName;
  terminal?: boolean;
  capture?: boolean;
}

export interface Prediction {
  points: PredictPoint[];
  heat: number;
  held: SpiceName[];
}

export interface Aim {
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  handleX: number;
  handleY: number;
  power: number;
  points: PredictPoint[];
  heat: number;
  held: SpiceName[];
}

export type ParticleKind = 'spark' | 'smoke' | 'ember' | 'debris';

export interface Particle extends Vec2 {
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
  kind: ParticleKind;
}

export interface Ghost extends Vec2 {
  band: number;
  life: number;
}

/** Expanding shockwave ring. */
export interface Ring extends Vec2 {
  r: number;
  vr: number;
  life: number;
  decay: number;
  width: number;
  color: string;
}

/** Floating world-space text, e.g. "+200". */
export interface Pop extends Vec2 {
  text: string;
  color: string;
  size: number;
  life: number;
  decay: number;
  vy: number;
}

/** Everything that exists purely to make impacts feel like impacts. */
export interface Juice {
  /** Trauma 0..1; screen offset scales with its square. */
  shake: number;
  /** Frames of hit-stop remaining. */
  freeze: number;
  flash: number;
  flashColor: string;
  rings: Ring[];
  pops: Pop[];
}

export interface Input {
  steer: number;
  thrust: boolean;
  dragging: boolean;
}

/** Physics-side callbacks, so the simulation stays free of rendering concerns. */
export interface PayloadHooks {
  exhaust(pod: Payload): void;
  pickup(pod: Payload, planet: SpicedPlanet): void;
}

export interface InputHandlers {
  /** Return true to begin a drag. */
  onDragStart(pt: Vec2): boolean;
  onDragMove(pt: Vec2): void;
  onRelease(): void;
  onStage(): void;
  onRestart(): void;
  onMute(): void;
}

export type Phase = 'aim' | 'flight' | 'orbit' | 'won' | 'lost';

export interface GameState {
  level: Level;
  home: Planet;
  t: number;
  phase: Phase;
  score: number;
  hunger: number;
  payloads: number;
  pod: Payload | null;
  aim: Aim | null;
  dragOffset: Vec2 | null;
  particles: Particle[];
  ghosts: Ghost[];
  juice: Juice;
  kaiju: Kaiju;
  cam: Camera;
  order: Order;
}
