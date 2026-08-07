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
export type PlanetStyle = 'rocky' | 'banded' | 'terran' | 'giant' | 'ice';

export interface Planet {
  name: string;
  /** Radius of its own orbit — around the sun, or around `parent` if set. */
  orbit: number;
  a0: number;
  w: number;
  radius: number;
  gm: number;
  fill: string;
  edge: string;
  style: PlanetStyle;
  /**
   * Set for moons: they ride their parent's rail and orbit it. Held as a
   * reference rather than a name, which structuredClone preserves.
   */
  parent?: Planet;
  /** No surface to land on. Hitting one loses the dish instead of parking it. */
  gas?: boolean;
  rings?: boolean;
  spice?: SpiceName;
  home?: boolean;
}

/** A planet that is known to carry a spice — what `spiceRingsAt` reports. */
export type SpicedPlanet = Planet & { spice: SpiceName };

export interface KaijuConfig {
  speed: number;
  /** Worlds it visits before turning on the home planet. */
  tourStops: number;
  /** How far outside the first stop's orbit it arrives. */
  spawnMargin: number;
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
  /**
   * Units per sim-second² it can gain speed at. Every mode's speed is a target
   * it accelerates toward rather than one it snaps to.
   */
  accel: number;
  /** A pounce winds up harder than a cruise does. */
  lungeAccel: number;
  /** Shedding speed is easier than finding it. */
  brake: number;
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
   * Sim-seconds it will wait at the home planet — the last stop — before it
   * gives up and eats the place. Divide by 60·dt for wall-clock: at the
   * default dt of 0.40 that is 900 / 24 ≈ 37 seconds.
   */
  patience: number;
  /** Sim-seconds it spends prowling each of the other worlds on its tour. */
  visitTime: number;
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
  /** Its cruise speed — a stat, which a rejected dish permanently raises. */
  speed: number;
  /**
   * The speed it is actually travelling at, which chases the current mode's
   * target rather than matching it. This is what moves it.
   */
  pace: number;
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
  /** Worlds it means to visit, in order, with home saved for last. */
  tour: Planet[];
  /** Index into `tour` of the world it is at or heading for. */
  stop: number;
  /** Sim-seconds left at the current stop. */
  patience: number;
  /** What `patience` started at here, so "nearly out" is a fixed fraction. */
  patienceMax: number;
  /** Has it reached the current stop's prowling ring. */
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
  /** Just settled into the current stop's prowling ring. */
  loitered: boolean;
  /** Just gave up on this world and set off for the next one. */
  movedOn: boolean;
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

/** The diner's last line, drawn on the canvas and fading as it ages. */
export interface Chatter {
  line: string;
  life: number;
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
  /** Keyboard rudder, -1..1. */
  steer: number;
  thrust: boolean;
  dragging: boolean;
  /**
   * Heading the drag stick is asking for, in world radians, or null when
   * nothing is steering by drag. Takes precedence over `steer`.
   */
  heading: number | null;
  /** The drag stick is pushed past its burn ring. */
  burn: boolean;
}

/** A live steering drag: the point being flown at, in screen pixels. */
export interface Stick {
  x: number;
  y: number;
  /** Far enough from the pod to be a command rather than a thumb on the hull. */
  live: boolean;
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

/** How the run finished — which end card, and what it says. */
export type Ending = 'satisfied' | 'starved' | 'eaten';

export interface GameState {
  level: Level;
  home: Planet;
  t: number;
  phase: Phase;
  score: number;
  /** Score as displayed — rolls up toward `score` so a big serve reads big. */
  shownScore: number;
  hunger: number;
  payloads: number;
  /** Dishes the diner ate and liked, and ones it ate and hated. */
  served: number;
  rejected: number;
  /** Set once the run is over; drives which end card is drawn. */
  ending: Ending | null;
  /** Frames since the run ended, for the card's fade and its input gate. */
  over: number;
  chatter: Chatter;
  pod: Payload | null;
  aim: Aim | null;
  dragOffset: Vec2 | null;
  /** Live steering drag, drawn as a thumb stick. Null when not steering. */
  stick: Stick | null;
  /** Has the player found the stick this run — the hint hides once they have. */
  stickUsed: boolean;
  particles: Particle[];
  ghosts: Ghost[];
  juice: Juice;
  kaiju: Kaiju;
  cam: Camera;
  order: Order;
}
