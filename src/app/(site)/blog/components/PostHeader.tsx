import type { posts } from '@/.velite';
import If from '~/core/ui/If';
import DateFormatter from './DateFormatter';

type Post = (typeof posts)[number];

const PostHeader: React.FC<{ post: Post }> = ({ post }) => {
  const { title, date, readingTime, description } = post;

  return (
    <div className="flex flex-col items-center text-center">
      {/* Badge */}
      <div className="flex items-center gap-3 mt-2">
        <span className="h-px w-8 sm:w-12 bg-primary/60" />
        <span className="text-xs tracking-[0.2em] text-primary font-medium uppercase">
          Ultaura Blog
        </span>
        <span className="h-px w-8 sm:w-12 bg-primary/60" />
      </div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-semibold tracking-[-0.02em] leading-[1.1] text-foreground max-w-3xl mt-5">
        {title}
      </h1>

      {/* Description */}
      <If condition={description}>
        {(desc) => (
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl leading-relaxed mt-4">
            {desc}
          </p>
        )}
      </If>

      {/* Meta */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
        <DateFormatter dateString={date} />
        <span>&middot;</span>
        <span>{readingTime} min read</span>
      </div>

      {/* Divider */}
      <div className="h-px w-16 bg-border mt-6" />
    </div>
  );
};

export default PostHeader;
