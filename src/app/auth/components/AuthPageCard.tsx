'use client';

import { usePathname } from 'next/navigation';

export default function AuthPageCard({
  children,
}: React.PropsWithChildren) {
  const pathname = usePathname();
  const shouldAnimate = pathname !== '/auth/confirmed';

  return (
    <div
      className={
        'flex w-full max-w-md flex-col items-center space-y-4 rounded-xl border border-border bg-card text-card-foreground px-4 py-6 shadow-lg' +
        ' lg:px-8' +
        (shouldAnimate
          ? ' animate-in fade-in slide-in-from-top-8 duration-1000'
          : '')
      }
    >
      {children}
    </div>
  );
}
