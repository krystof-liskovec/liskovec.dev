export const getBlogSlug = (id: string) => id.replace(/^(de|cs)\//, '').replace(/^\d{3}-/, '');
