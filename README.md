# liskovec.dev

Kryštof Lískovec's portfolio and blog, built with Astro. The homepage features an interactive ASCII canvas that moves between detailed planetary views, the solar system, and the Milky Way.

## Commands

```sh
npm install
npm run dev
npm run build
npm run preview
```

Set `SITE_URL` when the public domain changes. It controls the sitemap, RSS links, and `robots.txt` URLs.

## Deployment

The `.woodpecker.yml` workflow builds the site and deploys `dist/` to Cloudflare Pages after every push to `main`.

Create these repository secrets in Woodpecker before enabling the workflow:

- `cloudflare_account_id` — the Cloudflare account ID
- `cloudflare_api_token` — an API token with the permissions required to deploy to Cloudflare Pages
- `site_url` — the public site URL, for example `https://liskovec.dev`

The workflow expects the Pages project to be named `liskovec`. Change `CLOUDFLARE_PAGES_PROJECT` in `.woodpecker.yml` if the project has another name.
