import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { getBlogSlug } from '../lib/blog';

export const GET: APIRoute = async ({ site }) => {
    const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
        (a, b) => b.data.published.valueOf() - a.data.published.valueOf(),
    );

    return rss({
        title: 'Kryštof Lískovec | blog',
        description:
            'Random adventures and struggles - mostly about software, DevOps, and whatever I happen to be figuring out.',
        site: site!,
        items: posts.map((post) => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.published,
            link: `/blog/${getBlogSlug(post.id)}/`,
            categories: post.data.tags,
        })),
        customData: '<language>en</language>',
    });
};
