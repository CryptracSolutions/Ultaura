import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getUltauraAccount, getLines, getAllSchedules } from '~/lib/ultaura/actions';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { CallsPageClient } from './CallsPageClient';

export const metadata: Metadata = {
  title: 'Calls - Ultaura',
};

export default async function CallsPage() {
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Organization not found.</p>
      </div>
    );
  }

  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <div className="p-6">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-2xl font-semibold mb-4">Get Started with Ultaura</h1>
          <p className="text-muted-foreground mb-6">
            Set up phone companionship for your loved ones. Start with a free trial.
          </p>
          <a
            href="/dashboard/settings/subscription"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Start Free Trial
          </a>
        </div>
      </div>
    );
  }

  const [lines, schedules] = await Promise.all([
    getLines(account.id),
    getAllSchedules(account.id),
  ]);

  // Filter to only verified lines
  const verifiedLines = lines.filter((l) => l.phone_verified_at);

  return (
    <CallsPageClient
      lines={verifiedLines}
      schedules={schedules}
    />
  );
}
