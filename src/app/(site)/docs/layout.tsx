import { documentationPages } from '@/.velite';

import DocsNavigation from './components/DocsNavigation';
import Container from '~/core/ui/Container';

import { buildDocumentationTree } from './utils/build-documentation-tree';

function DocsLayout({ children }: React.PropsWithChildren) {
  const tree = buildDocumentationTree(
    documentationPages as DocumentationPage[],
  );

  return (
    <Container>
      <div className={'flex gap-8'}>
        <DocsNavigation
          tree={tree as ReturnType<typeof buildDocumentationTree>}
        />

        <div className={'flex-1 min-w-0 flex flex-col items-center'}>
          {children}
        </div>
      </div>
    </Container>
  );
}

export default DocsLayout;

type DocumentationPage = (typeof documentationPages)[number];
