import Link from 'next/link';
import { Lock } from 'lucide-react';

import Button from '~/core/ui/Button';

export const metadata = {
  title: 'Dashboard Access Removed',
};

export default function AccessRemovedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm text-center space-y-5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Dashboard access removed
          </h1>
          <p className="text-sm text-muted-foreground">
            Your access to this dashboard has been removed by the account
            holder. If you believe this is an error, please contact them
            directly.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
          <Button asChild variant="default">
            <Link href="/auth/sign-in">Log In</Link>
          </Button>

          <Button asChild variant="outline">
            <Link href="/">Go to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
