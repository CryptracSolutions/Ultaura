import { Post } from 'contentlayer/generated';

import PostPreview from './PostPreview';

type Props = {
  posts: Post[];
};

const BlogList: React.FC<Props> = ({ posts }) => {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => (
        <PostPreview key={post._id} post={post} />
      ))}
    </div>
  );
};

export default BlogList;