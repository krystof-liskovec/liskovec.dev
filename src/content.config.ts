import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
    loader: glob({ pattern: '**/[0-9][0-9][0-9]-*.{md,mdx}', base: './src/content/blog' }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        published: z.coerce.date(),
        updated: z.coerce.date().optional(),
        featured: z.boolean().default(false),
        draft: z.boolean().default(false),
        tags: z.array(z.string()).default([]),
        image: z.string().optional(),
        imageAlt: z.string().optional(),
    }),
});

export const collections = { blog };
