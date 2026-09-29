import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
    loader: glob({
        pattern: '[0-9][0-9][0-9]-*/{index,cs,de}.{md,mdx}',
        base: './src/content/blog',
        generateId: ({ entry }) => {
            const [post, filename] = entry.split('/');
            const locale = filename.replace(/\.(md|mdx)$/, '');
            return locale === 'index' ? post : `${locale}/${post}`;
        },
    }),
    schema: ({ image }) =>
        z.object({
            locale: z.enum(['en', 'de', 'cs']).default('en'),
            title: z.string(),
            description: z.string(),
            published: z.coerce.date(),
            updated: z.coerce.date().optional(),
            featured: z.boolean().default(false),
            draft: z.boolean().default(false),
            tags: z.array(z.string()).default([]),
            image: z.union([z.string().regex(/^(?:\/|https?:\/\/)/), image()]).optional(),
            imageAlt: z.string().optional(),
        }),
});

export const collections = { blog };
