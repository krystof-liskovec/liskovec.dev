---
title: hello, world.
description: How my portfolio went from a Go terminal to an interactive ASCII universe, and what it took to make it work on the web.
published: 2026-09-28
featured: true
draft: true
tags:
    - web development
    - creative coding
    - performance
image: /og-default.png?v=2
imageAlt: A Gruvbox-inspired ASCII solar system orrery beside the name Kryštof Lískovec
---

At some point, making a personal website turned into figuring out how Saturn's rings should rotate when you drag an ASCII solar system around.

That probably tells you something about how this project went.

The site you're reading is a portfolio and a place to write. It also contains an interactive orrery: a model of the solar system you can rotate, explore up close, and zoom out from until you're looking at the Milky Way. Most of the artwork is made of characters, with layers of glow underneath.

Looking through the git history, the path here runs through a Go terminal, a prompt-driven theme experiment, several changes of direction, and a lot of mobile fixes. The interesting part is how those experiments changed the website, and what happened when the visual detail started getting expensive.

## The first version wanted you to type commands

The first Astro commit landed on May 31, 2026. Later that day, the site gained a graphical terminal written in Go and compiled to WebAssembly.

It went fairly deep into the terminal idea. You could navigate a virtual filesystem, read about me and my projects, change themes, and even edit files. Go handled the terminal logic, while WebAssembly let it run locally in the browser. The virtual filesystem gave the commands somewhere to operate without touching the visitor's real files.

There was plenty to explore technically. But finding portfolio information also meant interacting with a shell. Every command was another thing a visitor needed to discover before reaching the content.

The next substantial change in git comes in August, and the site takes a very different direction.

## A theme experiment, then a solar system

On August 10, I replaced the terminal with a visual system driven by a text prompt. A visitor could describe a mood, color, material, or scene, and the page would blend matching visual directions into a theme.

The first implementation used browser-side text embeddings. Those turn descriptions into numerical vectors, so the code could compare a visitor's prompt with predefined theme descriptions and use the similarity scores to blend colors and other CSS properties. A later version included a Go service that called Ollama to generate theme values, with a fallback when that call failed.

By this point, changing a portfolio's appearance had become a substantial feature of its own.

On August 20, the solar system arrived. The Gruvbox palette and monospace typography suited ASCII artwork, and the scene gave that style something tangible to explore. The portfolio information could sit in ordinary page sections, while the orrery occupied its own part of the homepage.

The following days added galactic zoom, object close-ups, shaded planet surfaces, and moon systems. Saturn's rings had to survive camera rotation. Pluto appeared as an easter egg, initially unlocked by nine rapid clicks. Apparently, even a personal website can develop a planetary backlog.

Some ideas came and went. A standalone Earth close-up was added and then removed during a refactor; the current focused Earth view has its own Moon and ISS rendering. By August 22, the Go backend and remaining theme system were gone too.

Those removals changed the architecture as much as the additions did. The site could now be built into static files, with the interactive scene running in the visitor's browser.

## What the ASCII is actually doing

The orrery looks like text, but the artwork is drawn on canvas. The characters aren't arranged in a giant text block. Each glyph has a calculated position, color, opacity, and place in the drawing order.

For a planet, a grid of characters samples a sphere's surface. Surface coordinates determine which texture and glyph to use; shading gives the sphere depth. Changing the sampled coordinates produces rotation. Rings are projected around the planet and have to stay aligned with the camera.

Detail changes with the view. In the solar system, a planet uses a compact representation. Up close, it can use a denser grid and more elaborate surface artwork. That keeps the system view readable and avoids calculating detail that would disappear into a few pixels anyway.

The galaxy extends the same idea. Some focused objects use three-dimensional clouds, shells, or clusters projected onto a character grid. Sagittarius A* has a dedicated renderer for its accretion flow and lensed arcs. A shared visual language connects those close-ups to the tiny symbols in the wide view.

The code grew into separate modules for data, input, projection, and individual renderers. That separation makes it possible to change a moon's artwork without also having to work through the entire galaxy renderer. The frame coordinator still decides what gets projected, selected, and painted each frame.

## Real orbital data, readable distances

The motion became more deliberate as the scene grew.

The planets use J2000 orbital elements and rates from JPL's approximate planetary positions. The code solves Kepler's equation to find each body's position along its elliptical orbit. Major moons use orbital elements too, so their movement has a basis beyond choosing a circle and a convenient speed.

There are two related jobs here: calculate a position from the model, then turn it into something readable on the screen. Planet sizes are enlarged, orbit spacing is nonlinear, and the artwork is stylized. A literal scale model would leave a very empty canvas with some nearly invisible dots.

The Milky Way's arm geometry uses published fits. Named landmarks use catalogue directions and distances, and the Local Arm is represented as a finite segment. Their coordinates determine where they belong, even when a different placement might look tidier.

Time also needed more than one control. Planetary orbits, axial rotation, and galactic motion happen on very different timescales, so they have separate simulation clocks. You can explore a planet's rotation without accelerating its orbit at the same rate.

The repository documents the sources and compromises. The result is an illustration driven by real inputs, with compressed visual scales and a simplified galactic model. Accelerating the galaxy doesn't turn it into a prediction of what those named objects will look like millions of years from now.

## Making all those characters cheaper

Once the scene contained particle fields, detailed planets, and a galaxy, every frame had more work to do. September brought a series of changes to how that work was shared, reused, or skipped.

### Cache the glyphs

A lot of particle artwork repeats a small alphabet: dots, stars, plus signs, and a few other symbols. Calling canvas text rendering for every occurrence means asking it to draw the same shapes repeatedly.

