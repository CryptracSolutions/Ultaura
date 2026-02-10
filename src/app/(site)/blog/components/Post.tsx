import React from 'react';
import type { posts } from '@/.velite';

import PostHeader from './PostHeader';
import MDXRenderer from '~/core/ui/MDXRenderer/MDXRenderer';
import If from '~/core/ui/If';
import BlogImageFrame from './BlogImageFrame';
import CoverImage from './CoverImage';
import TableOfContents from './TableOfContents';
import AuthorCard from './AuthorCard';
import ShareButtons from './ShareButtons';
import RelatedPosts from './RelatedPosts';
import { BlogPostCTA } from './BlogPostCTA';
import InlineNewsletterCTA from '~/app/(site)/components/InlineNewsletterCTA';

type PostType = (typeof posts)[number];

const Post: React.FCC<{
  post: PostType;
  content: string;
}> = ({ post, content }) => {
  return (
    <div>
      <TableOfContents headings={(post as any).headings} />

      {/* Wide zone — hero image */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 mt-6">
        {/* Badge */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="h-px w-8 sm:w-12 bg-primary/60" />
          <span className="text-xs tracking-[0.2em] text-primary font-medium uppercase">
            Ultaura Blog
          </span>
          <span className="h-px w-8 sm:w-12 bg-primary/60" />
        </div>

        <If condition={post.image}>
          {(imageUrl) => (
            <div className="relative w-full aspect-[2/1]">
              <BlogImageFrame className="h-full">
                <CoverImage preloadImage title={post.title} src={imageUrl} />
              </BlogImageFrame>
            </div>
          )}
        </If>
      </div>

      {/* Narrow zone — header + article */}
      <div className="mx-auto max-w-2xl px-4 sm:px-6 mt-8">
        <PostHeader post={post} />

        <article className="mt-10">
          <MDXRenderer code={content} />
        </article>

        <InlineNewsletterCTA source="blog_post" />

        <AuthorCard />
        <ShareButtons title={post.title} url={post.url} />
      </div>

      {/* Wide zone — related posts */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <RelatedPosts currentSlug={post.slug} />
      </div>

      {/* Full-width zone — CTA */}
      <BlogPostCTA />
    </div>
  );
};

export default Post;
