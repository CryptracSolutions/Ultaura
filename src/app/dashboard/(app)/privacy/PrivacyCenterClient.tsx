'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import classNames from 'clsx';

import { Section, SectionBody } from '~/core/ui/Section';
import { useAutoSave } from '~/core/hooks/use-auto-save';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import NavigationItem from '~/core/ui/Navigation/NavigationItem';
import MobileNavigationDropdown from '~/core/ui/MobileNavigationDropdown';

import type {
  AccountPrivacySettings,
  ConsentAuditEntry,
  DataExportRequest,
  LineRow,
  LineVoiceConsent,
  NotificationRecipient,
  RetentionPeriod,
  UltauraAccountRow,
} from '~/lib/ultaura/types';
import {
  updateAccountSharing,
  upgradeSelfToFamilyMode,
} from '~/lib/ultaura/accounts';
import {
  requestAccountDataDeletion,
  requestDataExport,
  requestRecordingReenable,
  requestSharingRePrompt,
} from '~/lib/ultaura/privacy';

import { PrivacyDialogs } from './components/PrivacyDialogs';
import { PrivacyStateBanner } from './components/PrivacyStateBanner';
import { AuditSection } from './components/sections/AuditSection';
import { ConsentStatusSection } from './components/sections/ConsentStatusSection';
import { DataRetentionSection } from './components/sections/DataRetentionSection';
import { ExportSection } from './components/sections/ExportSection';
import { FamilyRecipientsSection } from './components/sections/FamilyRecipientsSection';
import { OverviewSection } from './components/sections/OverviewSection';
import { PrivacyControlsSection } from './components/sections/PrivacyControlsSection';
import { SharingPreferencesSection } from './components/sections/SharingPreferencesSection';
import { useAuditFilters } from './hooks/useAuditFilters';
import { useExportPolling } from './hooks/useExportPolling';
import { useInviteFlow } from './hooks/useInviteFlow';
import { useDashboardSharingToggle } from './hooks/useDashboardSharingToggle';
import { usePrivacyAutosaveState } from './hooks/usePrivacyAutosaveState';
import {
  buildPrivacyUrl,
  parsePrivacySection,
  parsePrivacyTab,
  PRIVACY_SECTIONS,
  PRIVACY_TABS,
} from './lib/privacy-navigation';
import { assertActionSucceeded } from './lib/action-result';
import { formatDate } from '~/lib/utils/format-date';
import type { PrivacySectionConfig, PrivacyTabValue } from './types';

interface PrivacyCenterClientProps {
  account: UltauraAccountRow;
  privacySettings: AccountPrivacySettings | null;
  lines: LineRow[];
  lineVoiceConsents: LineVoiceConsent[];
  auditLog: ConsentAuditEntry[];
  exportRequests: DataExportRequest[];
  notificationRecipients: NotificationRecipient[];
}

const RETENTION_OPTIONS: Array<{
  value: RetentionPeriod;
  label: string;
  description: string;
}> = [
  {
    value: '30_days',
    label: '30 days',
    description: 'Short-term retention for highly sensitive data.',
  },
  {
    value: '90_days',
    label: '90 days',
    description: 'Balanced retention for personalization and review.',
  },
  {
    value: '365_days',
    label: '365 days',
    description: 'Longer retention for historical context.',
  },
  {
    value: 'indefinite',
    label: 'Indefinite',
    description: 'Keep data until you delete it.',
  },
];

const SHARING_TIER_LABELS: Record<string, string> = {
  tier_1: 'Basic Updates & Safety',
  tier_2: 'Wellness Check',
  tier_3: 'Full Summary',
  tier_4: 'Complete Visibility',
};

const SHARING_TIER_FEATURES: Record<
  string,
  Array<{ text: string; included: boolean }>
