import 'server-only';

import { allDocumentationPages } from 'contentlayer/generated';
import type { DocsIndexItem } from './types';

const docsIndex: DocsIndexItem[] = allDocumentationPages.map((page) => {
  const pathSegments = Array.isArray(page.pathSegments) ? page.pathSegments : [];
  const sectionSlug = pathSegments[0]?.pathName ?? 'docs';
  const section = toTitleCase(sectionSlug.replace(/-/g, ' '));
  const keywords = new Set<string>();

  if (page.title) keywords.add(page.title);
  if (page.label) keywords.add(page.label);
  if (section) keywords.add(section);
  if (page.resolvedPath) {
    page.resolvedPath
      .split('/')
      .filter(Boolean)
      .forEach((segment) => keywords.add(segment.replace(/-/g, ' ')));
  }

  return {
    id: page._id,
    title: page.title,
    label: page.label,
    resolvedPath: page.resolvedPath,
    section,
    keywords: Array.from(keywords),
  };
});

export function getDocsIndex(): DocsIndexItem[] {
  return docsIndex;
}

function toTitleCase(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}
