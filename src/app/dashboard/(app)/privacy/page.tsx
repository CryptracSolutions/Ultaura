import { Metadata } from 'next';

import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { getLines } from '~/lib/ultaura/lines';
import {
  getAccountPrivacySettings,
  getConsentAuditLog,
  getDataExportRequests,
} from '~/lib/ultaura/privacy';
import { PrivacyCenterClient } from './PrivacyCenterClient';

export const metadata: Metadata = {
  title: 'Privacy Center - Ultaura',
};

export default async function PrivacyCenterPage() {
  const appData = await loadAppDataForUser();
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <>
        <AppHeader title="Privacy Center" description="Manage recording, memory, and data exports" />
        <PageBody>
          <div className="py-8">
            <p className="text-muted-foreground">Organization not found.</p>
          </div>
        </PageBody>
      </>
    );
  }

  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <>
        <AppHeader title="Privacy Center" description="Manage recording, memory, and data exports" />
        <PageBody>
          <div className="py-8">
            <div className="max-w-lg rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Set up Ultaura to manage privacy settings
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Start a trial to enable privacy controls, exports, and retention settings.
              </p>
              <a
                href="/dashboard/settings/subscription"
                className="mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                Start trial →
              </a>
            </div>
          </div>
        </PageBody>
      </>
    );
  }

  const [privacySettings, lines, auditLog, exportRequests] = await Promise.all([
    getAccountPrivacySettings(account.id),
    getLines(account.id),
    getConsentAuditLog(account.id, { limit: 50 }),
    getDataExportRequests(account.id),
  ]);

  return (
    <>
      <AppHeader title="Privacy Center" description="Manage recording, memory, and data exports" />
      <PageBody>
        <PrivacyCenterClient
          account={account}
          privacySettings={privacySettings}
          lines={lines}
          auditLog={auditLog}
          exportRequests={exportRequests}
        />
      </PageBody>
    </>
  );
}
