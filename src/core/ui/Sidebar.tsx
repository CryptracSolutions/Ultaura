'use client';

import React, { useContext, useId, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import classNames from 'clsx';
import { cva } from 'cva';

import { cn } from '~/core/generic/shadcn-utils';

import If from '~/core/ui/If';
import { TooltipContent, Tooltip, TooltipTrigger } from '~/core/ui/Tooltip';
import SidebarContext from '~/lib/contexts/sidebar';
import isRouteActive from '~/core/generic/is-route-active';

export function Sidebar({
  children,
  collapsed = false,
}: React.PropsWithChildren<{
  collapsed?: boolean;
}>) {
  const className = getClassNameBuilder()({
    collapsed,
  });

  return <div className={className}>{children}</div>;
}

export function SidebarContent({
  children,
  className,
}: React.PropsWithChildren<{
  className?: string;
}>) {
  return (
    <div
      className={cn(
        'flex w-full flex-col px-container space-y-1.5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SidebarGroup({
  label,
  collapsed = false,
  collapsible = true,
  children,
}: React.PropsWithChildren<{
  label: string | React.ReactNode;
  collapsible?: boolean;
  collapsed?: boolean;
}>) {
  const { collapsed: sidebarCollapsed } = useContext(SidebarContext);
  const [isGroupCollapsed, setIsGroupCollapsed] = useState(collapsed);
  const id = useId();

  const Title = (props: React.PropsWithChildren) => {
    if (sidebarCollapsed) {
      return null;
    }

    return (
      <span
        className={
          'text-xs font-semibold uppercase text-sidebar-foreground group-hover:text-foreground'
        }
      >
        {props.children}
      </span>
    );
  };

  const Wrapper = () => {
    const className = classNames(
      'group flex items-center justify-between px-3 space-x-2.5',
      {
        'py-2.5': !sidebarCollapsed,
      },
    );

    if (collapsible) {
      return (
        <button
          aria-expanded={!isGroupCollapsed}
          aria-controls={id}
          onClick={() => setIsGroupCollapsed(!isGroupCollapsed)}
          className={className}
        >
          <Title>{label}</Title>

          <If condition={collapsible}>
            <ChevronDownIcon
              className={classNames(`transition duration-300 h-3`, {
                'rotate-180': !isGroupCollapsed,
              })}
            />
          </If>
        </button>
      );
    }

    return (
      <div className={className}>
        <Title>{label}</Title>
      </div>
    );
  };

  return (
    <div className={'flex flex-col space-y-1 py-1'}>
      <Wrapper />

      <If condition={collapsible ? !isGroupCollapsed : true}>
        <div id={id} className={'flex flex-col space-y-1.5'}>
          {children}
        </div>
      </If>
    </div>
  );
}

export function SidebarDivider() {
  return (
    <div className={'border-t border-border my-2'} />
  );
}

export function SidebarItem({
  end,
  path,
  children,
  Icon,
  activeMatch,
}: React.PropsWithChildren<{
  path: string;
  Icon: React.ElementType;
  end?: boolean;
  activeMatch?: (currentPath: string) => boolean;
}>) {
  const { collapsed } = useContext(SidebarContext);

  const currentPath = usePathname() ?? '';
  const active = activeMatch
    ? activeMatch(currentPath)
    : isRouteActive(path, currentPath, end ? 0 : 3);

  const className = getSidebarItemClassBuilder()({
    collapsed,
    active,
  });

  return (
    <Link key={path} href={path} className={className}>
      <If condition={collapsed} fallback={<Icon className={'h-5'} />}>
        <Tooltip>
          <TooltipTrigger>
            <Icon className={'h-5'} />
          </TooltipTrigger>

          <TooltipContent side={'right'} sideOffset={20}>
            {children}
          </TooltipContent>
        </Tooltip>
      </If>

      <span>{children}</span>
    </Link>
  );
}

export default Sidebar;

function getClassNameBuilder() {
  return cva(
    [
      'fixed flex box-content hidden h-screen flex-col border-r border-border lg:flex ' +
        'transition-[width] duration-300 ease-in-out motion-reduce:transition-none bg-sidebar',
    ],
    {
      variants: {
        collapsed: {
          true: `w-[5rem]`,
          false: `w-2/12 lg:w-[17rem]`,
        },
      },
    },
  );
}

function getSidebarItemClassBuilder() {
  return cva(
    [
      `flex w-full items-center rounded-md border-transparent text-sm font-base transition-colors duration-300 [&>span]:overflow-hidden [&>span]:whitespace-nowrap [&>span]:transition-[opacity,max-width] [&>span]:duration-300 [&>span]:ease-in-out`,
    ],
    {
      variants: {
        collapsed: {
          true: `justify-center py-2 [&>span]:opacity-0 [&>span]:max-w-0 [&>span]:min-w-0 [&>span]:overflow-hidden`,
          false: `py-2 px-3 pr-12 space-x-2.5 [&>span]:opacity-100 [&>span]:max-w-32`,
        },
        active: {
          true: `shadow-[inset_1px_0_0_0_var(--primary)] bg-primary/10 font-medium`,
          false: `ring-transparent hover:bg-muted active:bg-muted/80 text-sidebar-foreground hover:text-foreground`,
        },
      },
      compoundVariants: [
        {
          collapsed: true,
          active: true,
          className: `shadow-none bg-primary/10 text-sidebar-foreground [&_svg]:text-primary`,
        },
        {
          collapsed: false,
          active: true,
          className: `shadow-[inset_1px_0_0_0_var(--primary)] pl-[11px] text-sidebar-foreground [&_svg]:text-primary`,
        },
        {
          collapsed: true,
          active: false,
          className: `text-sidebar-foreground`,
        },
      ],
    },
  );
}
