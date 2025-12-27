import { Metadata } from 'next';
import { getUltauraAccount, getLines, getAllReminders } from '~/lib/ultaura/actions';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { RemindersPageClient } from './RemindersPageClient';
import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';

export const metadata: Metadata = {
  title: 'Reminders - Ultaura',
};

export default async function RemindersPage() {
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <>
        <AppHeader title="Reminders" description="Set up helpful reminders for any routine, task, or event" />
        <PageBody>
          <p className="text-muted-foreground">Organization not found.</p>
        </PageBody>
      </>
    );
  }

  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <>
        <AppHeader title="Reminders" description="Set up helpful reminders for any routine, task, or event" />
        <PageBody>
          <div className="max-w-lg mx-auto text-center py-8">
            <h2 className="text-2xl font-semibold mb-4">Get Started with Ultaura</h2>
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
        </PageBody>
      </>
    );
  }

  const [lines, reminders] = await Promise.all([
    getLines(account.id),
    getAllReminders(account.id),
  ]);

  // Filter to only verified lines
  const verifiedLines = lines.filter((l) => l.phone_verified_at);

  return (
    <>
      <AppHeader title="Reminders" description="Set up helpful reminders for any routine, task, or event" />
      <PageBody>
        <RemindersPageClient
          lines={verifiedLines}
          reminders={reminders}
        />
      </PageBody>
    </>
  );
}
