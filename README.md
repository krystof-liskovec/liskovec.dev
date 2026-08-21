# liskovec.dev

A minimal portfolio with a prompt-driven visual system. Visitors can describe a mood, color, material, or scene and the site blends semantic visual directions into a new presentation.

## Commands

```sh
npm install
npm run dev
npm run build
npm run preview
```

## Deployment

The `.woodpecker.yml` workflow builds the site and deploys `dist/` to Cloudflare Pages after every push to `main`.

Create these repository secrets in Woodpecker before enabling the workflow:

- `cloudflare_account_id` — the Cloudflare account ID
- `cloudflare_api_token` — an API token with the permissions required to deploy to Cloudflare Pages

The workflow expects the Pages project to be named `liskovec-dev`. Change `CLOUDFLARE_PAGES_PROJECT` in `.woodpecker.yml` if the project has another name.
