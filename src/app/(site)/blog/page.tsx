import type { Metadata } from 'next';
import { allPosts } from 'contentlayer/generated';

import BlogList from '~/app/(site)/blog/components/BlogList';
import Container from '~/core/ui/Container';
import SubHeading from '~/core/ui/SubHeading';
import Heading from '~/core/ui/Heading';
import { withI18n } from '~/i18n/with-i18n';

import configuration from '~/configuration';

export const metadata: Metadata = {
  title: `Blog - ${configuration.site.siteName}`,
  description: `Tutorials, Guides and Updates from our team`,
};

async function BlogPage() {
  const livePosts = allPosts.filter((post) => {
    const isProduction = configuration.production;
    return isProduction ? true : post.live;
  });

  return (
    <Container>
      <div className={'flex flex-col space-y-16 my-8'}>
        <div className={'flex flex-col items-center space-y-4'}>
          <Heading type={1}>Blog</Heading>

          <SubHeading>Tutorials, Guides and Updates from our team</SubHeading>
        </div>

        <BlogList posts={livePosts} />
      </div>
    </Container>
  );
}

export default withI18n(BlogPage);
