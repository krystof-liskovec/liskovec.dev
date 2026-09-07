# liskovec.dev

Kryštof Lískovec's portfolio and blog, built with Astro. The homepage features an interactive ASCII canvas that moves between detailed planetary views, the solar system, and the Milky Way.

## Commands

```sh
npm install
npm run dev
npm run build
npm run preview
npm run capture:og
```

`/og-preview/` is a fixed 1200 × 630 preview for the alternate social image. It
uses the live orrery canvas and the site's Space Grotesk font. With the local
Astro server running, `npm run capture:og` waits for the scene to settle and
writes the 2× result to `public/og-default.png`.

Set `SITE_URL` when the public domain changes. It controls canonical URLs, social metadata, structured data, the sitemap, RSS links, and `robots.txt`. The deployment currently uses `https://liskovec.pages.dev` until the custom domain is ready. Redirect the temporary `pages.dev` hostname permanently to the custom domain after the move so only one public origin remains indexable.

## Writing blog posts

Posts live in `src/content/blog`. A post supports this frontmatter:

```yaml
title: A useful title
description: A short, page-specific summary.
published: 2026-08-23
updated: 2026-08-24 # optional
featured: false
draft: true
tags:
    - devops
image: /images/blog/example.png # optional; also used for link previews
imageAlt: A concise description of the image
```

Store local images under `public/images/blog`. Posts without a cover image use `public/og-default.png` for social previews. Draft posts are excluded from pages, the sitemap, RSS, and structured data.

## Image to ASCII art

The blog's terminal-style image converter is a local CLI. It keeps the source image on your machine and infers the output format from the --output extension:

```sh
./scripts/ascii-art.mjs public/images/blog/example.jpg --output example-ascii.png
```

Use .txt or .asc for plain ASCII, .svg for a crisp scalable export, or .png, .jpg, .jpeg, .webp, and .bmp for themed raster images. Flat edge-connected backgrounds are kept as a clean fill, inner colors remain part of the subject, and source transparency is preserved in SVG, PNG, and WebP output. Gruvbox is the default; use --theme original for exact source colours, or --theme amber and --theme monochrome for other stylized palettes. The standard character ramp is the default; use --chars fine for a denser full tonal ramp, --no-dither for cleaner flat areas, --invert to invert the source colours, character contrast, and generated background fill, or --force-theme-background to use the selected theme's background instead of the source background. Run npm run ascii -- --help for all options.

## Astronomical data and sources

The orrery is data-informed, but it is not a literal scale model. Real orbital
elements, periods, and catalogue distances drive the positions and readouts.
Orbit spacing, body sizes, arm thickness, particle density, ASCII textures, and
transition timing are compressed or stylized so the scene remains readable.

### Solar system

- Mercury through Neptune use the J2000 Keplerian elements and mean-longitude
  rates in JPL's [Approximate Positions of the
  Planets](https://ssd.jpl.nasa.gov/planets/approx_pos.html), Table 1. JPL gives
  this approximation a validity interval of 1800–2050. The canvas solves
  Kepler's equation from those elements for the current date; it is suitable for
  this visualization, not for observation or navigation.
- Pluto uses the J2000 mean elements in NASA's [Pluto Fact
  Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html). Its
  mean-longitude rate is derived from the listed 248.09-year sidereal period.
- Relative physical planet sizes and the short descriptive facts are checked
  against NASA's [Solar System Sizes](https://science.nasa.gov/resource/solar-system-sizes/)
  and [planet overview](https://science.nasa.gov/solar-system/planets/). The
  rendered radii are deliberately enlarged and compressed; they are not the
  planets' physical radius ratios.
- Detailed axial rotation uses the sidereal periods in NASA's [Planetary Fact
  Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/). Negative periods
  preserve the retrograde rotation of Venus, Uranus, and Pluto. The focused
  rotation clock is independent from the orbital clock so either timescale can
  be explored without changing the other.
