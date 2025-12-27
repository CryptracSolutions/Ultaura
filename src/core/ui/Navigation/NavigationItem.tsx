'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext } from 'react';

import classNames from 'clsx';
import { cva } from 'cva';

import { NavigationMenuContext } from './NavigationMenuContext';
import isRouteActive from '~/core/generic/is-route-active';
import Trans from '~/core/ui/Trans';

interface Link {
  path: string;
  label?: string;
}

const NavigationMenuItem: React.FCC<{
  link: Link;
  depth?: number;
  active?: boolean;
  disabled?: boolean;
  shallow?: boolean;
  scroll?: boolean;
  className?: string;
}> = ({
  link,
  disabled,
  shallow,
  scroll,
  depth,
  active: activeOverride,
  ...props
}) => {
  const pathName = usePathname() ?? '';
  const active =
    typeof activeOverride === 'boolean'
      ? activeOverride
      : isRouteActive(link.path, pathName, depth ?? 3);
  const menuProps = useContext(NavigationMenuContext);
  const label = link.label;

  const itemClassName = getNavigationMenuItemClassBuilder()({
    active,
    ...menuProps,
  });

  const className = classNames(itemClassName, props.className ?? ``);

  return (
    <li className={className}>
      <Link
        className={
          'transition-transform duration-500 justify-center lg:justify-start'
        }
        aria-disabled={disabled}
        href={disabled ? '' : link.path}
        shallow={shallow ?? active}
        scroll={scroll}
      >
        <Trans i18nKey={label} defaults={label} />
      </Link>
    </li>
  );
};

export default NavigationMenuItem;

function getNavigationMenuItemClassBuilder() {
  return cva(
    [
      `flex items-center justify-center font-medium lg:justify-start rounded-md text-sm transition colors transform *:active:translate-y-[2px]`,
      '*:p-1 *:lg:px-2.5 *:s-full *:flex *:items-center',
      'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
    ],
    {
      compoundVariants: [
        // not active - shared
        {
          active: false,
          className: `active:text-current text-muted-foreground hover:text-primary`,
        },
        // active - shared
        {
          active: true,
          className: `text-foreground hover:text-primary`,
        },
        // active - pill
        {
          active: true,
          pill: true,
          className: `bg-muted text-foreground hover:text-primary`,
        },
        // not active - pill
        {
          active: false,
          pill: true,
          className: `hover:bg-muted hover:text-primary active:bg-muted/80 text-muted-foreground`,
        },
        // not active - bordered
        {
          active: false,
          bordered: true,
          className: `hover:bg-muted hover:text-primary active:bg-muted/80 transition-colors rounded-lg border-transparent`,
        },
        // active - bordered
        {
          active: true,
          bordered: true,
          className: `relative top-[0.4rem] rounded-none bg-transparent pb-[0.55rem] text-primary after:absolute after:inset-x-0 after:-bottom-[0.125rem] after:h-1 after:bg-primary after:content-['']`,
        },
        // active - secondary
        {
          active: true,
          secondary: true,
          className: `bg-transparent font-semibold hover:text-primary`,
        },
      ],
      variants: {
        active: {
          true: ``,
        },
        pill: {
          true: `[&>*]:py-2`,
        },
        bordered: {
          true: `relative h-10`,
        },
        secondary: {
          true: ``,
        },
      },
    },
  );
}
