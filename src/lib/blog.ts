import type { ImageMetadata } from 'astro';

export const isBlogPostVisible = (data: { draft: boolean }) => import.meta.env.DEV || !data.draft;

export const getBlogSlug = (id: string) => id.replace(/^(de|cs)\//, '').replace(/^\d{3}-/, '');

export const getBlogImageSrc = (image: string | ImageMetadata | undefined) =>
    typeof image === 'string' ? image : image?.src;