On September 2, I added a glyph atlas: a small offscreen image containing reusable character tiles. The Canvas 2D path can copy those tiles into place instead of drawing each character from the font again. Atlases are cached by font, color, and pixel ratio, with normal text rendering available for unsupported glyphs.

WebGL particle rendering followed. It uses texture atlases and instanced drawing, where one drawing operation can handle a batch of particles. The solar and galactic particle paths also put motion and projection calculations into shaders, reducing the per-particle work in JavaScript.

![Glyph reuse in the two particle paths: Canvas 2D copies cached image tiles; WebGL2 uses a texture atlas to draw particle batches on the GPU.](./images/glyph-reuse.svg)

*The two paths cache the same kinds of symbols in different forms. Canvas 2D provides the particle fallback and also draws other artwork and readouts.*

This produces a hybrid renderer. WebGL handles suitable particle batches, Canvas 2D handles the surrounding scene, and the 2D particle path remains available when WebGL isn't.

### Avoid work the visitor can't see

Other changes were simpler, but they apply across the scene.

The canvas pixel ratio is capped at 2. At a ratio of 3, every CSS pixel covers nine backing pixels. At 2, it covers four. That cap reduces the pixel area by about 56% in that example, while keeping enough detail for the character-based artwork. It doesn't imply the whole page becomes 56% faster; other costs remain.

The scheduler caps scene rendering at 120 frames per second. Cached galaxy backdrop updates are limited to 60 when the scene allows caching. Those are ceilings, not promised frame rates. Rendering stops when the scene leaves the viewport or the browser tab is hidden.

Later, the planet zoom path gained earlier exits for invisible and offscreen artwork. If a compact sprite has faded out, its surface no longer needs to be sampled. If a planet and its rings are entirely outside the render bounds, they don't need painting.

These changes reduce different kinds of work: pixels to process, frames to schedule, and objects to draw. Their common feature is that the work disappears before it reaches the expensive part of the renderer.

### Give the page a chance to load

A cheaper frame doesn't solve everything. Loading and initializing the scene can still compete with the page's first useful content.

Astro renders the portfolio and blog into HTML. The orrery loads separately. On an initial visit, scene startup is coordinated with the heading animation and scheduled after that heading has had a chance to paint. Galaxy and focus renderers load separately when needed; WebGL initialization is deferred until idle time or interaction.

Deferring that work has a tradeoff: some features become ready later. The point is to choose when to pay their startup cost, so someone can start reading while the scene gets set up.

Fonts went through several iterations too, including deferred loading and different display behavior. Eventually, DM Mono and Space Grotesk moved into the site's own assets as WOFF2 files with subsets and preload hints. That removes the external font stylesheet from the loading chain and gives the site direct control over those requests.

### Keep the refactor honest

One September 2 experiment extracted the frame renderer into a factory module. The next commit put it back.

The architecture notes record a mobile Lighthouse performance score dropping from 100 to 93 during that experiment. The extraction introduced startup objects and closures and changed how the frame loop accessed state. Those were plausible contributors, but that comparison doesn't isolate a single cause.

It is also a historical result, rather than a fresh benchmark of the current site. The useful outcome was a documented boundary: keep the frame coordinator in place, and extract data, pure helpers, and work that can be loaded independently. Changes around a hot path need measurements as well as a cleaner-looking diff.

## The parts a screenshot won't show

The mobile fixes in the history make up a story of their own.

Shrinking the orbits leaves another problem if the planets, glyphs, and readouts retain their desktop sizes. Fullscreen adds orientation changes and safe areas. The scene needs to scale consistently, including the masks that keep nearer objects in front of farther ones.

Touch also changes selection. A finger hides the target, and a gesture can end somewhere different from where it started. One fix resolves the focused object at release, using the final touch position.

Keyboard support arrived in September, with camera controls, object selection, zoom controls, and ways to leave a focused view. Reduced-motion preferences affect the animation. Because drawn canvas objects don't automatically behave like HTML buttons, the interaction needs explicit instructions and labels.

That work is easy to overlook in a visual project. A close-up can look finished while the controls still make it awkward to reach.

## Keeping the publishing side manageable

Underneath the scene, this is a static Astro site with shared page components and Markdown blog posts.

Woodpecker CI builds it and deploys the output to Cloudflare Pages on pushes to `main`. The same pipeline generates the CV PDFs from their sources before the Astro build, producing the downloads alongside the pages that link to them.

English, Czech, and German support arrived on September 13. Localization includes navigation and portfolio copy, plus metadata, RSS, accessibility instructions, and astronomy readouts. It reaches quite a bit further than the language menu.

While working on this post, I also grouped each article's text, translations, images, and sources into its own folder. This article lives in `001-hello-world/`, with `index.md`, `cs.md`, `de.md`, and shared images referenced by relative paths. That makes it easier to keep the material for a post together as it grows.

The everyday workflow is small: edit Markdown, push the change, let the build produce the site. That simplicity matters when the renderer gives me plenty of other things to tinker with.

## What I'd carry into the next project

The useful pattern in this history is the repeated cycle of adding something, finding its awkward edges, and changing the implementation around them.

Removing the terminal and theme system helped the current site take shape. Adding the galaxy made rendering costs harder to ignore. Mobile and keyboard support exposed assumptions that were easy to miss with a mouse and a large screen. The frame-renderer reversal left behind a specific constraint for future work.

For a similar project, I'd keep the content accessible early, give decorative interactions a clear place in the page, and budget for the cost of new detail as it arrives. I'd also expect some working features to disappear along the way. Building them can help clarify what belongs in the finished version.

This is now a place to introduce myself, share my work, and write. There is also a small universe to play with while you're here.

You can drag Saturn around. Its rings have had quite a few commits to prepare for it.
