import type { Metadata } from 'next';
import { posts } from '@/.velite';

import BlogList from '~/app/(site)/blog/components/BlogList';
import Container from '~/core/ui/Container';
import { withI18n } from '~/i18n/with-i18n';
import { PageHero, GradientText } from '~/app/(site)/components/PageHero';

import configuration from '~/configuration';

export const metadata: Metadata = {
  title: `Blog - ${configuration.site.siteName}`,
  description: `Caregiver guides, elder care tips, and product updates from the Ultaura team. Practical advice for families supporting aging loved ones.`,
};

async function BlogPage() {
  const livePosts = posts.filter((post) => {
    const isProduction = configuration.production;
    return isProduction ? true : post.live;
  });

  return (
    <div>
      <PageHero
        badge="OUR BLOG"
        title={
          <>
            Tutorials, Guides & <GradientText>Updates</GradientText>
          </>
        }
        subtitle="From our team"
      />

      <Container>
        <div className="my-8 space-y-16">
          <BlogList posts={livePosts} />
        </div>
      </Container>
    </div>
  );
}

export default withI18n(BlogPage);
