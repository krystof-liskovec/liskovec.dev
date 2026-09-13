import type { APIRoute } from 'astro';
import { createFeed } from '../lib/rss';
export const GET: APIRoute = ({ site }) => createFeed(site!, 'en');
