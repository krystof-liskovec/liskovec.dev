import type { APIRoute } from 'astro';
import { createFeed } from '../../lib/rss';
import { localizedLocales, type Locale } from '../../i18n';
export function getStaticPaths() { return localizedLocales.map(lang => ({ params: { lang } })); }
export const GET: APIRoute = ({ site, params }) => createFeed(site!, params.lang as Locale);
