import Link from 'next/link';
import classNames from 'clsx';
import type { DocumentationPage } from 'contentlayer/generated';
import If from '~/core/ui/If';

function DocumentationPageLink({
  page,
  before,
  after,
}: React.PropsWithChildren<{
  page: DocumentationPage;
  before?: React.ReactNode;
  after?: React.ReactNode;
}>) {
  return (
    <Link
      className={classNames(
        `relative flex w-full items-center justify-center rounded-xl px-6 py-[18px] font-medium text-current ring-1 ring-primary transition-all hover:bg-gray-50 dark:hover:bg-background/90 active:dark:bg-dark-800 text-center`,
      )}
      href={`/docs/${page.resolvedPath}`}
    >
      <If condition={before}>
        {(node) => (
          <span
            className="absolute left-6 flex items-center text-primary"
            aria-hidden="true"
          >
            {node}
          </span>
        )}
      </If>

      <span className={'flex flex-col items-center space-y-1.5 text-center'}>
        <span
          className={
            'text-xs font-semibold uppercase text-primary'
          }
        >
          {before ? `Previous` : ``}
          {after ? `Next` : ``}
        </span>

        <span>{page.title}</span>
      </span>

      <If condition={after}>
        {(node) => (
          <span
            className="absolute right-6 flex items-center text-primary"
            aria-hidden="true"
          >
            {node}
          </span>
        )}
      </If>
    </Link>
  );
}

export default DocumentationPageLink;
