# Galactic Gourmet

Launch food from Earth, cook it in the gravity well of a star, and feed the
kaiju before it eats the planet.

Hitting a planet does not wreck the dish — it gets caught in orbit, keeps
cooking there, and can be flung onward for free. Missing is a detour, not a
loss; the only real clock is the kaiju.

## Run

Vite + TypeScript. Install once, then:

```
npm install
npm run dev
```

Then open the address Vite prints (`http://localhost:5173` by default).

| script | what it does |
|---|---|
| `npm run dev` | dev server with hot reload |
| `npm run build` | typecheck, then bundle to `dist/` |
| `npm run preview` | serve the built `dist/` |
| `npm run typecheck` | `tsc --noEmit` on its own |

## Controls

| | |
|---|---|
| drag + release | launch (drag *away* from the direction of flight) |
| drag + release *while parked* | relaunch out of a capture orbit, free |
| space / burn | thrust along current heading, drains the live stage |
| ← → or A D | steer |
| S | drop the live stage and arm the next |
| R | restart |
| M | mute |
| sim speed slider | global time scale, live |

## Layout

```
index.html          shell + HUD markup + styling
src/types.ts        shared data shapes, imported type-only
src/config.ts       every tunable number. Logic files contain none.
src/world.ts        orbital kinematics, gravity field, heat field, spice rings
src/trajectory.ts   forward prediction (shares the integrator with flight)
src/payload.ts      payload state: thrust, staging, roasting, pickup
src/kaiju.ts        approach behaviour and ETA
src/camera.ts       follow, zoom, world<->screen transforms
src/sprites.ts      offscreen sprite baking — all art is drawn by code
src/juice.ts        shake, hit-stop, flashes, shockwaves, floating text
src/audio.ts        synthesised sound; no files, just oscillators and noise
src/render.ts       all canvas drawing
src/hud.ts          DOM bindings, kept out of the loop
src/input.ts        pointer, keyboard, on-screen buttons
src/game.ts         state machine, scoring, frame loop
src/main.ts         entry point — grabs the canvas, starts the game
```

Rule of thumb: if you want to change how it *feels*, edit `config.ts`. If you
want to change what it *does*, edit one module.

Types live in `types.ts` rather than beside the code that builds them, so a
module never has to import another module just to name one of its values —
`config.ts` and `world.ts` would otherwise import each other. Behaviour stays
with its owner; only shapes are centralised.

## Timing

Everything integrates against `SIM.dt` (sim-seconds per frame). Halve it and
the whole simulation slows coherently — orbits, gravity, thrust, roasting, and
the kaiju all scale together, and the prediction stays accurate because
`trajectory.ts` steps with the identical value. Default `0.40`.

## The cooking model

`heatRate(d) = ((heatRadius - d) / heatRadius) ^ heatFalloff * heatRate`

The exponent matters more than the coefficient. At `2.0` all the heat is
crammed into the corona, so the gap between "raw" and "vaporised" is a few
pixels wide and effectively unflyable — a 60-shot ballistic sweep landed
golden brown once. At `1.15` the oven spreads outward and doneness tracks
periapsis smoothly:

| periapsis | result |
|---|---|
| < 70 | charcoal, usually vaporised |
| 75–85 | well done |
| 85–110 | golden brown |
| 110–130 | lightly toasted |
| > 140 | raw |

Spices shift that whole table. Peppercorn (×0.55 heat) moves the golden window
inward toward the star; paprika (×1.75) moves it outward. They stack
multiplicatively, so peppercorn + paprika lands at ×0.96 — near-neutral
cooking plus two spices in the rack.

## Capture orbits

A collision no longer ends the run. `payload.ts` parks the pod at
`planet.radius + ORBIT.altitude` and sweeps it around at a rate scaled by
`ORBIT.refRadius / radius`, so tight orbits whip and wide ones drift. The
direction comes from the sign of the approach cross-product, so a grazing pass
keeps its handedness.

Two things make this a mechanic rather than a mercy:

- **It keeps cooking.** The roast integrator runs on sun distance, which does
  not care whether the pod is coasting or parked. A Mercury orbit is a fast
  oven, a Mars orbit is a fridge, and the roast gauge becomes a timer you
  watch before flinging.
- **A relaunch inherits orbital velocity**, so where you release in the sweep
  decides the exit vector. It costs no payload — only kaiju ETA.

The planet you just left is suppressed (gravity *and* hull) until the pod
clears `PHYSICS.clearance`, which is the same rule that lets a launch escape
Earth. That is one field on the payload, `ignore`, and it replaced the old
home-only special case.

## Art and feel

No asset files. `sprites.ts` bakes each body once into an offscreen canvas at
4× supersampling and blits it thereafter. Planets are baked lit from +x and
then rotated to face the star, which buys a day/night terminator that tracks
each world's own orbit for free. Craters, bands and continents come from a
seeded PRNG, so a planet looks the same every run.

Feedback lives in `juice.ts` and is fire-and-forget: gameplay code adds trauma,
hit-stop frames, shockwaves and floating text, and never reads them back.
`audio.ts` synthesises every sound from oscillators and filtered noise, gated
behind the first input event because a browser will not start an audio context
before then.

## Known simplification

Planet orbits are kinematic — placed on rails via `a0 + w·t` — rather than
integrated from the same `GM` that governs the payload. The two systems are
therefore inconsistent: Earth travels at ~1.3 units/frame where a true
circular orbit at its radius would need ~9.9. The payload inherits almost none
of Earth's momentum, so a weak launch simply falls at the star instead of
requiring a retrograde burn.

It plays fine as arcade orbital mechanics. Making it consistent means either
slowing the whole system ~7× or decoupling visual orbit rate from physics
time. Worth deciding before adding more systems, because level design will
bake in whichever choice is made.

## Next

- Binary star system (two wells, two ovens, Lagrange-ish dead zones)
- Kaiju drift, so intercepts require leading the target
- Sharper stage tradeoff — stage 2 is currently short and violent but stage 1
  has little reason to be dropped early
- Orbit decay, or a fuel cost per relaunch, if parking turns out to be too safe
  a place to think from
- Thrust while parked, to raise and lower the capture orbit instead of only
  leaving it
