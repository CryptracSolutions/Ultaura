import { posts } from '@/.velite';
import PostPreview from './PostPreview';

export default function RelatedPosts({ currentSlug }: { currentSlug: string }) {
  const related = posts
    .filter((p) => p.slug !== currentSlug)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  if (related.length === 0) return null;

  return (
    <section className="mt-16 mb-8">
      <h2 className="text-2xl font-heading font-semibold text-foreground mb-8">
        Continue reading
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {related.map((post) => (
          <PostPreview key={post.id} post={post} imageHeight={180} />
        ))}
      </div>
    </section>
  );
}
