# Galactic Gourmet

Launch dishes off Earth, cook them in the gravity well of a star, and feed the
kaiju before it eats the planet.

The dishes are countries. Everything else about the kitchen is normal.

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
| `npm run deploy` | build and publish `dist/` to `gh-pages` by hand |

## Deploying

Live at **https://tijmenvanegmond.github.io/galactic-gourmet/**, served from the
`gh-pages` branch, which holds nothing but the built site.

Pushing to `main` builds and republishes it via
`.github/workflows/deploy.yml`, so what is live tracks `main` rather than
whoever last ran the deploy script. The workflow force-pushes a single-commit
`gh-pages`; that branch is disposable build output, so it has no history worth
keeping. `npm run deploy` still works as a manual escape hatch, but it
publishes your working tree — CI is the one that publishes `main`.

Two details make the subpath work. `base: './'` emits relative asset URLs, so
the same bundle runs from a domain root or from `/galactic-gourmet/` with no
rewriting. And a small build plugin emits `.nojekyll`, without which Pages runs
Jekyll over the output and silently drops any path beginning with an
underscore.

## Controls

| | |
|---|---|
| drag + release | launch, *toward* where the dish should go. Length is power |
| drag + release *while parked* | relaunch out of a capture orbit, free |
| drag *during flight* | turn toward your finger and burn while turning |
| touch *with a dry stage* | drop it and arm the next |
| space / burn | thrust along current heading, drains the live stage |
| ← → or A D | steer |
| S | drop the live stage and arm the next |
| R | restart |
| M | mute (no button any more — keyboard only) |
| sim speed slider | global time scale, live |

Every action has a drag, because there is no keyboard on a phone. All three
drags are the same gesture — *point at where you want the dish to be* — rather
than a catapult you pull back against; a launch that flew opposite the drag
while the in-flight drag flew toward it would have been two contradictory
idioms sharing one finger.

In flight the drag is measured from the pod, not from where the finger landed,
so it reads as pointing rather than as a joystick. Inside `STICK.deadzone` of
the pod nothing happens: that is where you go to cut the engine, and it stops
a thumb resting on the ship from spinning it. The throttle is not separate —
if you are pointing, you are burning, which is the only honest reading of
"fly at this".

`PHYSICS.turnRate` sets how fast the nose comes round; it wants to be quick
enough that pointing feels like pointing. The keys steer as a rudder (hold and
it keeps turning) while a drag names a heading, and the turn is clamped on the
final step so it settles on that heading instead of hunting past it.

## Layout

