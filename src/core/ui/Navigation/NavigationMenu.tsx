'use client';

import { PropsWithChildren } from 'react';
import { cva } from 'cva';
import { NavigationMenuContext } from './NavigationMenuContext';

type Vertical = {
  vertical?: boolean;
};

type Bordered = {
  bordered?: boolean;
};

type Pill = {
  pill?: boolean;
};

type Scrollable = {
  scrollable?: boolean;
};

type Subtle = {
  subtle?: boolean;
};

type Centered = {
  centered?: boolean;
};

type AriaLabel = {
  ariaLabel?: string;
};

export type NavigationMenuProps = Vertical &
  (Bordered | Pill) &
  Scrollable &
  Subtle &
  Centered &
  AriaLabel;

function NavigationMenu(props: PropsWithChildren<NavigationMenuProps>) {
  const className = getNavigationMenuClassBuilder()(props);

  return (
    <ul className={className} aria-label={props.ariaLabel}>
      <NavigationMenuContext.Provider value={props}>
        {props.children}
      </NavigationMenuContext.Provider>
    </ul>
  );
}

export default NavigationMenu;

function getNavigationMenuClassBuilder() {
  return cva(['w-full items-center flex'], {
    variants: {
      vertical: {
        true: `flex items-start justify-between space-x-2
        lg:flex-col lg:justify-start lg:space-x-0 lg:space-y-1.5 [&>li>a]:w-full`,
      },
      bordered: {
        true: `gap-2 lg:gap-3 border-b border-border pb-1.5`,
      },
      subtle: {
        true: `gap-1.5 lg:gap-2`,
      },
      centered: {
        true: `justify-center`,
      },
      scrollable: {
        true: `overflow-x-auto flex-nowrap scrollbar-hide`,
        false: `flex-wrap`,
      },
    },
    defaultVariants: {
      scrollable: false,
    },
  });
}