> = {
  tier_1: [
    { text: 'Safety alerts', included: true },
    { text: 'Mood & sentiment', included: false },
    { text: 'Conversation topics', included: false },
    { text: 'Specific concerns', included: false },
  ],
  tier_2: [
    { text: 'Safety alerts', included: true },
    { text: 'Mood & sentiment', included: true },
    { text: 'Conversation topics', included: false },
    { text: 'Specific concerns', included: false },
  ],
  tier_3: [
    { text: 'Safety alerts', included: true },
    { text: 'Mood & sentiment', included: true },
    { text: 'Conversation topics', included: true },
    { text: 'Specific concerns', included: false },
  ],
  tier_4: [
    { text: 'Safety alerts', included: true },
    { text: 'Mood & sentiment', included: true },
    { text: 'Conversation topics', included: true },
    { text: 'Specific concerns', included: true },
  ],
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SHARING_COOLDOWN_MS = THIRTY_DAYS_MS;
const RECORDING_REENABLE_COOLDOWN_MS = THIRTY_DAYS_MS;
const AUDIT_PAGE_SIZE = 10;

function getDefaultTabUrl(tab: PrivacyTabValue): string {
  const firstSection = PRIVACY_SECTIONS[tab][0];
  return firstSection
    ? buildPrivacyUrl(tab, firstSection.value)
    : buildPrivacyUrl(tab);
}

export function PrivacyCenterClient({
  account,
  privacySettings,
  lines,
  lineVoiceConsents,
  auditLog,
  exportRequests,
  notificationRecipients,
}: PrivacyCenterClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const lineCount = lines.length;
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [includeMemories, setIncludeMemories] = useState(true);
  const [includeCallMetadata, setIncludeCallMetadata] = useState(true);
  const [includeReminders, setIncludeReminders] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [upgradeConfirmOpen, setUpgradeConfirmOpen] = useState(false);
  const [isSharingUpdating, setIsSharingUpdating] = useState(false);
  const [recordingRequestLineId, setRecordingRequestLineId] = useState<
    string | null
  >(null);
  const [sharingRequestLineId, setSharingRequestLineId] = useState<
    string | null
  >(null);
  const [isLineRequestPending, setIsLineRequestPending] = useState(false);

  const initialSharingEnabled = account.sharing_enabled ?? true;
  const [sharingEnabled, setSharingEnabled] = useState(initialSharingEnabled);

  const sharingAutoSave = useAutoSave<{ sharingEnabled: boolean }>({
    saveFn: async (value) => {
      const result = await updateAccountSharing(
        account.id,
        value.sharingEnabled,
      );
      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: result.error?.message || 'Failed to save',
      };
    },
    toastSuccess: 'Sharing updated',
    onSuccess: () => router.refresh(),
  });

  const {
    isPrivacySettingsUnavailable,
    recordingEnabled,
    aiSummarizationEnabled,
    retentionPeriod,
    retentionConfirmOpen,
    setRetentionConfirmOpen,
    privacyAutoSave,
    onRecordingToggle,
    onSummarizationToggle,
    onRetentionSelect,
    confirmRetentionChange,
  } = usePrivacyAutosaveState({
    accountId: account.id,
    privacySettings,
    onSaveSuccess: () => router.refresh(),
    externalSaving: sharingAutoSave.isSaving,
  });

  const {
    exports,
    setExports,
    exportInProgress,
    exportPollingTimedOut,
    refreshExports,
  } = useExportPolling({
    accountId: account.id,
    initialExports: exportRequests,
  });

  const {
    auditConsentFilter,
    setAuditConsentFilter,
    auditActorFilter,
    setAuditActorFilter,
    auditSearch,
    setAuditSearch,
    auditPage,
    setAuditPage,
    consentTypeOptions,
    actorTypeOptions,
    filteredAuditLog,
    pagedAuditLog,
    auditTotalPages,
    auditPageSafe,
  } = useAuditFilters({
    auditLog,
    pageSize: AUDIT_PAGE_SIZE,
  });

  const inviteFlow = useInviteFlow({
    accountId: account.id,
    initialRecipients: notificationRecipients,
  });
  const dashboardSharingToggle = useDashboardSharingToggle({
    accountId: account.id,
    recipients: inviteFlow.recipients,
    setRecipients: inviteFlow.setRecipients,
  });

  useEffect(() => {
    if (sharingAutoSave.isSaving || privacyAutoSave.isSaving) {
      return;
    }
    setSharingEnabled(initialSharingEnabled);
  }, [
    initialSharingEnabled,
    privacyAutoSave.isSaving,
    sharingAutoSave.isSaving,
  ]);

  const lineConsentById = useMemo(
    () =>
      new Map(lineVoiceConsents.map((consent) => [consent.lineId, consent])),
    [lineVoiceConsents],
  );

  const isSelfUser = account.user_type === 'self';
  const canManageRecipients =
    account.user_type === 'family_managed' || (isSelfUser && sharingEnabled);
  const privacyTabs = canManageRecipients
    ? PRIVACY_TABS
    : PRIVACY_TABS.filter((tab) => tab.value !== 'family');

  const tabParam = parsePrivacyTab(searchParams.get('tab'));
  const activeTab =
    privacyTabs.find((tab) => tab.value === tabParam) ?? privacyTabs[0];

  const sectionParam = parsePrivacySection(searchParams.get('section'));
  const sectionsForTab = PRIVACY_SECTIONS[activeTab.value];
  const activeSection =
    sectionsForTab.find((section) => section.value === sectionParam) ??
    sectionsForTab[0] ??
    null;

  const retentionOption = useMemo(
    () => RETENTION_OPTIONS.find((option) => option.value === retentionPeriod),
    [retentionPeriod],
  );
  const retentionDescription = retentionOption?.description ?? '';
  const retentionLabel = retentionOption?.label ?? 'Not set';

  const consentSummary = useMemo(() => {
    const recordingSet = lineVoiceConsents.filter(
      (consent) => consent.recordingConsent !== 'pending',
    ).length;
    const sharingSet = lineVoiceConsents.filter(
      (consent) => consent.sharingConsent !== 'pending',
    ).length;

    return { recordingSet, sharingSet };
  }, [lineVoiceConsents]);

  const showSharingSummary =
    account.user_type === 'family_managed' || sharingEnabled;

  const latestRecordingRequestByLine = useMemo(() => {
    const latest = new Map<string, string>();
    for (const entry of auditLog) {
      if (
        entry.action !== 'recording_reenable_requested' ||
        !entry.lineId ||
        !entry.createdAt
      ) {
        continue;
      }
      const existing = latest.get(entry.lineId);
      if (!existing || new Date(entry.createdAt) > new Date(existing)) {
        latest.set(entry.lineId, entry.createdAt);
      }
    }
    return latest;
  }, [auditLog]);

  const handleExportRequest = async () => {
    setIsExporting(true);
    try {
      const result = await requestDataExport(account.id, {
        format: exportFormat,
        includeMemories,
        includeCallMetadata,
        includeReminders,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to start export');
        return;
      }

      const refreshed = await refreshExports();
      setExports(refreshed);
      toast.success('Export requested. We will prepare your file shortly.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to start export',
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDataDeletion = async () => {
    let hasShownErrorToast = false;
    try {
      const result = await requestAccountDataDeletion(
        account.id,
        'user_request',
      );
      try {
        assertActionSucceeded(result, 'Failed to delete data');
      } catch (error) {
        hasShownErrorToast = true;
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to delete data';
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }
      toast.success(
        'Deletion requested. Privacy data will be removed shortly.',
      );
    } catch (error) {
      if (!hasShownErrorToast) {
        toast.error('Failed to delete data');
      }
      throw error instanceof Error ? error : new Error('Failed to delete data');
    }
  };

  const handleSharingToggle = (nextEnabled: boolean) => {
    setSharingEnabled(nextEnabled);
    sharingAutoSave.triggerSave({ sharingEnabled: nextEnabled });
  };

  const handleRecordingReenable = async (lineId: string) => {
    if (isLineRequestPending) {
      return;
    }
    setIsLineRequestPending(true);
    setRecordingRequestLineId(lineId);
    try {
      const result = await requestRecordingReenable(lineId);
      if (!result.success) {
        toast.error(result.error || 'Failed to request recording re-enable');
        return;
      }
      toast.success('Recording re-enable requested');
      router.refresh();
    } catch {
      toast.error('Failed to request recording re-enable');
    } finally {
      setIsLineRequestPending(false);
      setRecordingRequestLineId(null);
    }
  };

  const handleSharingRePrompt = async (lineId: string) => {
    if (isLineRequestPending) {
      return;
    }
    setIsLineRequestPending(true);
    setSharingRequestLineId(lineId);
    try {
      const result = await requestSharingRePrompt(lineId);
      if (!result.success) {
        toast.error(result.error || 'Failed to request sharing change');
        return;
      }
      toast.success('Sharing change requested');
      router.refresh();
    } catch {
      toast.error('Failed to request sharing change');
    } finally {
      setIsLineRequestPending(false);
      setSharingRequestLineId(null);
    }
  };

  const handleUpgrade = async () => {
    setIsSharingUpdating(true);
    let hasShownErrorToast = false;
    try {
      const result = await upgradeSelfToFamilyMode(account.id);
      try {
        assertActionSucceeded(result, 'Failed to upgrade');
      } catch (error) {
        hasShownErrorToast = true;
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to upgrade';
        toast.error(errorMessage);
        throw new Error(errorMessage);
      }
      toast.success('Upgraded to family mode');
      router.refresh();
    } catch (error) {
      if (!hasShownErrorToast) {
        toast.error('Failed to upgrade');
      }
      throw error instanceof Error ? error : new Error('Failed to upgrade');
    } finally {
      setIsSharingUpdating(false);
    }
  };

  const handleInviteSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await inviteFlow.submitInvite();
  };

  const isAnySaveInProgress =
    privacyAutoSave.isSaving || sharingAutoSave.isSaving;
  const showSavingState =
    isAnySaveInProgress ||
    privacyAutoSave.hasPending ||
    sharingAutoSave.hasPending;

  const activeContent = (() => {
    if (activeTab.value !== 'overview' && !activeSection) {
      return (
        <Section>
          <SectionBody>
            <p className="text-sm text-muted-foreground">
              This section is unavailable right now. Please refresh.
            </p>
          </SectionBody>
        </Section>
      );
    }

    switch (activeTab.value) {
      case 'overview':
        return (
          <OverviewSection
            isSelfUser={isSelfUser}
            lineCount={lineCount}
            consentSummary={consentSummary}
            showSharingSummary={showSharingSummary}
            recordingEnabled={recordingEnabled}
            aiSummarizationEnabled={aiSummarizationEnabled}
            sharingEnabled={sharingEnabled}
            retentionLabel={retentionLabel}
            retentionDescription={retentionDescription}
            showFamilyTab={canManageRecipients}
            confirmedRecipients={inviteFlow.confirmedRecipients}
            activeRecipientCount={inviteFlow.activeRecipientCount}
            sharingAutoSaveIsSaving={sharingAutoSave.isSaving}
            isSharingUpdating={isSharingUpdating}
            onEnableFamilySharing={() => handleSharingToggle(true)}
          />
        );

      case 'consent':
        if (!activeSection) return null;
        if (activeSection.value === 'consent-status') {
          return (
            <ConsentStatusSection
              recordingEnabled={recordingEnabled}
              lines={lines}
              lineConsentById={lineConsentById}
              latestRecordingRequestByLine={latestRecordingRequestByLine}
              recordingRequestLineId={recordingRequestLineId}
              isAnyLineRequestPending={isLineRequestPending}
              recordingReenableCooldownMs={RECORDING_REENABLE_COOLDOWN_MS}
              onRecordingReenable={handleRecordingReenable}
              formatShortDate={formatDate}
            />
          );
        }

        if (activeSection.value === 'privacy-controls') {
          return (
            <PrivacyControlsSection
              recordingEnabled={recordingEnabled}
              aiSummarizationEnabled={aiSummarizationEnabled}
              isSaving={privacyAutoSave.isSaving}
              isPrivacySettingsUnavailable={isPrivacySettingsUnavailable}
              onRecordingToggle={onRecordingToggle}
              onSummarizationToggle={onSummarizationToggle}
            />
          );
        }

        return null;

      case 'data':
        if (!activeSection) return null;

        if (activeSection.value === 'retention') {
          return (
            <DataRetentionSection
              retentionLabel={retentionLabel}
              retentionDescription={retentionDescription}
              retentionPeriod={retentionPeriod}
              retentionOptions={RETENTION_OPTIONS}
              isSaving={privacyAutoSave.isSaving}
              isPrivacySettingsUnavailable={isPrivacySettingsUnavailable}
              onRetentionChange={onRetentionSelect}
              onDeletePrivacyData={() => setDeleteDialogOpen(true)}
            />
          );
        }

        if (activeSection.value === 'export') {
          return (
            <ExportSection
              exportFormat={exportFormat}
              onExportFormatChange={setExportFormat}
              isExporting={isExporting}
              exportInProgress={exportInProgress}
              lineCount={lineCount}
              exportPollingTimedOut={exportPollingTimedOut}
              onExportRequest={handleExportRequest}
              includeMemories={includeMemories}
              includeCallMetadata={includeCallMetadata}
              includeReminders={includeReminders}
              onIncludeMemoriesChange={setIncludeMemories}
              onIncludeCallMetadataChange={setIncludeCallMetadata}
              onIncludeRemindersChange={setIncludeReminders}
              exports={exports}
            />
          );
        }

        if (activeSection.value === 'audit') {
          return (
            <AuditSection
              auditConsentFilter={auditConsentFilter}
              onAuditConsentFilterChange={setAuditConsentFilter}
              consentTypeOptions={consentTypeOptions}
              auditActorFilter={auditActorFilter}
              onAuditActorFilterChange={setAuditActorFilter}
              actorTypeOptions={actorTypeOptions}
              auditSearch={auditSearch}
              onAuditSearchChange={setAuditSearch}
              filteredAuditLog={filteredAuditLog}
              pagedAuditLog={pagedAuditLog}
              auditLog={auditLog}
              auditPageSafe={auditPageSafe}
              auditTotalPages={auditTotalPages}
              onAuditPrevPage={() => setAuditPage(Math.max(1, auditPage - 1))}
              onAuditNextPage={() =>
                setAuditPage(Math.min(auditTotalPages, auditPage + 1))
              }
            />
          );
        }

        return null;

      case 'family':
        if (!activeSection) return null;

        if (activeSection.value === 'recipients') {
          return (
            <FamilyRecipientsSection
              activeRecipientCount={inviteFlow.activeRecipientCount}
              recipients={inviteFlow.recipients}
              isInviting={inviteFlow.isInviting}
              onRemoveRecipient={inviteFlow.removeRecipient}
              onGrantDashboardAccess={dashboardSharingToggle.requestGrant}
              onRevokeDashboardAccess={dashboardSharingToggle.revoke}
              isDashboardSharingLoading={dashboardSharingToggle.isLoading}
              isGrantConfirmOpen={dashboardSharingToggle.isConfirmDialogOpen}
              pendingGrantRecipient={dashboardSharingToggle.pendingRecipient}
              onCancelGrant={dashboardSharingToggle.cancelGrant}
              onConfirmGrant={dashboardSharingToggle.confirmGrant}
              showInviteModal={inviteFlow.showInviteModal}
              setShowInviteModal={inviteFlow.setShowInviteModal}
              inviteError={inviteFlow.inviteError}
              setInviteError={inviteFlow.setInviteError}
              attemptCloseInvite={inviteFlow.attemptCloseInvite}
              hasInviteChanges={inviteFlow.hasInviteChanges}
              firstInputRef={inviteFlow.firstInputRef}
              inviteName={inviteFlow.inviteName}
              setInviteName={inviteFlow.setInviteName}
              inviteEmail={inviteFlow.inviteEmail}
              setInviteEmail={inviteFlow.setInviteEmail}
              invitePhone={inviteFlow.invitePhone}
              setInvitePhone={inviteFlow.setInvitePhone}
              invitePhoneError={inviteFlow.invitePhoneError}
              setInvitePhoneError={inviteFlow.setInvitePhoneError}
              inviteRelationship={inviteFlow.inviteRelationship}
              setInviteRelationship={inviteFlow.setInviteRelationship}
              onInviteSubmit={handleInviteSubmit}
              showDiscardConfirm={inviteFlow.showDiscardConfirm}
              setShowDiscardConfirm={inviteFlow.setShowDiscardConfirm}
              closeInviteModal={inviteFlow.closeInviteModal}
            />
          );
        }

        if (activeSection.value === 'sharing') {
          return (
            <SharingPreferencesSection
              isSelfUser={isSelfUser}
              sharingEnabled={sharingEnabled}
              sharingAutoSaveIsSaving={sharingAutoSave.isSaving}
              isSharingUpdating={isSharingUpdating}
              onSharingToggle={handleSharingToggle}
              lines={lines}
              lineConsentById={lineConsentById}
              sharingTierLabels={SHARING_TIER_LABELS}
              sharingTierFeatures={SHARING_TIER_FEATURES}
              sharingCooldownMs={SHARING_COOLDOWN_MS}
              sharingRequestLineId={sharingRequestLineId}
              isAnyLineRequestPending={isLineRequestPending}
              onSharingRePrompt={handleSharingRePrompt}
              formatShortDate={formatDate}
              onUpgradeRequest={() => setUpgradeConfirmOpen(true)}
            />
          );
        }

        return null;

      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-col gap-6 pb-24">
      <div className="flex flex-col gap-6">
        <PrivacyStateBanner
          isPrivacySettingsUnavailable={isPrivacySettingsUnavailable}
          showSavingState={showSavingState}
          isSaving={isAnySaveInProgress}
          onRetry={() => router.refresh()}
        />

        <NavigationMenu
          bordered
          scrollable
          ariaLabel="Privacy center navigation tabs"
        >
          {privacyTabs.map((tab) => (
            <NavigationItem
              key={tab.value}
              active={tab.value === activeTab.value}
              scroll={false}
              link={{
                path: getDefaultTabUrl(tab.value),
                label: tab.label,
              }}
            />
          ))}
        </NavigationMenu>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {sectionsForTab.length > 0 ? (
            <PrivacySidebarNav
              tab={activeTab.value}
              sections={sectionsForTab}
              activeSection={activeSection || sectionsForTab[0]}
            />
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {activeContent}
          </div>
        </div>
      </div>

      <PrivacyDialogs
        reinviteDialogOpen={inviteFlow.reinviteDialogOpen}
        onReinviteDialogOpenChange={inviteFlow.setReinviteDialogOpen}
        onConfirmReinvite={inviteFlow.confirmReinvite}
        deleteDialogOpen={deleteDialogOpen}
        onDeleteDialogOpenChange={setDeleteDialogOpen}
        onConfirmDeleteData={handleDataDeletion}
        upgradeConfirmOpen={upgradeConfirmOpen}
        onUpgradeConfirmOpenChange={setUpgradeConfirmOpen}
        onConfirmUpgrade={handleUpgrade}
        retentionConfirmOpen={retentionConfirmOpen}
        onRetentionConfirmOpenChange={setRetentionConfirmOpen}
        onConfirmRetentionChange={confirmRetentionChange}
      />
    </div>
  );
}

function PrivacySidebarNav({
  tab,
  sections,
  activeSection,
}: {
  tab: PrivacyTabValue;
  sections: PrivacySectionConfig[];
  activeSection: PrivacySectionConfig;
}) {
  const links = sections.map((section) => ({
    path: buildPrivacyUrl(tab, section.value),
    label: section.label,
  }));

  return (
    <>
      <div className="hidden min-w-[12rem] lg:flex">
        <nav className="w-full" aria-label="Privacy section navigation">
          <ul className="flex flex-col space-y-1.5">
            {sections.map((section) => {
              const isActive = section.value === activeSection.value;
              const Icon = section.icon;

              return (
                <li key={section.value}>
                  <Link
                    href={buildPrivacyUrl(tab, section.value)}
                    scroll={false}
                    className={classNames(
                      'group flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-primary',
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon
                      className={classNames(
                        'h-4 w-4',
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-primary',
                      )}
                    />
                    <span>{section.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="block w-full lg:hidden">
        <MobileNavigationDropdown
          links={links}
          currentLabel={activeSection.label}
          ariaLabel="Select privacy section"
        />
      </div>
    </>
  );
}
