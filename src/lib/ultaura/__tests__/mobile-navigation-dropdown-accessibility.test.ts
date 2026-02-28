import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/privacy?tab=data&section=retention',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('~/core/ui/Button', () => ({
  default: ({
    children,
    block: _block,
    ...props
  }: React.ComponentProps<'button'> & { block?: boolean }) =>
    React.createElement('button', props, children),
}));

vi.mock('~/core/ui/Dropdown', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}));

vi.mock('~/core/ui/Trans', () => ({
  default: ({ defaults }: { defaults?: string }) =>
    React.createElement('span', null, defaults ?? ''),
}));

import MobileNavigationDropdown from '~/core/ui/MobileNavigationDropdown';

describe('MobileNavigationDropdown accessibility', () => {
  it('applies aria-label to the trigger button when provided', () => {
    const html = renderToStaticMarkup(
      React.createElement(MobileNavigationDropdown, {
        links: [{ path: '/dashboard/privacy?tab=data&section=retention', label: 'Retention' }],
        currentLabel: 'Retention',
        ariaLabel: 'Select privacy section',
      }),
    );

    expect(html).toContain('aria-label="Select privacy section"');
  });
});
