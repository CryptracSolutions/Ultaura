import Link from 'next/link';
import { HomeIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

function AdminBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="text-sm text-muted-foreground flex items-center py-2">
      <Link href="/admin" className="hover:text-foreground transition-colors">
        <HomeIcon className="h-4 w-4" />
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={index} className="flex items-center">
            <ChevronRightIcon className="h-3 w-3 mx-2 text-muted-foreground/50" />
            {isLast ? (
              <span className="font-medium text-foreground">{item.label}</span>
            ) : item.href ? (
              <Link href={item.href} className="hover:text-foreground transition-colors">
                {item.label}
              </Link>
            ) : (
              <span>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export default AdminBreadcrumbs;
