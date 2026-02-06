import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

import { posts } from '@/.velite';
import Post from '~/app/(site)/blog/components/Post';
import ReadingProgressBar from '~/app/(site)/blog/components/ReadingProgressBar';

import Container from '~/core/ui/Container';
import { withI18n } from '~/i18n/with-i18n';

import configuration from '~/configuration';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata | undefined> {
  const post = posts.find((post) => post.slug === params.slug);

  if (!post) {
    return;
  }

  const { title, date, description, image, slug } = post;
  const url = [configuration.site.siteUrl, 'blog', slug].join('/');

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: date,
      url,
      images: image
        ? [
            {
              url: image,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : [],
    },
  };
}

async function BlogPost({ params }: { params: { slug: string } }) {
  const post = posts.find((post) => post.slug === params.slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <ReadingProgressBar />
      <Container>
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group mt-6 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 text-primary group-hover:text-primary/80 transition-colors" />
          <span>Back to blogs</span>
        </Link>

        <Script id={'ld-json'} type="application/ld+json">
          {JSON.stringify(post.structuredData)}
        </Script>

        <Post post={post} content={post.body} />
      </Container>
    </>
  );
}

export default withI18n(BlogPost);
