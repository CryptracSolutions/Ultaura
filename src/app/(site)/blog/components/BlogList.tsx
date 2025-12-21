'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { type Post } from 'contentlayer/generated';

import GridList from '~/app/(site)/components/GridList';
import PostPreview from '~/app/(site)/blog/components/PostPreview';
import { TextFieldInput } from '~/core/ui/TextField';
import If from '~/core/ui/If';

export default function BlogList({ posts }: { posts: Post[] }) {
  const [query, setQuery] = useState('');

  const filteredPosts = posts.filter((post) => {
    const searchContent =
      `${post.title} ${post.description ?? ''} ${post.excerpt ?? ''}`.toLowerCase();
    return searchContent.includes(query.toLowerCase());
  });

  return (
    <div className="space-y-12">
      <div className="max-w-md mx-auto relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <TextFieldInput
          placeholder="Search articles..."
          className="pl-10"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <If
        condition={filteredPosts.length > 0}
        fallback={
          <div className="text-center text-muted-foreground py-12">
            No posts found matching your criteria.
          </div>
        }
      >
        <GridList>
          {filteredPosts.map((post, idx) => {
            return <PostPreview key={idx} post={post} />;
          })}
        </GridList>
      </If>
    </div>
  );
}

