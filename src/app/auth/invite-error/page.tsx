import Link from 'next/link';

import Button from '~/core/ui/Button';
import Heading from '~/core/ui/Heading';

export const metadata = {
  title: 'Invite Access Problem',
};

export default function InviteErrorPage() {
  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <Heading type={4}>We could not finish your dashboard access</Heading>

      <div className="max-w-md space-y-3 text-sm text-muted-foreground">
        <p>Your account was created, but the shared dashboard could not be connected.</p>
        <p>
          Please contact the account holder or support so they can resend your
          access invite.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/auth/sign-in">Sign In</Link>
        </Button>

        <Button asChild variant="outline">
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  );
}
