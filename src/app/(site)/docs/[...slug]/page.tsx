import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { documentationPages } from '@/.velite';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

import Container from '~/core/ui/Container';
import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import If from '~/core/ui/If';
import Divider from '~/core/ui/Divider';

import MDXRenderer from '~/core/ui/MDXRenderer/MDXRenderer';
import DocsCards from '~/app/(site)/docs/components/DocsCards';
import getPageTree from '../utils/get-documentation-page-tree';
import { withI18n } from '~/i18n/with-i18n';
import DocumentationPageLink from '../components/DocumentationPageLink';
import { Breadcrumbs } from '~/core/ui/Breadcrumbs';

const getPageBySlug = cache((slug: string) => {
  return documentationPages.find((post) => post.resolvedPath === slug);
});

interface PageParams {
  params: Promise<{
    slug: string[];
  }>;
}

export async function generateStaticParams() {
  return documentationPages.map((page) => ({
    slug: page.resolvedPath.split('/'),
  }));
}

export const generateMetadata = async ({
  params,
}: PageParams): Promise<Metadata> => {
  const { slug } = await params;
  const page = getPageBySlug(slug.join('/'));

  if (!page) {
    notFound();
  }

  const { title, description } = page;

  return {
    title,
    description,
    alternates: {
      canonical: `/docs/${slug.join('/')}`,
    },
  };
};

async function DocumentationPage({ params }: PageParams) {
  const { slug } = await params;
  const page = getPageBySlug(slug.join('/'));

  if (!page) {
    notFound();
  }

  const { nextPage, previousPage, children } =
    getPageTree(page.resolvedPath) ?? {};

  const description = 'description' in page ? (page.description as string) : '';

  const breadcrumbs = slug.reduce<{ label: string; href: string }[]>(
    (acc, segment, index) => {
      const path = slug.slice(0, index + 1).join('/');
      const matchedPage = documentationPages.find(
        (p) => p.resolvedPath === path,
      );

      acc.push({
        label:
          matchedPage?.title ??
          segment.charAt(0).toUpperCase() + segment.slice(1),
        href: `/docs/${path}`,
      });

      return acc;
    },
    [],
  );

  return (
    <Container>
      {page.structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(page.structuredData),
          }}
        />
      )}

      <div className={'py-10 flex flex-col space-y-8 lg:px-16 grow relative'}>
        <Breadcrumbs items={breadcrumbs} />

        <div className={'flex flex-col space-y-1'}>
          <Heading type={1}>{page.title}</Heading>
          <SubHeading>{description}</SubHeading>
        </div>

        <MDXRenderer code={page.body} />

        <Divider />

        <If condition={children}>
          <DocsCards pages={children ?? []} />
        </If>

        <div
          className={
            'flex flex-col justify-between space-y-4 md:flex-row md:space-x-8' +
            ' md:space-y-0'
          }
        >
          <div className={'w-full'}>
            <If condition={previousPage}>
              {(page) => (
                <DocumentationPageLink
                  page={page}
                  before={<ChevronLeftIcon className={'w-4'} />}
                />
              )}
            </If>
          </div>

          <div className={'w-full'}>
            <If condition={nextPage}>
              {(page) => (
                <DocumentationPageLink
                  page={page}
                  after={<ChevronRightIcon className={'w-4'} />}
                />
              )}
            </If>
          </div>
        </div>
      </div>
    </Container>
  );
}

export default withI18n(DocumentationPage);
