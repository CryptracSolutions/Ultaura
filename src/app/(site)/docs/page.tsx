import type { Metadata } from 'next';
import { documentationPages } from '@/.velite';

import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';

import DocsCards from '~/app/(site)/docs/components/DocsCards';
import { buildDocumentationTree } from './utils/build-documentation-tree';

import configuration from '~/configuration';
import { withI18n } from '~/i18n/with-i18n';

export const metadata: Metadata = {
  title: `Documentation - ${configuration.site.siteName}`,
  description:
    'Get started with Ultaura. Guides and tutorials for setting up lines, managing schedules, understanding insights, and configuring privacy settings.',
  alternates: {
    canonical: '/docs',
  },
};

function DocsPage() {
  const tree = buildDocumentationTree(documentationPages);

  return (
    <div className={'flex flex-col space-y-16 my-8'}>
      <div className={'flex flex-col items-center space-y-4'}>
        <Heading type={1}>Documentation</Heading>

        <SubHeading>Get started with our guides and tutorials</SubHeading>
      </div>

      <div>
        <DocsCards pages={tree ?? []} />
      </div>
    </div>
  );
}

export default withI18n(DocsPage);
