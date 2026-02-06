import path from 'node:path';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeSlug from 'rehype-slug';
import { defineCollection, defineConfig, s } from 'velite';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

type VeliteMeta = {
  path: string;
  content?: string;
  config: {
    root: string;
  };
};

const posts = defineCollection({
  name: 'Post',
  pattern: 'posts/*.mdx',
  schema: s
    .object({
      title: s.string(),
      date: s.isodate(),
      live: s.boolean().default(false),
      image: s.string().optional(),
      description: s.string().optional(),
      body: s.mdx(),
    })
    .transform((data, ctx) => {
      const meta = (ctx as unknown as { meta: VeliteMeta }).meta;
      const filePath = getContentRelativePath(meta);
      const slug = getSlug(filePath);
      const rawContent = meta.content ?? '';

      const headingRegex = /^(#{2,3})\s+(.+)$/gm;
      const headings: Array<{ level: number; text: string; id: string }> = [];
      let match;
      while ((match = headingRegex.exec(rawContent)) !== null) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
        headings.push({ level, text, id });
      }

      return {
        ...data,
        id: filePath,
        url: `/blog/${slug}`,
        readingTime: calculateReadingTime(rawContent),
        headings,
        slug,
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: data.title,
          datePublished: data.date,
          dateModified: data.date,
          description: data.description,
          image: [siteUrl, data.image].join(''),
          url: [siteUrl, 'blog', getFlattenedPath(filePath)].join('/'),
          author: {
            '@type': 'Organization',
            name: 'JP3',
          },
        },
      };
    }),
});

const documentationPages = defineCollection({
  name: 'DocumentationPage',
  pattern: 'docs/**/*.mdx',
  schema: s
    .object({
      title: s.string(),
      label: s.string(),
      cardCTA: s.string().optional(),
      description: s.string().optional(),
      show_child_cards: s.boolean().default(false),
      collapsible: s.boolean().default(false),
      collapsed: s.boolean().default(false),
      date: s.isodate().optional(),
      image: s.string().optional(),
      body: s.mdx(),
    })
    .transform((data, ctx) => {
      const meta = (ctx as unknown as { meta: VeliteMeta }).meta;
      const filePath = getContentRelativePath(meta);
      const slug = getSlug(filePath);
      const rawContent = meta.content ?? '';
      const pathSegments = getPathSegments(filePath).map(getMetaFromFolderName);
      const resolvedPath = pathSegments
        .map(({ pathName }) => pathName)
        .join('/');
      const path = resolvedPath ? `/docs/${resolvedPath}` : '/docs';
      const url = path;

      return {
        ...data,
        id: filePath,
        url,
        readingTime: calculateReadingTime(rawContent),
        slug,
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'LearningResource',
          headline: data.title,
          datePublished: data.date,
          dateModified: data.date,
          description: data.description,
          image: [siteUrl, data.image].join(''),
          url: [siteUrl, url.replace(/^\//, '')].join('/'),
          author: {
            '@type': 'Organization',
            name: 'JP3',
          },
        },
        path,
        pathSegments,
        resolvedPath,
      };
    }),
});

export default defineConfig({
  root: 'src/content',
  collections: { posts, documentationPages },
  output: {
    data: 'src/.velite',
  },
  mdx: {
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          properties: {
            className: ['anchor'],
          },
        },
      ],
    ],
  },
});

function calculateReadingTime(content: string) {
  const wordsPerMinute = 235;
  const numberOfWords = content.split(/\s/g).length;
  const minutes = numberOfWords / wordsPerMinute;

  return Math.ceil(minutes);
}

function getSlug(filePath: string) {
  return path.posix.basename(
    normalizePath(filePath),
    path.posix.extname(filePath),
  );
}

function getFlattenedPath(filePath: string) {
  return normalizePath(filePath).replace(/\.[^/.]+$/, '');
}

function getDocsPath(filePath: string) {
  const normalizedPath = normalizePath(filePath);

  if (normalizedPath.startsWith('docs/index.')) {
    return '/docs';
  }

  const urlPath = urlFromFilePath(normalizedPath);

  return urlPath.replace(/\/index$/, '');
}

function urlFromFilePath(filePath: string) {
  let urlPath = getFlattenedPath(filePath).replace(/^app\/?/, '/');

  if (!urlPath.startsWith('/')) {
    urlPath = `/${urlPath}`;
  }

  return urlPath;
}

function getMetaFromFolderName(dirName: string) {
  const re = /^((\d+)-)?(.*)$/;
  const [, , orderStr, pathName] = dirName.match(re) ?? [];
  const order = orderStr ? parseInt(orderStr) : 0;

  return { order, pathName };
}

function getPathSegments(filePath: string) {
  const docsPath = getDocsPath(filePath);

  return docsPath
    .replace(/^\/docs\/?/, '')
    .split('/')
    .filter(Boolean);
}

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join(path.posix.sep);
}

function getContentRelativePath(meta: VeliteMeta) {
  const rawPath = meta.path;

  if (path.isAbsolute(rawPath)) {
    return normalizePath(path.relative(meta.config.root, rawPath));
  }

  return normalizePath(rawPath);
}
