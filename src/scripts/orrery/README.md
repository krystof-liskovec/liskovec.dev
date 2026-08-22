# Orrery architecture

`../orrery.ts` is the browser entrypoint and frame coordinator. It owns the order in which scenes are projected, hit-tested, and painted, but delegates self-contained behavior to the modules in this directory.

- `catalog.ts` — planets, moons, and galactic object metadata
- `galaxy-model.ts` — named Milky Way arm geometry and Galactic-to-scene coordinates
- `scene-data.ts` — generated stars, orbit samples, dust, and asteroid fields
- `math.ts` — coordinate, orbit, and projection helpers
- `runtime-state.ts` — mutable camera/focus/clock state and its defaults
- `frame-state.ts` — passive camera motion and reset interpolation
- `focus-controller.ts` — parent/child focus transition lifecycle
- `interactions.ts` — pointer, touch, drag, reset, and zoom controls
- `solar-system-model.ts` — pooled orbit/body projection for each frame
- `solar-system-scene.ts` — orbit, asteroid, moon, Sun, and compact-body painting
- `background-renderer.ts` — local stars and the projected Milky Way backdrop
- `galaxy-object-renderer.ts` — pooled galactic-object projection, hit testing, and sprites
- `galactic-landmark-renderer.ts` — detailed stellar remnants, clusters, and pulsar artwork
- `scene-ui.ts` — overlap-aware body hit testing, focus candidates, and readouts
- `solar-body-renderer.ts` — compact planet sprites used by the orrery
- `focus-scene.ts` — detailed object views and satellite systems
- `galactic-renderer.ts` — detailed Milky Way object artwork
- `sun-renderer.ts`, `moon-renderer.ts`, `iss-renderer.ts` — specialized artwork
- `planet-textures.ts`, `earth-map.ts` — sphere surface glyphs and textures
- `canvas-ui.ts` — canvas readouts and labels
- `types.ts` — shared scene types

Keep metadata and deterministic generated data out of renderers. New input behavior belongs in `interactions.ts`; new compact artwork belongs in `solar-body-renderer.ts`; detailed close-up behavior belongs in `focus-scene.ts` or a specialized renderer.

## Milky Way model

The face-on galaxy uses the kinked logarithmic-arm fits in Reid et al. (2019),
Table 2, with the Sun at `(0, 8.15 kpc)`. The four major arm families are
Norma–Outer, Scutum–Centaurus, Sagittarius–Carina, and Perseus. The Local
(Orion) Arm is generated independently over its measured `-8°..34°` azimuth
range, so it remains a finite segment between the major arms rather than a
spiral emerging from the Galactic centre.

The far side of the Milky Way is poorly constrained. Major-arm sections beyond
the fitted maser ranges are smooth logarithmic continuations; Sagittarius–Carina
uses the paper's suggested roughly 10° continuation. The uncertain inner
sections continue to the central bar rather than ending as detached arcs:
Norma–Outer and Scutum–Centaurus converge on one side, while
Sagittarius–Carina and Perseus converge on the other. They attach to the bar,
not directly to Sagittarius A*. Landmark positions are projected directly from
their Galactic longitude, latitude, and heliocentric distance rather than moved
to visually convenient points. Omega Centauri is a halo cluster and
deliberately does not belong to a spiral arm.

Primary model source: Reid et al., _Trigonometric Parallaxes of High-mass Star
Forming Regions: Our View of the Milky Way_ (2019), arXiv:1910.03357.