```
index.html          the canvas, and the little chrome left around it
src/types.ts        shared data shapes, imported type-only
src/config.ts       every tunable number. Logic files contain none.
src/world.ts        orbital kinematics, gravity field, heat field, spice rings
src/trajectory.ts   forward prediction (shares the integrator with flight)
src/payload.ts      payload state: thrust, staging, roasting, pickup
src/kaiju.ts        the tour, the hunt, patience
src/food.yaml       the larder: every dish, its emoji, and the language it
                    screams in. Parsed at build time, not at runtime.
src/menu.ts         reads food.yaml — rolls a dish, a ticket, and the quips
src/camera.ts       follow, zoom, world<->screen transforms
src/sprites.ts      offscreen sprite baking — all art is drawn by code
src/juice.ts        shake, hit-stop, flashes, shockwaves, floating text
src/audio.ts        synthesised sound; no files, just oscillators and noise
src/render.ts       all canvas drawing
src/panels.ts       the HUD, drawn onto the canvas: profile, console, minimap
src/hud.ts          the little DOM chrome left outside the frame
src/input.ts        pointer and keyboard
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

A relaunch leaves with the orbital velocity of wherever it is parked, not with
the planet's rail crawl — see "Launches borrow an orbit" below. That is what
makes a deep parking orbit a launchpad rather than a sentence.

The planet you just left is suppressed (gravity *and* hull) until the pod
clears `PHYSICS.clearance`, which is the same rule that lets a launch escape
Earth. That is one field on the payload, `ignore`, and it replaced the old
home-only special case.

## The outer system

Eight planets and four moons. Past Mars the star's oven no longer reaches, so
nothing out there cooks — the outer system is a fridge you cross, not a place
you brown a dish.

**The giants have no surface.** Jupiter, Saturn, Uranus and Neptune are flagged
`gas`, and hitting one loses the dish rather than parking it — the aim preview
marks them with a terminal cross instead of a capture ring, and each wears a
dashed hazard collar so you can see it before you learn it the hard way. What
they are good for is their wells: Jupiter pulls about two and a half times as
hard at the surface as Earth does, which bends a shot usefully.

**Moons are the only solid ground out there**, and that is the point — you
cannot park on a giant, but you can park around its moon and keep going. A moon
is just a planet with a `parent`, so `planetPos` and `planetVel` recurse one
level: it rides its parent's rail and turns on its own, and a relaunch from one
inherits both motions. Everything else — gravity, capture, sprites, the minimap
— needed no special case.

## The menu

The dishes live in `food.yaml` and nowhere else. `@rollup/plugin-yaml` parses
it at build time, so it costs no loader and no parser in the bundle, and adding
a dish is a data edit rather than a code one. `menu.ts` is the only module that
knows the file's shape.

Every dish is a place, and every place on the list is already a food — no pun
is added, the atlas got there first. Turkey, Chile, Bologna, Cheddar, Bakewell.
Some are countries and some are the towns a recipe is named after, which is the
same joke either way. The list is written out rather than assembled from parts,
because unlike the kaiju's name — any monster noun works with any epithet — a
pun does not survive being generated.

Nothing in the game ever calls them anything but dishes. That is the whole
gag: the kitchen is completely normal, and nobody remarks on where lunch came
from.

**A dish belongs to the payload, not to the order.** The diner asks for a
doneness and a spice; which dish turns up is the kitchen's business. So `Food`
is a field on `Payload`, and the order stays two lines long.

Each dish carries three things:

- **a name**, which is the joke;
- **an emoji**, which is how it is drawn. `sprites.ts` bakes the glyph the same
  way it bakes everything else, plus a charred copy — the same silhouette
  painted black through `source-atop` — and the two cross-fade as the roast
  climbs, so doneness reads on the dish itself and not only in the gauge. A
  lost dish leaves its own emoji floating as a ghost, burnt if it was burnt.
  It rides a white china plate drawn as a rocket, nose and fins, which is the
  only part that turns to face the heading: the plate is the vehicle, and a pie
  does not bank into a turn;
- **a language**, which is what it screams in.

Because the dish speaks. It says something on the way up, again if you cook it
past edible, and once more as it is swallowed — in its own language, in world
space above itself, because the profile card belongs to the kaiju and this is a
different mouth. Quips are keyed by language rather than by dish, so twelve
cheeses share one bank of French and a new dish inherits a voice for free. A
language with no lines written stays silent rather than falling back to
English.

The doneness and the spice remain the entire specification, so none of this
changes any scoring.

## The diner

It has a name (`voice.ts` rolls one per run — "Abaddon the Medium-Rare
Enjoyer"), it goes on the ticket, and it talks. Barks fire on state
transitions, so a quiet one is dropped rather than allowed to stomp the line
before it; verdicts and endings force their way in.

It does not fly at Earth and end the run. It **tours the system**: `tourStops`
worlds drawn fresh each run, worked through outermost first, with home saved
for last. At each stop it settles onto a ring and prowls (`visitTime`), then
gives up and moves on. Only at the last stop does the countdown mean anything —
that one is `patience`, and when it expires the kaiju charges. Feeding it
something good buys patience; insulting it costs patience *and* makes it
permanently faster.

It draws a few worlds rather than visiting all eight because eight stops
outlast the five dishes you get to answer with, which leaves the clock
irrelevant. It spawns just outside whichever world it drew first, on that
world's own bearing, so the opening leg is a short hop instead of a crossing.

So the kaiju is somewhere specific at any moment, and you have to deliver to
where it actually is. The HUD clock says which: `To Mars`, `At Mars`,
`Patience`, `Incoming`.

Food inside `senseRadius` interrupts all of that — it abandons the world it
was visiting and hunts the dish, tightening its weave to a straight strike
inside `lungeRadius` and reaching further mid-lunge. It cannot be distracted
once it has committed to Earth. Thresholds widen by `loseInterest` while a
lock is held so a dish hovering at the boundary doesn't make it flicker.

Chase and lunge are absolute speeds, not multiples of the cruise: they have to
beat a planet's orbital motion (~1.3 units/sim-second) or a dish parked in a
capture orbit could never be caught at all.

Every one of those speeds is a target it accelerates toward (`accel`,
`lungeAccel`, `brake`) rather than one it snaps to, so `kaiju.pace` — what
actually moves it — always lags `kaiju.speed`, which is only the cruise stat.
Spotting a dish used to double its speed in a single frame; now it winds up,
and a lunge winds up nearly four times harder than a cruise so that crossing
into strike range still reads as a snap. Braking is faster than accelerating,
which is what lets it drop a chase and settle back onto a prowling ring
without a long coast.

The HUD clock still estimates from the target speeds rather than the current
pace, so it reads as a steady ETA instead of flickering every time the thing
changes its mind.

## The HUD is in the frame

Almost all of it is drawn onto the canvas by `panels.ts`, which reads game
state directly and writes nothing to the DOM: a diner profile card top-left
(portrait, name, what it is doing and for how much longer, hunger), its last
line fading underneath, the minimap top-right, and a kitchen console along the
bottom — the order, the roast gauge with the ordered band marked on it, fuel,
dishes left as place settings, and the score.

`VIEW.height` went 430 → 480 when the console moved in, so the playfield kept
roughly the room it had.

What is left in `index.html` is the chrome with no business inside the frame:
the status line, the controls, the time scale. `hud.ts` is down to those, and
every hook in it is still optional — delete a row and the thing it fed stops
updating rather than taking the game with it.

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

## Launches borrow an orbit

Planet orbits are kinematic — placed on rails via `a0 + w·t` — rather than
integrated from the same `GM` that governs the payload, so a planet travels
far slower than its radius really demands: Earth's rail is 1.3 units/s where a
circular orbit there needs 9.8.

A launch that inherited its planet's motion therefore inherited nothing, and
had to buy the entire climb out of the star's well from a standing start.
Escaping costs about 21.6 units/s from a Mercury parking orbit, 16.8 from
Venus and 13.9 from Earth, against the 12 a maximum pull buys. So the inner
system was a trap, and precisely the wrong one: the deepest well is also the
hottest oven, which made the best place to cook the one place you could not
leave.

A launch is instead given the velocity a real circular orbit at that point
would have (`LAUNCH.inheritOrbital`, `world.ts:launchVelocity`), in the
direction its world goes round the star — Venus is retrograde, and hands out
retrograde launches. The gift is largest exactly where the well is deepest, so
it scales itself: it rescues Mercury without over-serving Mars, which no
single added constant could do. A Mercury-to-Earth transfer that cost 16.6
units/s from rest costs about 2.9 from orbit.

What it costs is the old default trajectory. A released dish now *orbits*
rather than falling at the star, so cooking means throwing retrograde hard
enough to kill the speed you were given — around a 0.82 pull from Earth.
Reaching the star is a deliberate act now rather than what happens if you do
nothing.

`LAUNCH.inheritOrbital` is the dial, but it is not a gentle one: 1 is a circle
and anything less is an ellipse that dips inward, so it trades "leaving is
easy" against "everything falls at the star". Values in between are worst near
the star, where the dip is fatal — a Mercury relaunch at 0.6 goes to the
corona, not to Earth.

The planets are still on rails, and still inconsistent with their own gravity.
Only the payload was made honest.

## Next

- Binary star system (two wells, two ovens, Lagrange-ish dead zones)
- Kaiju drift, so intercepts require leading the target
- Sharper stage tradeoff — stage 2 is currently short and violent but stage 1
  has little reason to be dropped early
- Orbit decay, or a fuel cost per relaunch, if parking turns out to be too safe
  a place to think from
- Thrust while parked, to raise and lower the capture orbit instead of only
  leaving it
