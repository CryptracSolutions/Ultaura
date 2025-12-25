'use client';

import Link from 'next/link';
import Bars3Icon from '@heroicons/react/24/outline/Bars3Icon';

import NavigationMenuItem from '~/core/ui/Navigation/NavigationItem';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import useUserSession from '~/core/hooks/use-user-session';

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenu,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';

const links = {
  SignIn: {
    label: 'Sign In',
    path: '/auth/sign-in',
  },
  SignUp: {
    label: 'Sign Up',
    path: '/auth/sign-up',
  },
  Blog: {
    label: 'Blog',
    path: '/blog',
  },
  Docs: {
    label: 'Documentation',
    path: '/docs',
  },
  Demo: {
    label: 'Demo',
    path: '/demo',
  },
  Pricing: {
    label: 'Pricing',
    path: '/pricing',
  },
  About: {
    label: 'About',
    path: '/about',
  },
  FAQ: {
    label: 'FAQ',
    path: '/faq',
  },
};

const SiteNavigation = () => {
  const className = 'font-semibold';

  return (
    <>
      <div className={'hidden items-center space-x-0.5 lg:flex'}>
        <NavigationMenu>
          <NavigationMenuItem
            className={'flex lg:hidden'}
            link={links.SignIn}
          />

          <NavigationMenuItem className={className} link={links.Blog} />
          <NavigationMenuItem className={className} link={links.Docs} />
          <NavigationMenuItem className={className} link={links.Demo} />
          <NavigationMenuItem className={className} link={links.Pricing} />
          <NavigationMenuItem className={className} link={links.About} />
          <NavigationMenuItem className={className} link={links.FAQ} />
        </NavigationMenu>
      </div>

      <div className={'flex items-center lg:hidden'}>
        <MobileDropdown />
      </div>
    </>
  );
};

function MobileDropdown() {
  const userSession = useUserSession();

  // Filter out auth links if user is authenticated
  const mobileLinks = Object.entries(links).filter(
    ([key]) => !((key === 'SignIn' || key === 'SignUp') && userSession)
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={'Open Menu'}>
        <Bars3Icon className={'h-9'} />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {mobileLinks.map(([, item]) => {
          const className = 'flex w-full h-full items-center';

          return (
            <DropdownMenuItem key={item.path}>
              <Link className={className} href={item.path}>
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default SiteNavigation;
