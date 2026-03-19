import { Metadata } from 'next';

import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';
import { PageTitleWithInfo } from '~/core/ui/PageTitleWithInfo';
import getLogger from '~/core/logger';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { getLines } from '~/lib/ultaura/lines';
import {
  getAccountPrivacySettings,
  getConsentAuditLog,
  getDataExportRequests,
  getLineVoiceConsents,
} from '~/lib/ultaura/privacy';
import { PrivacyCenterClient } from './PrivacyCenterClient';
import { getNotificationRecipients } from '~/lib/ultaura/notification-recipients';
import { getTrialStatus } from '~/lib/ultaura/helpers';
import { PLANS } from '~/lib/ultaura/constants';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { redirectViewerAway } from '~/lib/ultaura/viewer-guards';

export const metadata: Metadata = {
  title: 'Privacy Center - Ultaura',
};
const logger = getLogger();

const PRIVACY_CENTER_DESCRIPTION =
  'Manage consent, sharing, recording, and data exports';

function privacyCenterPageHeader(isSelfUser: boolean) {
  return (
    <AppHeader
      title={
        <PageTitleWithInfo
          title="Privacy Center"
          storageKey="privacy_center_info_tip_collapsed"
          infoLabel="Privacy info"
        >
          All data stays in your control. Ultaura stores call insights and
          memories securely.{' '}
          {isSelfUser
            ? 'Your recording and sharing preferences are set during your calls\u2014not from this dashboard.'
            : 'Recording and sharing consent is given by your loved one during their calls\u2014not from this dashboard.'}{' '}
          You can export or delete all data at any time.{' '}
          <a
            href="/docs/privacy"
            className="font-medium text-primary underline underline-offset-2 hover:no-underline"
          >
            Learn more →
          </a>
        </PageTitleWithInfo>
      }
      description={PRIVACY_CENTER_DESCRIPTION}
    />
  );
}

export default async function PrivacyCenterPage() {
  const pageHeaderFallback = (
    <AppHeader
      title="Privacy Center"
      description={PRIVACY_CENTER_DESCRIPTION}
    />
  );
  const appData = await loadAppDataForUser();
  redirectViewerAway(appData.role);
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <>
        {pageHeaderFallback}
        <PageBody>
          <div className="py-8">
            <p className="text-muted-foreground">
              We could not load your account right now. Please refresh and try
              again.
            </p>
          </div>
        </PageBody>
      </>
    );
  }

  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <>
        {pageHeaderFallback}
        <PageBody>
          <div className="py-8">
            <div className="max-w-lg rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Set up Ultaura to manage privacy settings
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Start a trial to enable privacy controls, exports, and retention
                settings.
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

  const results = await Promise.allSettled([
    getAccountPrivacySettings(account.id),
    getLines(account.id),
    getConsentAuditLog(account.id, { limit: 50 }),
    getDataExportRequests(account.id),
    getNotificationRecipients(account.id),
    getLineVoiceConsents(account.id),
  ]);
  const sourceLabels = [
    'getAccountPrivacySettings',
    'getLines',
    'getConsentAuditLog',
    'getDataExportRequests',
    'getNotificationRecipients',
    'getLineVoiceConsents',
  ] as const;

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.error(
        {
          accountId: account.id,
          source: sourceLabels[index],
          reason: result.reason,
        },
        'Privacy page loader Promise.allSettled operation rejected',
      );
    }
  });

  const privacySettings =
    results[0].status === 'fulfilled' ? results[0].value : null;
  const lines = results[1].status === 'fulfilled' ? results[1].value : [];
  const auditLog = results[2].status === 'fulfilled' ? results[2].value : [];
  const exportRequests =
    results[3].status === 'fulfilled' ? results[3].value : [];
  const notificationRecipients =
    results[4].status === 'fulfilled' ? results[4].value : [];
  const lineVoiceConsents =
    results[5].status === 'fulfilled' ? results[5].value : [];

  const trialStatus = getTrialStatus(account);
  const isTrialExpired = trialStatus.isExpired;
  const trialPlanId = (trialStatus.trialPlanId ??
    account.plan_id ??
    'free_trial') as keyof typeof PLANS;
  const trialPlanName = PLANS[trialPlanId]?.displayName ?? 'Trial';
  const isSelfUser = account.user_type === 'self';

  return (
    <>
      {privacyCenterPageHeader(isSelfUser)}
      <PageBody>
        {isTrialExpired && <TrialExpiredBanner trialPlanName={trialPlanName} />}
        <PrivacyCenterClient
          account={account}
          privacySettings={privacySettings}
          lines={lines}
          auditLog={auditLog}
          exportRequests={exportRequests}
          notificationRecipients={notificationRecipients}
          lineVoiceConsents={lineVoiceConsents}
        />
      </PageBody>
    </>
  );
}
