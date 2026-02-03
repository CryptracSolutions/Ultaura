import { getServerSideSitemap } from 'next-sitemap';
import { posts, documentationPages } from '@/.velite';
import configuration from '~/configuration';

const siteUrl = configuration.site.siteUrl as string;

if (!siteUrl) {
  throw new Error(`Invalid "siteUrl", please fix in configuration.ts`);
}

export async function GET() {
  const urls = getSiteUrls();
  const posts = getPostsSitemap();
  const docs = getDocsSitemap();

  return getServerSideSitemap([...urls, ...posts, ...docs]);
}

function getSiteUrls() {
  const urls = ['', 'faq', 'pricing'];

  return urls.map((url) => {
    return {
      loc: new URL(url, siteUrl).href,
      lastmod: new Date().toISOString(),
    };
  });
}

function getPostsSitemap() {
  return posts.map((post) => {
    return {
      loc: new URL(post.url, siteUrl).href,
      lastmod: new Date().toISOString(),
    };
  });
}

function getDocsSitemap() {
  return documentationPages.map((page) => {
    return {
      loc: new URL(page.url, siteUrl).href,
      lastmod: new Date().toISOString(),
    };
  });
}
