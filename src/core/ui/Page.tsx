import classNames from 'clsx';
import Heading from '~/core/ui/Heading';

export function Page(
  props: React.PropsWithChildren<{
    sidebar?: React.ReactNode;
    contentContainerClassName?: string;
    className?: string;
  }>,
) {
  return (
    <div className={props.className}>
      <div className={'hidden lg:block'}>{props.sidebar}</div>

      <div
        className={
          props.contentContainerClassName ??
          'mx-auto flex flex-col h-screen w-full overflow-y-auto'
        }
      >
        {props.children}
      </div>
    </div>
  );
}

export function PageBody(
  props: React.PropsWithChildren<{
    className?: string;
  }>,
) {
  const className = classNames(
    'w-full px-container flex flex-col flex-1',
    props.className,
  );

  return <div className={className}>{props.children}</div>;
}

export function PageHeader({
  children,
  title,
  description,
  mobileNavigation,
  showDescriptionOnMobile = false,
}: React.PropsWithChildren<{
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  mobileNavigation?: React.ReactNode;
  showDescriptionOnMobile?: boolean;
}>) {
  return (
    <div className={'flex items-start justify-between p-container'}>
      <div className="flex flex-col">
        <div className="flex items-center space-x-2">
          {mobileNavigation && (
            <div className={'flex items-center lg:hidden'}>{mobileNavigation}</div>
          )}

          <Heading type={3}>
            <span className={'flex items-center space-x-0.5 lg:space-x-2'}>
              <span className={'font-semibold dark:text-white'}>{title}</span>
            </span>
          </Heading>
        </div>

        <Heading
          type={5}
          className={showDescriptionOnMobile ? 'block' : 'hidden lg:block'}
        >
          <span className={'dark:text-gray-400 text-gray-600 font-normal'}>
            {description}
          </span>
        </Heading>
      </div>

      {children}
    </div>
  );
}
