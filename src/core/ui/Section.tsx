import classNames from 'clsx';

import Heading from '~/core/ui/Heading';
import If from '~/core/ui/If';

export function Section({
  children,
  className,
}: React.PropsWithChildren<{
  className?: string;
}>) {
  return (
    <div
      className={classNames(
        'rounded-md w-full border border-border divide-y divide-border',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader(
  props: React.PropsWithChildren<{
    title: string | React.ReactNode;
    description?: string | React.ReactNode;
    className?: string;
  }>,
) {
  return (
    <div
      className={classNames(
        'flex flex-col space-y-0.5 px-container pt-container pb-container',
        props.className,
      )}
    >
      <Heading type={4}>{props.title}</Heading>

      <If condition={props.description}>
        <p className={'text-muted-foreground'}>
          {props.description}
        </p>
      </If>
    </div>
  );
}

export function SectionBody(
  props: React.PropsWithChildren<{
    className?: string;
  }>,
) {
  return (
    <div className={classNames('flex flex-col p-container', props.className)}>
      {props.children}
    </div>
  );
}
