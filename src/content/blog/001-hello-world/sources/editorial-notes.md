# Editorial notes for hello, world.

These notes are source material for the article, not a blog entry. The collection
loader only includes the article's `index`, `cs`, and `de` files.

## Chronology

| Date in 2026 | Commits | Evidence |
| --- | --- | --- |
| May 31 | `2c59f54`, `6822be5` | Astro initialization and Go/WebAssembly terminal, including virtual filesystem and shell commands. |
| August 10 | `7c573fd` | Terminal replaced with prompt-driven visual theming. `theme.ts` uses browser-side embeddings, similarity scores, and CSS variables. |
| August 20 | `14bd2d9`, `e23e94c` | Orrery introduced alongside a Go theme backend; Pluto easter egg introduced. `server/main.go` calls Ollama and includes a fallback. |
| August 21 | `d583a51`, `a019dae`, `155ee68`, `71d9d26`, `77cdf0d`, `102222d` | Galactic zoom, initial Earth close-up, object focus, removal of standalone Earth close-up, Jupiter and Saturn moon systems. |
| August 22 | `052bc87`, `0c1c7d7`, `ec77aae`, `ecca630` | Go backend/theme removal, Keplerian moon orbits, Milky Way arm model, and documentation of astronomical data sources. |
| August 23 | `c1838b3` | Separate simulation clocks. |
| September 1 | `554fae2` | High-DPI cap, galaxy backdrop caching, render metrics caching, and scheduling changes. |
| September 2 | `cf02fdc`, `2174d9f`, `481330d`, `fae9060`, `251132f`, `570ecc4` | Glyph atlas, WebGL particles, frame factory extraction/reversal, documented Lighthouse comparison, touch release targeting. |
| September 3 | `d1a0569`, `3234145` | Self-hosted fonts and lazy-loaded galaxy/focus renderers. |
| September 4 | `d4707da`, `0d13be6`, `ee3a728` | Keyboard interaction and zoom accessibility changes. |
| September 5 | `cb98019` | CV PDF generation moved into the site pipeline. |
| September 13 | `41071af`, `0cf9bb8` | Early exits and render bounds checks in the planet zoom path; Czech/German localization. |

## Implementation references

- `src/scripts/orrery/glyph-atlas.ts`: font/color/pixel-ratio cache, tile copies, normal-text fallback, invalidation when fonts finish loading.
- `src/scripts/orrery/webgl-particle-renderer.ts`: texture atlases, instanced particle batches, shader motion and projection.
- `src/scripts/orrery/particle-glyph.ts`: selection between GPU drawing and cached Canvas 2D drawing.
- `src/scripts/orrery.ts`: frame scheduling, 120 FPS ceiling, 60 FPS cached backdrop ceiling, DPR cap of 2, offscreen/hidden-tab suspension, deferred renderer imports.
- `src/scripts/orrery/solar-body-renderer.ts`: sphere sampling, detail levels, ring projection, opacity and bounds checks.
- `src/scripts/orrery/math.ts`: Kepler solver, physical position readouts, and compressed visual projection.
- `src/components/HomePage.astro`: initial heading animation and scene startup coordination; repeat visits and reduced-motion entry can skip the opening sequence.
- `src/scripts/orrery/interactions.ts`: touch release position, keyboard selection, labeled controls, and focus handling.
- `src/styles/tokens.css` and `src/layouts/Layout.astro`: self-hosted fonts, subsets, display behavior, and preload hints.
- `.woodpecker.yml`: CV generation before Astro build, Cloudflare Pages deployment on pushes/manual runs on `main`.
- Root `README.md` and `src/scripts/orrery/README.md`: astronomy provenance, model limitations, and render-loop performance boundary.
- `src/content.config.ts`: current grouped article layout, explicit entry IDs, and local cover-image support.

## Evidence limits

The mobile Lighthouse comparison (100 to 93 after extracting the frame factory)
is recorded in the orrery architecture notes. It is a historical result, not a
fresh measurement. The original report, run conditions, and repeated-run data
are not present in the sources reviewed for this draft. Startup objects,
closures, and changed state access are explanations recorded in those notes;
the article should not claim that any one factor was isolated as the cause.

Do not invent current performance scores, transfer-size savings, frame rates,
visitor feedback, production failures, or reasons for the gap between May and
August. Git establishes implementation order, not personal motivation.

The grouped folder structure was introduced while working on this article,
after the September 28 LinkedIn commit. Describe it as the current writing
workflow rather than attributing it to the earlier localization commit.

## Personal details to incorporate

The author has been asked what prompted the website and why the ASCII solar
system appealed to them. Until that answer arrives, keep the opening focused
on the implementation and avoid attributing a specific personal history or
motivation to the author.

## Artwork

`../images/glyph-reuse.svg` is an editable explanatory diagram created for this
article. It represents the two particle drawing paths, not a screenshot or a
benchmark. Each path has its own atlas; Canvas 2D also handles artwork outside
the particle paths. Keep the diagram's colors aligned with the site's palette.