- Major-moon semimajor axes, eccentricities, inclinations, nodes, periapses,
  mean anomalies, and periods come from JPL's [Planetary Satellite Mean
  Elements](https://ssd.jpl.nasa.gov/sats/elem/), at epoch
  `2000-01-01.5 TDB`. Moon-orbit radii are compressed independently for each
  focused planet. The separate Earth close-up uses NASA's mean Earth–Moon
  distance of 384,400 km from [Moon by the
  Numbers](https://science.nasa.gov/moon/by-the-numbers/).
- Halley's Comet uses JPL solution `J863/77` from the [Small-Body Element
  Tables](https://ssd.jpl.nasa.gov/sb/elem_tables.html): `q = 0.58597811 AU`,
  `e = 0.96714291`, `i = 162.26269°`, `ω = 111.33249°`,
  `Ω = 58.42008°`, and perihelion `1986-02-05.89532`. It is propagated as a
  two-body orbit; JPL Horizons should be used for an observational ephemeris.
- The asteroid belt follows NASA's approximate [2.2–3.2 AU
  extent](https://science.nasa.gov/mission/dawn/faq/), the main Kuiper Belt
  follows NASA's approximate [30–50 AU
  extent](https://science.nasa.gov/solar-system/kuiper-belt/facts/), and the
  Jupiter Trojan clouds are placed around the L4/L5 regions described in NASA's
  [Lagrange-point overview](https://science.nasa.gov/solar-system/resources/faq/what-are-lagrange-points/).
  Their individual particles and gaps are deterministic visual samples, not a
  catalogue of real minor bodies.
- The ISS close-up's approximately 400 km altitude and 90-minute period come
  from NASA's [ISS research overview](https://www.nasa.gov/humans-in-space/why-do-research-on-the-international-space-station/).

The live planet readout reports heliocentric ecliptic longitude, latitude, and
radius derived from the model above. It does not report geocentric sky
coordinates, and the displayed orbit lanes use a nonlinear visual spacing.

### Milky Way

The face-on arm centre lines use the kinked logarithmic fits in Table 2 of Reid
et al., [_Trigonometric Parallaxes of High-mass Star Forming Regions: Our View
of the Milky Way_](https://arxiv.org/abs/1910.03357) (2019). This supplies the
four-arm model, fitted azimuth ranges, kink radii, pitch angles, the finite Local
(Orion) Arm segment, and the Sun–Galactic-centre distance
`R0 = 8.15 ± 0.15 kpc`. Unmeasured far-side arm sections are smooth visual
continuations. Arm thickness, star and nebula density, dust lanes, and the
attachment of uncertain inner sections are artistic rather than survey data.

The central bar is drawn at `27°` with a `4.6 kpc` half-length, based on the
range discussed by Wegg, Gerhard, and Portail, [_The structure of the Milky
Way's bar outside the
bulge_](https://academic.oup.com/mnras/article/450/4/4050/989881) (2015).

The accelerated galactic clock uses a simplified flat rotation curve anchored
to NASA's estimate that the Solar System completes a Galactic orbit in about
[230 million years](https://science.nasa.gov/solar-system/solar-system-facts/).
Material orbital periods therefore increase in proportion to distance from the
Galactic centre. The bar and spiral-arm density pattern use a separate
230-million-year visual period, placing the pattern's illustrative corotation
radius near Sol. Diffuse stars at other radii can therefore move through the
arms without detaching the Local Arm or its short-lived landmarks. This pattern
speed is an artistic assumption, not a measured Milky Way value. Named
short-lived objects remain visible throughout accelerated time and should not
be interpreted as historical predictions millions of years away.

Galactic longitude and latitude for each landmark come from its linked
[SIMBAD](https://simbad.cds.unistra.fr/simbad/) catalogue record. The distance
used to convert that direction into a three-dimensional scene position is shown
below. Light-year labels are rounded from the same value.

| Landmark                                                                           | Distance used | Distance source                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Sagittarius A*](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Sgr+A%2A)       |       8.2 kpc | Rounded from the 8.15 kpc Galactic-centre distance in [Reid et al. (2019)](https://arxiv.org/abs/1910.03357)                                                                                                                                                                |
| [Orion Nebula](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=M+42)             |     0.389 kpc | [Sandstrom et al. (2007)](https://arxiv.org/abs/0706.2361), VLBA parallax                                                                                                                                                                                                   |
| [Cygnus X-1](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Cygnus+X-1)         |      2.22 kpc | [Miller-Jones et al. (2021)](https://arxiv.org/abs/2102.09091), radio astrometry                                                                                                                                                                                            |
| [Crab Nebula](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Crab+Nebula)       |      1.99 kpc | Converted from NASA's rounded [6,500 ly](https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-1/)                                                                                                                           |
| [Eta Carinae](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=eta+Car)           |       2.3 kpc | [University of Minnesota Eta Carinae reference summary](https://etacar.umn.edu/eta_carinae/parameters.html)                                                                                                                                                                 |
| [Cassiopeia A](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Cas+A)            |       3.4 kpc | NASA's rounded [11,000 ly](https://science.nasa.gov/missions/webb/webb-reveals-never-before-seen-details-in-cassiopeia-a/) and the Reed et al. expansion distance summarized by [Milisavljevic and Fesen (2014)](https://academic.oup.com/mnras/article/441/4/2996/1215799) |
| [Omega Centauri](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=Omega+Centauri) |      5.19 kpc | SIMBAD distance measurement attributed to Watkins et al. (2015)                                                                                                                                                                                                             |
| [PSR B1509-58](https://simbad.cds.unistra.fr/simbad/sim-id?Ident=PSR+B1509-58)     |       5.2 kpc | [Gaensler et al. (1999)](https://arxiv.org/abs/astro-ph/9901262), H I absorption (`5.2 ± 1.4 kpc`)                                                                                                                                                                          |

These landmark distances have meaningful uncertainty, and several are rounded
educational values. The scene preserves each object's catalogue direction and
distance instead of moving it onto a spiral arm for visual convenience. Omega
Centauri is intentionally above the disk because it is a halo globular cluster.

## Deployment

The `.woodpecker.yml` workflow builds the CV PDFs and Astro site in the same
pipeline, then deploys `dist/` to Cloudflare Pages after every push to `main`.
The CV sources and PDF builder live under `cv/`; generated PDFs are written to
`public/` for the `/cv.pdf` and `/cv-backend.pdf` links.
Run `python3 cv/build_cv.py` before `npm run build` to refresh both downloads
locally. The generator preserves inline parenthesized dates, the English/German/Czech
language order, and navy email and website links.

Create these repository secrets in Woodpecker before enabling the workflow:

- `cloudflare_account_id` — the Cloudflare account ID
- `cloudflare_api_token` — an API token with the permissions required to deploy to Cloudflare Pages

The workflow expects the Pages project to be named `liskovec`. Change `CLOUDFLARE_PAGES_PROJECT` in `.woodpecker.yml` if the project has another name.
