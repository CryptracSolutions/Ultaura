import Link from 'next/link';
import { ChevronRightIcon, HomeIcon } from '@heroicons/react/24/outline';
import { cn } from '~/core/generic/shadcn-utils';

export interface BreadcrumbItem {
  label: string;
  href: string;
}

export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav
      className={cn(
        'flex items-center text-sm text-muted-foreground',
        className
      )}
    >
      <Link
        href="/docs"
        className="flex items-center hover:text-foreground transition-colors"
      >
        <HomeIcon className="h-4 w-4" />
      </Link>

      {items.map((item, index) => (
        <div key={item.href} className="flex items-center">
          <ChevronRightIcon className="h-4 w-4 mx-2 text-muted-foreground/50" />
          {index === items.length - 1 ? (
            <span className="font-medium text-foreground">{item.label}</span>
          ) : (
            <Link
              href={item.href}
              className="hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}

