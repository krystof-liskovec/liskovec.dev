# Orrery architecture

`../orrery.ts` is the browser entrypoint and frame coordinator. It owns the order in which scenes are projected, hit-tested, and painted, but delegates self-contained behavior to the modules in this directory.

- `catalog.ts` — planets, moons, and galactic object metadata
- `scene-data.ts` — generated stars, orbit samples, dust, and asteroid fields
- `math.ts` — coordinate, orbit, and projection helpers
- `runtime-state.ts` — mutable camera/focus/clock state and its defaults
- `interactions.ts` — pointer, touch, drag, reset, and zoom controls
- `solar-body-renderer.ts` — compact planet sprites used by the orrery
- `focus-scene.ts` — detailed object views and satellite systems
- `galactic-renderer.ts` — detailed Milky Way object artwork
- `sun-renderer.ts`, `moon-renderer.ts`, `iss-renderer.ts` — specialized artwork
- `planet-textures.ts`, `earth-map.ts` — sphere surface glyphs and textures
- `canvas-ui.ts` — canvas readouts and labels
- `types.ts` — shared scene types

Keep metadata and deterministic generated data out of renderers. New input behavior belongs in `interactions.ts`; new compact artwork belongs in `solar-body-renderer.ts`; detailed close-up behavior belongs in `focus-scene.ts` or a specialized renderer.
