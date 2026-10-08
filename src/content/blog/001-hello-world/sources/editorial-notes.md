# Editorial notes for hello, world.

These notes are source material for the article, not a blog entry. The collection
loader only includes the article's `index`, `cs`, and `de` files.

## Chronology

| Date in 2026 | Commits | Evidence |
| --- | --- | --- |
| August 10 | `7c573fd` | Prompt-driven visual theming. `theme.ts` uses browser-side embeddings, similarity scores, and CSS variables. |
| August 20 | `14bd2d9`, `e23e94c` | Orrery introduced alongside a Go theme backend; Pluto easter egg introduced. `server/main.go` calls Ollama and includes a fallback. |
| August 21 | `d583a51`, `a019dae`, `155ee68`, `71d9d26`, `77cdf0d`, `102222d` | Galactic zoom, initial Earth close-up, object focus, removal of standalone Earth close-up, Jupiter and Saturn moon systems. |
| August 22 | `052bc87`, `0c1c7d7`, `ec77aae`, `ecca630` | Go backend/theme removal, Keplerian moon orbits, Milky Way arm model, and documentation of astronomical data sources. |
| August 23 | `c1838b3` | Separate simulation clocks. |
| September 1 | `554fae2` | High-DPI cap, galaxy backdrop caching, render metrics caching, and scheduling changes. |
| September 2 | `cf02fdc`, `2174d9f`, `481330d`, `fae9060`, `251132f`, `570ecc4` | Glyph atlas, WebGL particles, frame factory extraction/reversal, documented Lighthouse comparison, touch release targeting. |
| September 3 | `d1a0569`, `3234145` | Self-hosted fonts and lazy-loaded galaxy/focus renderers. |
| September 4 | `d4707da`, `0d13be6`, `ee3a728` | Keyboard interaction and zoom accessibility changes. |
| September 13 | `41071af`, `0cf9bb8` | Early exits and render bounds checks in the planet zoom path. |

## Implementation references

- `src/scripts/orrery/glyph-atlas.ts`: font/color/pixel-ratio cache, tile copies, normal-text fallback, invalidation when fonts finish loading.
- `src/scripts/orrery/webgl-particle-renderer.ts`: texture atlases, instanced particle batches, shader motion and projection.
- `src/scripts/orrery/particle-glyph.ts`: selection between GPU drawing and cached Canvas 2D drawing.
- `src/scripts/orrery.ts`: frame scheduling, 120 FPS ceiling, 60 FPS cached backdrop ceiling, DPR cap of 2, offscreen/hidden-tab suspension, deferred renderer imports.
- `src/scripts/orrery/solar-body-renderer.ts`: sphere sampling, detail levels, ring projection, opacity and bounds checks.
- `src/scripts/orrery/math.ts`: Kepler solver, physical position readouts, and compressed visual projection.
- `src/components/HomePage.astro`: initial heading animation and scene startup coordination; repeat visits and reduced-motion entry can skip the opening sequence.
- `src/scripts/orrery/interactions.ts`: touch release position, keyboard selection, labeled controls, and focus handling.
- Root `README.md` and `src/scripts/orrery/README.md`: astronomy provenance, model limitations, and render-loop performance boundary.

## Evidence limits

The mobile Lighthouse comparison (100 to 93 after extracting the frame factory)
is recorded in the orrery architecture notes. It is a historical result, not a
fresh measurement. The original report, run conditions, and repeated-run data
are not present in the sources reviewed for this draft. Startup objects,
closures, and changed state access are explanations recorded in those notes;
the article should not claim that any one factor was isolated as the cause.

Do not invent current performance scores, transfer-size savings, frame rates,
visitor feedback, production failures, or personal motivation. Git establishes
implementation order, not why a feature was chosen.

## Personal details to incorporate

The author said that playing a lot of Stellaris sparked the space direction
after the dynamic theme experiment was abandoned. The ASCII idea came later:
they wanted to emphasize the software developer nature of the portfolio and
expected text characters to be easier to animate. The implementation proved
more involved because it recalculates and projects many glyphs each frame,
accounts for the non-square character cells, and benefits from caching repeated
glyphs and drawing particle batches through WebGL.

## Artwork

`../images/glyph-reuse.svg` is an editable explanatory diagram created for this
article. It represents the two particle drawing paths, not a screenshot or a
benchmark. Each path has its own atlas; Canvas 2D also handles artwork outside
the particle paths. Keep the diagram's colors aligned with the site's palette.

The technical diagrams are also original explanatory artwork:

- `../images/ascii-rendering.svg` shows the sphere sampling, glyph choice, and
  canvas drawing steps.
- `../images/orbit-projection.svg` shows orbital data becoming a position, then
  a visually compressed screen projection.
- `../images/rendering-shortcuts.svg` shows the pixel-ratio cap, frame caps, and
  early exits for invisible work.

They illustrate the implementation, not measured results or scale-accurate
drawings.

## Progress screenshots

The three `history-*.webp` images are losslessly encoded, 2× screenshots
rendered from these historical commits, rather than screenshots recovered from
the original development. The Astro toolbar and live clock are hidden in the
captures:

| Image | Commit | What it shows |
| --- | --- | --- |
| `history-theme.webp` | `7c573fd` | Prompt-driven theme experiment, August 10. |
| `history-orrery.webp` | `14bd2d9` | First solar-system orrery homepage, August 20. |
| `history-galaxy.webp` | `d583a51` | Cosmic zoom view, with the normal slider set to the Milky Way end. |

The galaxy screenshot uses the commit's own slider and renderer; only the
slider value was set to show the expanded view.

The planetary zoom screenshots are also lossless WebP captures, cropped around
the scene so the development toolbar and live clock are not included:

| Image | Source | What it shows |
| --- | --- | --- |
| `planet-zoom-earth-early.webp` | `a019dae` | The separate Earth close-up, with the Moon and ISS. |
| `planet-zoom-jupiter.webp` | `37e94c7` | The later shared focus view, showing Jupiter and its Galilean moons. |

The article captions describe the progression from the Earth-specific scene to
the reusable planet focus view.
