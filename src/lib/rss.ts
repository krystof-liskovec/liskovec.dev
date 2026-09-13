import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { getBlogSlug } from './blog';
import { getTranslator, localizedPath, type Locale } from '../i18n';
export async function createFeed(site: URL, locale: Locale) {
    const t = getTranslator(locale);
    const posts = (await getCollection('blog', ({ data }) => !data.draft && data.locale === locale))
        .sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf());
    return rss({
        title: 'Kryštof Lískovec | blog',
        description: t('Random adventures and struggles - mostly about software, DevOps, and whatever I happen to be figuring out.'),
        site: new URL(localizedPath('/', locale), site),
        items: posts.map(post => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: post.data.published,
            link: localizedPath(`/blog/${getBlogSlug(post.id)}/`, locale),
            categories: post.data.tags,
        })),
        customData: `<language>${locale}</language>`,
    });
}
