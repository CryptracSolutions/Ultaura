import type { posts } from '@/.velite';

import PostPreview from './PostPreview';

type Props = {
  posts: Post[];
};

type Post = (typeof posts)[number];

const BlogList: React.FC<Props> = ({ posts }) => {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <PostPreview key={post.id} post={post} />
      ))}
    </div>
  );
};

export default BlogList;
