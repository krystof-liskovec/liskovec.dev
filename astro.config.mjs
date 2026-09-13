// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const siteUrl = process.env.SITE_URL ?? 'https://liskovec.pages.dev';
/** @type {import('astro').AstroIntegration} */
const ogPreviewDevRoute = {
    name: 'og-preview-dev-route',
    hooks: {
        'astro:config:setup': ({ command, injectRoute }) => {
            if (command === 'dev') {
                injectRoute({
                    pattern: '/og-preview',
                    entrypoint: new URL('./src/og-preview.astro', import.meta.url).pathname,
                });
            }
        },
    },
};

// https://astro.build/config
export default defineConfig({
    site: siteUrl,
    integrations: [
        sitemap({
            i18n: { defaultLocale: 'en', locales: { en: 'en', de: 'de', cs: 'cs' } },
        }),
        ogPreviewDevRoute,
    ],
});
