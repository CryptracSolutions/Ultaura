'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Archive,
  ClipboardList,
  Download,
  Info,
  LayoutDashboard,
  Mic,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import classNames from 'clsx';

import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import { Switch } from '~/core/ui/Switch';
import { Checkbox } from '~/core/ui/Checkbox';
import TextField from '~/core/ui/TextField';
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from '~/core/ui/RadioGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '~/core/ui/Accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/core/ui/Table';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
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
import { updateAccountSharing, upgradeSelfToFamilyMode } from '~/lib/ultaura/accounts';
import {
  getDataExportRequests,
  requestAccountDataDeletion,
  requestDataExport,
  requestRecordingReenable,
  requestSharingRePrompt,
  updatePrivacySettings,
} from '~/lib/ultaura/privacy';
import {
  inviteNotificationRecipient,
  removeNotificationRecipient,
} from '~/lib/ultaura/notification-recipients';
import { InvitedFamilyList } from './components/InvitedFamilyList';
import { TELEPHONY } from '~/lib/ultaura/constants';

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

const DEFAULT_RETENTION: RetentionPeriod = '90_days';

const SHARING_TIER_LABELS: Record<string, string> = {
  tier_1: 'Basic Updates & Safety',
  tier_2: 'Wellness Check',
  tier_3: 'Full Summary',
  tier_4: 'Complete Visibility',
};

const AUDIT_PAGE_SIZE = 10;

type PrivacyTabValue = 'overview' | 'consent' | 'data' | 'family';
type PrivacySectionValue =
  | 'vendor'
  | 'summary'
  | 'consent-status'
  | 'privacy-controls'
  | 'retention'
  | 'export'
  | 'delete'
  | 'audit'
  | 'recipients'
  | 'sharing';

type PrivacySectionConfig = {
  value: PrivacySectionValue;
  label: string;
  icon: LucideIcon;
};

const PRIVACY_TABS: Array<{ value: PrivacyTabValue; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'consent', label: 'Consent & Recording' },
  { value: 'data', label: 'Data Management' },
  { value: 'family', label: 'Family Sharing' },
];

const PRIVACY_SECTIONS: Record<PrivacyTabValue, PrivacySectionConfig[]> = {
  overview: [
    { value: 'vendor', label: 'Vendor Information', icon: Info },
    { value: 'summary', label: 'Quick Settings Summary', icon: LayoutDashboard },
  ],
  consent: [
    { value: 'consent-status', label: 'Consent Status', icon: Mic },
    { value: 'privacy-controls', label: 'Privacy Controls', icon: ShieldCheck },
  ],
  data: [
    { value: 'retention', label: 'Data Retention', icon: Archive },
    { value: 'export', label: 'Export Data', icon: Download },
    { value: 'delete', label: 'Delete Privacy Data', icon: Trash2 },
    { value: 'audit', label: 'Audit Log', icon: ClipboardList },
  ],
  family: [
    { value: 'recipients', label: 'Family Recipients', icon: Users },
    { value: 'sharing', label: 'Sharing Preferences', icon: Share2 },
  ],
};

function buildPrivacyUrl(tab: PrivacyTabValue, section?: PrivacySectionValue) {
  const params = new URLSearchParams();
  params.set('tab', tab);
  if (section) {
    params.set('section', section);
  }
  return `/dashboard/privacy?${params.toString()}`;
}

function formatShortDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
  const [recordingEnabled, setRecordingEnabled] = useState(
    privacySettings?.recordingEnabled ?? false
  );
  const [aiSummarizationEnabled, setAiSummarizationEnabled] = useState(
    privacySettings?.aiSummarizationEnabled ?? true
  );
  const [retentionPeriod, setRetentionPeriod] = useState<RetentionPeriod>(
    privacySettings?.retentionPeriod ?? DEFAULT_RETENTION
  );

  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [includeMemories, setIncludeMemories] = useState(true);
  const [includeCallMetadata, setIncludeCallMetadata] = useState(true);
  const [includeReminders, setIncludeReminders] = useState(true);
  const [exports, setExports] = useState<DataExportRequest[]>(exportRequests);
  const [recipients, setRecipients] = useState<NotificationRecipient[]>(
    notificationRecipients
  );

  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSharingUpdating, setIsSharingUpdating] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(account.sharing_enabled ?? true);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRelationship, setInviteRelationship] = useState('');
  const [inviteAsTrusted, setInviteAsTrusted] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [reinviteDialogOpen, setReinviteDialogOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<{
    name: string;
    email: string;
    phoneE164?: string;
    relationship?: string;
    addAsTrustedContact: boolean;
  } | null>(null);
  const [recordingRequestLineId, setRecordingRequestLineId] = useState<string | null>(null);
  const [sharingRequestLineId, setSharingRequestLineId] = useState<string | null>(null);
  const [auditConsentFilter, setAuditConsentFilter] = useState<string>('all');
  const [auditActorFilter, setAuditActorFilter] = useState<'all' | ConsentAuditEntry['actorType']>('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  const lineCount = lines.length;
  const exportInProgress = exports.some(
    (request) => request.status === 'pending' || request.status === 'processing'
  );
  const lineConsentById = useMemo(
    () => new Map(lineVoiceConsents.map((consent) => [consent.lineId, consent])),
    [lineVoiceConsents]
  );
  const isSelfUser = account.user_type === 'self';
  const canManageRecipients =
    account.user_type === 'family_managed' || (isSelfUser && sharingEnabled);
  const showFamilyTab = canManageRecipients;
  const privacyTabs = showFamilyTab
    ? PRIVACY_TABS
    : PRIVACY_TABS.filter((tab) => tab.value !== 'family');
  const tabParam = searchParams.get('tab') as PrivacyTabValue | null;
  const activeTab =
    privacyTabs.find((tab) => tab.value === tabParam) ?? privacyTabs[0];
  const sectionParam = searchParams.get('section') as PrivacySectionValue | null;
  const sectionsForTab = PRIVACY_SECTIONS[activeTab.value];
  const activeSection =
    sectionsForTab.find((section) => section.value === sectionParam) ??
    sectionsForTab[0];
  const retentionOption = useMemo(() => {
    return RETENTION_OPTIONS.find((option) => option.value === retentionPeriod);
  }, [retentionPeriod]);
  const retentionDescription = retentionOption?.description ?? '';
  const retentionLabel = retentionOption?.label ?? 'Not set';
  const consentSummary = useMemo(() => {
    const recordingSet = lineVoiceConsents.filter(
      (consent) => consent.recordingConsent !== 'pending'
    ).length;
    const sharingSet = lineVoiceConsents.filter(
      (consent) => consent.sharingConsent !== 'pending'
    ).length;

    return {
      recordingSet,
      sharingSet,
    };
  }, [lineVoiceConsents]);
  const confirmedRecipients = useMemo(() => {
    return recipients.filter((recipient) => recipient.confirmedAt).length;
  }, [recipients]);
  const showSharingSummary =
    account.user_type === 'family_managed' || sharingEnabled;

  const consentTypeOptions = useMemo(() => {
    const types = new Set(
      auditLog.map((entry) => entry.consentType).filter((value): value is string => !!value)
    );
    return Array.from(types);
  }, [auditLog]);

  const actorTypeOptions = useMemo(() => {
    const types = new Set(auditLog.map((entry) => entry.actorType));
    return Array.from(types);
  }, [auditLog]);

  const filteredAuditLog = useMemo(() => {
    const searchValue = auditSearch.trim().toLowerCase();

    return auditLog.filter((entry) => {
      if (auditConsentFilter !== 'all' && entry.consentType !== auditConsentFilter) {
        return false;
      }
      if (auditActorFilter !== 'all' && entry.actorType !== auditActorFilter) {
        return false;
      }
      if (!searchValue) {
        return true;
      }

      const haystack = [
        entry.action,
        entry.consentType ?? '',
        entry.actorType,
        entry.lineId ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(searchValue);
    });
  }, [auditActorFilter, auditConsentFilter, auditLog, auditSearch]);

  const auditTotalPages = Math.max(
    1,
    Math.ceil(filteredAuditLog.length / AUDIT_PAGE_SIZE)
  );
  const auditPageSafe = Math.min(auditPage, auditTotalPages);
  const auditStartIndex =
    filteredAuditLog.length === 0
      ? 0
      : (auditPageSafe - 1) * AUDIT_PAGE_SIZE + 1;
  const auditEndIndex = Math.min(
    auditPageSafe * AUDIT_PAGE_SIZE,
    filteredAuditLog.length
  );
  const pagedAuditLog = filteredAuditLog.slice(
    (auditPageSafe - 1) * AUDIT_PAGE_SIZE,
    auditPageSafe * AUDIT_PAGE_SIZE
  );

  useEffect(() => {
    setAuditPage(1);
  }, [auditActorFilter, auditConsentFilter, auditSearch]);

  useEffect(() => {
    if (auditPage > auditTotalPages) {
      setAuditPage(auditTotalPages);
    }
  }, [auditPage, auditTotalPages]);

  const handleRecordingToggle = async (checked: boolean) => {
    const previous = recordingEnabled;
    setRecordingEnabled(checked);
    setIsUpdating(true);
    try {
      const result = await updatePrivacySettings(account.id, {
        recordingEnabled: checked,
      });

      if (!result.success) {
        setRecordingEnabled(previous);
        toast.error(result.error || 'Failed to update recording setting');
      } else {
        toast.success(`Recording ${checked ? 'enabled' : 'disabled'}`);
      }
    } catch {
      setRecordingEnabled(previous);
      toast.error('Failed to update recording setting');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSummarizationToggle = async (checked: boolean) => {
    const previous = aiSummarizationEnabled;
    setAiSummarizationEnabled(checked);
    setIsUpdating(true);
    try {
      const result = await updatePrivacySettings(account.id, {
        aiSummarizationEnabled: checked,
      });

      if (!result.success) {
        setAiSummarizationEnabled(previous);
        toast.error(result.error || 'Failed to update AI summarization setting');
      } else {
        toast.success(`AI memory ${checked ? 'enabled' : 'disabled'}`);
      }
    } catch {
      setAiSummarizationEnabled(previous);
      toast.error('Failed to update AI summarization setting');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRetentionChange = async (value: RetentionPeriod) => {
    const previous = retentionPeriod;
    setRetentionPeriod(value);
    setIsUpdating(true);
    try {
      const result = await updatePrivacySettings(account.id, {
        retentionPeriod: value,
      });

      if (!result.success) {
        setRetentionPeriod(previous);
        toast.error(result.error || 'Failed to update retention period');
      } else {
        toast.success('Retention period updated');
      }
    } catch {
      setRetentionPeriod(previous);
      toast.error('Failed to update retention period');
    } finally {
      setIsUpdating(false);
    }
  };

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

      const refreshed = await getDataExportRequests(account.id);
      setExports(refreshed);
      toast.success('Export requested. We will prepare your file shortly.');
    } catch {
      toast.error('Failed to start export');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDataDeletion = async () => {
    const result = await requestAccountDataDeletion(account.id, 'user_request');
    if (!result.success) {
      toast.error(result.error || 'Failed to delete data');
      throw new Error(result.error || 'Deletion failed');
    }
    toast.success('Deletion requested. Privacy data will be removed shortly.');
  };

  const handleSharingToggle = async (nextEnabled: boolean) => {
    const previous = sharingEnabled;
    setSharingEnabled(nextEnabled);
    setIsSharingUpdating(true);
    try {
      const result = await updateAccountSharing(account.id, nextEnabled);
      if (!result.success) {
        setSharingEnabled(previous);
        toast.error(result.error.message || 'Failed to update sharing');
      } else {
        toast.success(nextEnabled ? 'Family sharing enabled' : 'Family sharing disabled');
        if (!nextEnabled && activeTab.value === 'family') {
          router.replace(buildPrivacyUrl('overview', PRIVACY_SECTIONS.overview[0].value), {
            scroll: false,
          });
        }
      }
    } catch {
      setSharingEnabled(previous);
      toast.error('Failed to update sharing');
    } finally {
      setIsSharingUpdating(false);
    }
  };

  const handleRecordingReenable = async (lineId: string) => {
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
      setRecordingRequestLineId(null);
    }
  };

  const handleSharingRePrompt = async (lineId: string) => {
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
      setSharingRequestLineId(null);
    }
  };

  const buildInvitePayload = (override?: {
    name?: string;
    email?: string;
    phoneE164?: string;
    relationship?: string;
    addAsTrustedContact?: boolean;
  }) => {
    const trimmedName = (override?.name ?? inviteName).trim();
    const trimmedEmail = (override?.email ?? inviteEmail).trim().toLowerCase();
    const trimmedPhone = invitePhone.trim();
    const trimmedRelationship = (override?.relationship ?? inviteRelationship).trim();
    const phoneE164 = override?.phoneE164 ?? (trimmedPhone ? formatToE164(trimmedPhone) : undefined);

    return {
      name: trimmedName,
      email: trimmedEmail,
      phoneE164,
      relationship: trimmedRelationship || undefined,
      addAsTrustedContact: override?.addAsTrustedContact ?? inviteAsTrusted,
    };
  };

  const handleInvite = async (
    allowReinvite = false,
    override?: {
      name?: string;
      email?: string;
      phoneE164?: string;
      relationship?: string;
      addAsTrustedContact?: boolean;
    }
  ) => {
    const payload = buildInvitePayload(override);

    if (!payload.name || !payload.email) {
      toast.error('Name and email are required');
      return;
    }

    if (payload.phoneE164 && !TELEPHONY.PHONE_REGEX.test(payload.phoneE164)) {
      toast.error('Enter a valid US phone number');
      return;
    }

    if (payload.addAsTrustedContact && !payload.phoneE164) {
      toast.error('Phone number is required for emergency contacts');
      return;
    }

    setIsInviting(true);

    try {
      const result = await inviteNotificationRecipient(account.id, {
        name: payload.name,
        email: payload.email,
        phoneE164: payload.phoneE164,
        relationship: payload.relationship,
        addAsTrustedContact: payload.addAsTrustedContact,
        allowReinvite,
      });

      if (!result.success) {
        const reason = result.error.details?.reason;
        if (reason === 'unsubscribed') {
          setPendingInvite(payload);
          setReinviteDialogOpen(true);
          return;
        }

        toast.error(result.error.message || 'Failed to send invite');
        return;
      }

      const nextRecipients = recipients.filter((item) => item.id !== result.data.id);
      setRecipients([result.data, ...nextRecipients]);
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      setInviteRelationship('');
      setInviteAsTrusted(false);
      toast.success('Invite sent');
    } catch {
      toast.error('Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleConfirmReinvite = async () => {
    if (!pendingInvite) return;
    setReinviteDialogOpen(false);
    await handleInvite(true, pendingInvite);
    setPendingInvite(null);
  };

  const handleRemoveRecipient = async (recipientId: string) => {
    try {
      const result = await removeNotificationRecipient(recipientId);
      if (!result.success) {
        toast.error(result.error.message || 'Failed to remove recipient');
        return;
      }
      setRecipients((prev) => prev.filter((recipient) => recipient.id !== recipientId));
      toast.success('Recipient removed');
    } catch {
      toast.error('Failed to remove recipient');
    }
  };

  const handleUpgrade = async () => {
    setIsSharingUpdating(true);
    try {
      const result = await upgradeSelfToFamilyMode(account.id);
      if (!result.success) {
        toast.error(result.error.message || 'Failed to upgrade');
      } else {
        toast.success('Upgraded to family mode');
        router.refresh();
      }
    } catch {
      toast.error('Failed to upgrade');
    } finally {
      setIsSharingUpdating(false);
    }
  };

  const activeContent = (() => {
    switch (activeTab.value) {
      case 'overview': {
        if (activeSection.value === 'vendor') {
          return (
            <Alert type="info">
              <Alert.Heading>Vendor disclosure</Alert.Heading>
              <p>
                Ultaura uses xAI and Twilio to power voice conversations. Audio is processed in
                real-time by these services.{' '}
                <a
                  href="/privacy"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Learn more in our Privacy Policy
                </a>
                .
              </p>
            </Alert>
          );
        }

        return (
          <>
            <Section>
              <SectionHeader
                title={
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    Quick Settings Summary
                  </div>
                }
                description="Snapshot of consent, sharing, and data settings."
              />
              <SectionBody className="gap-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Consent status
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Recording consent set</span>
                        <span className="font-medium text-foreground">
                          {lineCount === 0
                            ? 'No lines'
                            : `${consentSummary.recordingSet}/${lineCount}`}
                        </span>
                      </div>
                      {showSharingSummary ? (
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Sharing preferences set</span>
                          <span className="font-medium text-foreground">
                            {lineCount === 0
                              ? 'No lines'
                              : `${consentSummary.sharingSet}/${lineCount}`}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Active privacy settings
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Call recording</span>
                        <span
                          className={recordingEnabled ? 'text-success font-medium' : 'text-muted-foreground'}
                        >
                          {recordingEnabled ? 'On' : 'Off'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">AI memory</span>
                        <span
                          className={aiSummarizationEnabled ? 'text-success font-medium' : 'text-muted-foreground'}
                        >
                          {aiSummarizationEnabled ? 'On' : 'Off'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Family sharing</span>
                        <span
                          className={sharingEnabled ? 'text-success font-medium' : 'text-muted-foreground'}
                        >
                          {sharingEnabled ? 'On' : 'Off'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Data retention
                    </div>
                    <div className="mt-3 text-lg font-semibold text-foreground">
                      {retentionLabel}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{retentionDescription}</p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Family recipients
                    </div>
                    <div className="mt-3 text-lg font-semibold text-foreground">
                      {confirmedRecipients}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Confirmed · {recipients.length} total invites
                    </p>
                  </div>
                </div>
              </SectionBody>
            </Section>

            {isSelfUser && !sharingEnabled ? (
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Family Sharing
                    </div>
                  }
                  description="Enable sharing to invite family members and send updates."
                />
                <SectionBody className="gap-4">
                  <p className="text-sm text-muted-foreground">
                    When enabled, you can invite family members to receive weekly summaries and
                    wellness alerts. Only data after you enable sharing will be shared.
                  </p>
                  <Button onClick={() => handleSharingToggle(true)} disabled={isSharingUpdating}>
                    Enable family sharing
                  </Button>
                </SectionBody>
              </Section>
            ) : null}
          </>
        );
      }
      case 'consent': {
        if (activeSection.value === 'consent-status') {
          return (
            <Section>
              <SectionHeader
                title={
                  <div className="flex items-center gap-2">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    Consent Status
                  </div>
                }
                description="Review recording and family sharing preferences for each line."
              />
              <SectionBody className="gap-4">
                {lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Add a line to view consent status.
                  </p>
                ) : (
                  lines.map((line) => {
                    const consent = lineConsentById.get(line.id);
                    const recordingConsent = consent?.recordingConsent ?? 'pending';
                    const recordingPreferencePermanent =
                      consent?.recordingPreferencePermanent ?? false;
                    const recordingReenableRequestedAt =
                      consent?.recordingReenableRequestedAt ?? null;
                    const recordingConsentAt = formatShortDate(consent?.recordingConsentAt);
                    const recordingStatus =
                      recordingConsent === 'granted'
                        ? 'Approved'
                        : recordingConsent === 'denied'
                          ? recordingPreferencePermanent
                            ? `Declined by ${line.display_name}`
                            : 'Ask each call'
                          : 'Awaiting consent';
                    const recordingNote = recordingReenableRequestedAt
                      ? `Re-enable requested on ${
                          formatShortDate(recordingReenableRequestedAt) ?? 'recently'
                        }`
                      : recordingConsentAt
                        ? `Set on ${recordingConsentAt}`
                        : null;
                    const canRequestRecording =
                      recordingConsent === 'denied' && recordingPreferencePermanent;

                    const sharingConsent = consent?.sharingConsent ?? 'pending';
                    const sharingTier = consent?.sharingTier ?? 'tier_1';
                    const sharingConsentAt = formatShortDate(consent?.sharingConsentAt);
                    const sharingRePromptRequestedAt =
                      consent?.sharingRePromptRequestedAt ?? null;
                    const sharingStatus =
                      sharingConsent === 'granted'
                        ? SHARING_TIER_LABELS[sharingTier]
                        : sharingConsent === 'denied'
                          ? `${SHARING_TIER_LABELS.tier_1} (declined)`
                          : 'Awaiting preference';
                    const sharingNote = sharingRePromptRequestedAt
                      ? `Change requested on ${
                          formatShortDate(sharingRePromptRequestedAt) ?? 'recently'
                        }`
                      : sharingConsentAt
                        ? `Set by ${line.display_name} on ${sharingConsentAt}`
                        : null;
                    const canRequestSharing =
                      account.user_type === 'family_managed' && sharingConsent !== 'pending';

                    return (
                      <div
                        key={line.id}
                        className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {line.display_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {line.phone_e164}
                            </div>
                          </div>
                        </div>

                        <div
                          className={`grid gap-4 ${
                            account.user_type === 'family_managed' ? 'md:grid-cols-2' : ''
                          }`}
                        >
                          <div>
                            <div className="text-xs text-muted-foreground">Recording</div>
                            <div className="text-sm text-foreground">{recordingStatus}</div>
                            {recordingNote ? (
                              <div className="text-xs text-muted-foreground mt-1">
                                {recordingNote}
                              </div>
                            ) : null}
                          </div>
                          {account.user_type === 'family_managed' ? (
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Family Sharing Level
                              </div>
                              <div className="text-sm text-foreground">{sharingStatus}</div>
                              {sharingNote ? (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {sharingNote}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {canRequestRecording ? (
                            <Button
                              variant="outline"
                              onClick={() => handleRecordingReenable(line.id)}
                              disabled={
                                recordingReenableRequestedAt !== null ||
                                recordingRequestLineId === line.id
                              }
                            >
                              {recordingReenableRequestedAt
                                ? 'Re-enable requested'
                                : 'Re-enable recording'}
                            </Button>
                          ) : null}
                          {canRequestSharing ? (
                            <Button
                              variant="outline"
                              onClick={() => handleSharingRePrompt(line.id)}
                              disabled={
                                sharingRePromptRequestedAt !== null ||
                                sharingRequestLineId === line.id
                              }
                            >
                              {sharingRePromptRequestedAt
                                ? 'Change requested'
                                : 'Request change'}
                            </Button>
                          ) : null}
                        </div>

                        {account.user_type === 'family_managed' ? (
                          <div className="text-xs text-muted-foreground">
                            {line.display_name} controls sharing preferences during calls.
                            Requesting a change will prompt them on the next call.
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </SectionBody>
            </Section>
          );
        }

        return (
          <Section>
            <SectionHeader
              title={
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  Privacy controls
                </div>
              }
              description="Manage recording and AI memory settings for this account."
            />
            <SectionBody className="gap-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    Call recording
                  </p>
                  <p className="text-sm text-muted-foreground">
                    When enabled, calls may be recorded. Disclosure is always announced at call
                    start.
                  </p>
                </div>
                <Switch
                  checked={recordingEnabled}
                  onCheckedChange={handleRecordingToggle}
                  disabled={isUpdating}
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    AI memory & personalization
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Controls memory storage, retrieval, and post-call summaries across all lines.
                  </p>
                </div>
                <Switch
                  checked={aiSummarizationEnabled}
                  onCheckedChange={handleSummarizationToggle}
                  disabled={isUpdating}
                />
              </div>
            </SectionBody>
          </Section>
        );
      }
      case 'data': {
        if (activeSection.value === 'retention') {
          return (
            <Section>
              <SectionHeader
                title={
                  <div className="flex items-center gap-2">
                    <Archive className="h-4 w-4 text-muted-foreground" />
                    Data retention
                  </div>
                }
                description="Retention applies to memories, call insights, and recordings."
              />
              <SectionBody className="gap-6">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Current retention
                  </div>
                  <div className="mt-3 text-lg font-semibold text-foreground">
                    {retentionLabel}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {retentionDescription}
                  </p>
                </div>

                <Accordion>
                  <AccordionItem value="retention-advanced">
                    <AccordionTrigger>Advanced retention settings</AccordionTrigger>
                    <AccordionContent>
                      <RadioGroup
                        value={retentionPeriod}
                        onValueChange={(value) => handleRetentionChange(value as RetentionPeriod)}
                        className="gap-3"
                        disabled={isUpdating}
                      >
                        {RETENTION_OPTIONS.map((option) => (
                          <RadioGroupItemLabel key={option.value}>
                            <RadioGroupItem value={option.value} />
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {option.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {option.description}
                              </p>
                            </div>
                          </RadioGroupItemLabel>
                        ))}
                      </RadioGroup>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </SectionBody>
            </Section>
          );
        }

        if (activeSection.value === 'export') {
          return (
            <Section>
              <SectionHeader
                title={
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    Export data
                  </div>
                }
                description="Generate a downloadable export of your account data."
              />
              <SectionBody className="gap-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Format</p>
                    <Select
                      value={exportFormat}
                      onValueChange={(value) => setExportFormat(value as 'json' | 'csv')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="csv">CSV (ZIP bundle)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <Button onClick={handleExportRequest} disabled={isExporting || exportInProgress}>
                    {isExporting
                      ? 'Requesting...'
                      : exportInProgress
                        ? 'Export in progress'
                        : 'Request export'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Exports are available for 48 hours and include {lineCount} line
                    {lineCount === 1 ? '' : 's'}.
                  </p>
                </div>

                <Accordion>
                  <AccordionItem value="export-advanced">
                    <AccordionTrigger>Advanced export options</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Choose which datasets to include in the export bundle.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Checkbox
                            checked={includeMemories}
                            onCheckedChange={(checked) =>
                              setIncludeMemories(Boolean(checked))
                            }
                          />
                          Memories
                        </label>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Checkbox
                            checked={includeCallMetadata}
                            onCheckedChange={(checked) =>
                              setIncludeCallMetadata(Boolean(checked))
                            }
                          />
                          Call metadata
                        </label>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Checkbox
                            checked={includeReminders}
                            onCheckedChange={(checked) =>
                              setIncludeReminders(Boolean(checked))
                            }
                          />
                          Reminders
                        </label>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {exports.length > 0 ? (
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Requested</TableHead>
                          <TableHead>Format</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead className="text-right">Download</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exports.map((request) => {
                          const statusLabel = formatStatusLabel(request.status);
                          const statusColor = statusToColor(request.status);
                          const isReady =
                            request.status === 'ready' && request.downloadUrl;
                          return (
                            <TableRow key={request.id}>
                              <TableCell>{formatDate(request.createdAt)}</TableCell>
                              <TableCell className="uppercase text-xs text-muted-foreground">
                                {request.format}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}
                                >
                                  {statusLabel}
                                </span>
                              </TableCell>
                              <TableCell>
                                {request.expiresAt ? formatDate(request.expiresAt) : '--'}
                              </TableCell>
                              <TableCell className="text-right">
                                {isReady ? (
                                  <a
                                    href={request.downloadUrl || '#'}
                                    className="text-primary hover:underline text-sm"
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Download
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">--</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No export requests yet.</p>
                )}
              </SectionBody>
            </Section>
          );
        }

        if (activeSection.value === 'delete') {
          return (
            <Section>
              <SectionHeader
                title={
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                    Delete privacy data
                  </div>
                }
                description="Remove memories, call insights, and recordings for this account."
              />
              <SectionBody className="gap-4">
                <p className="text-sm text-muted-foreground">
                  Permanently delete AI-generated memories, call insights, and recorded audio.
                </p>
                <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                  Delete privacy data
                </Button>

                <Accordion>
                  <AccordionItem value="delete-advanced">
                    <AccordionTrigger>Advanced deletion details</AccordionTrigger>
                    <AccordionContent>
                      This will permanently delete AI-generated memories, call insights, and any
                      recorded audio. Call session metadata and user-created reminders are
                      preserved.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </SectionBody>
            </Section>
          );
        }

        if (activeSection.value === 'audit') {
          return (
            <Section>
              <SectionHeader
                title={
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    Consent audit log
                  </div>
                }
                description="Track changes to consent and privacy settings."
              />
              <SectionBody className="gap-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Consent type</p>
                    <Select
                      value={auditConsentFilter}
                      onValueChange={(value) => setAuditConsentFilter(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {consentTypeOptions.map((type) => (
                          <SelectItem key={type} value={type}>
                            {formatAction(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Actor</p>
                    <Select
                      value={auditActorFilter}
                      onValueChange={(value) =>
                        setAuditActorFilter(value as ConsentAuditEntry['actorType'] | 'all')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All actors" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All actors</SelectItem>
                        {actorTypeOptions.map((type) => (
                          <SelectItem key={type} value={type}>
                            {formatActor(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <TextField>
                    <TextField.Label>
                      Search
                      <TextField.Input
                        value={auditSearch}
                        onChange={(event) => setAuditSearch(event.target.value)}
                        placeholder="Search actions or consent types"
                      />
                    </TextField.Label>
                  </TextField>
                </div>

                {filteredAuditLog.length > 0 ? (
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Consent</TableHead>
                          <TableHead>Actor</TableHead>
                          <TableHead>Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedAuditLog.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{formatDate(entry.createdAt)}</TableCell>
                            <TableCell>{formatAction(entry.action)}</TableCell>
                            <TableCell>{entry.consentType ?? '--'}</TableCell>
                            <TableCell>{formatActor(entry.actorType)}</TableCell>
                            <TableCell>
                              {entry.oldValue !== null || entry.newValue !== null
                                ? `${formatAuditValue(entry.oldValue)} -> ${formatAuditValue(entry.newValue)}`
                                : '--'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {auditLog.length === 0
                      ? 'No audit events yet.'
                      : 'No audit events match the current filters.'}
                  </p>
                )}

                {filteredAuditLog.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Showing {auditStartIndex}-{auditEndIndex} of {filteredAuditLog.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAuditPage(Math.max(1, auditPageSafe - 1))}
                        disabled={auditPageSafe <= 1}
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {auditPageSafe} of {auditTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAuditPage(Math.min(auditTotalPages, auditPageSafe + 1))}
                        disabled={auditPageSafe >= auditTotalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                ) : null}
              </SectionBody>
            </Section>
          );
        }

        return null;
      }
      case 'family': {
        if (activeSection.value === 'recipients') {
          return (
            <Section>
              <SectionHeader
                title={
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Family Recipients
                  </div>
                }
                description="Invite up to 5 family members to receive summaries and alerts."
              />
              <SectionBody className="gap-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField>
                    <TextField.Label>
                      Name
                      <TextField.Input
                        value={inviteName}
                        onChange={(event) => setInviteName(event.target.value)}
                        placeholder="e.g., Sarah Johnson"
                      />
                    </TextField.Label>
                  </TextField>
                  <TextField>
                    <TextField.Label>
                      Email
                      <TextField.Input
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="sarah@example.com"
                      />
                    </TextField.Label>
                  </TextField>
                  <TextField>
                    <TextField.Label>
                      Phone (optional)
                      <TextField.Input
                        type="tel"
                        value={invitePhone}
                        onChange={(event) => setInvitePhone(event.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </TextField.Label>
                  </TextField>
                  <TextField>
                    <TextField.Label>
                      Relationship (optional)
                      <TextField.Input
                        value={inviteRelationship}
                        onChange={(event) => setInviteRelationship(event.target.value)}
                        placeholder="e.g., Daughter"
                      />
                    </TextField.Label>
                  </TextField>
                </div>

                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={inviteAsTrusted}
                    onCheckedChange={(checked) => setInviteAsTrusted(Boolean(checked))}
                  />
                  Also add as emergency contact (requires phone number)
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={() => handleInvite(false)} disabled={isInviting}>
                    {isInviting ? 'Sending...' : 'Send invite'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {recipients.length}/5 recipients
                  </p>
                </div>

                <InvitedFamilyList
                  recipients={recipients}
                  onRemove={handleRemoveRecipient}
                  disabled={isInviting}
                />
              </SectionBody>
            </Section>
          );
        }

        if (activeSection.value === 'sharing') {
          return (
            <>
              <Section>
                <SectionHeader
                  title={
                    <div className="flex items-center gap-2">
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                      Sharing preferences
                    </div>
                  }
                  description="Control how family members receive updates."
                />
                <SectionBody className="gap-4">
                  {isSelfUser ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        When enabled, you can invite family members to receive weekly summaries and
                        wellness alerts.
                      </p>
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-sm text-muted-foreground">
                          {sharingEnabled ? 'Sharing is currently enabled.' : 'Sharing is currently disabled.'}
                        </div>
                        <Switch
                          checked={sharingEnabled}
                          onCheckedChange={handleSharingToggle}
                          disabled={isSharingUpdating}
                        />
                      </div>
                      {sharingEnabled ? (
                        <p className="text-xs text-muted-foreground">
                          Only data after sharing is enabled will be shared.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Sharing preferences are captured from call recipients during check-ins. Use
                      the Consent Status section to request changes.
                    </p>
                  )}
                </SectionBody>
              </Section>

              {isSelfUser && (
                <Section>
                  <SectionHeader
                    title="Upgrade to Family Mode"
                    description="Unlock family insights and additional lines."
                  />
                  <SectionBody className="gap-4">
                    <p className="text-sm text-muted-foreground">
                      Upgrading to family mode will:
                    </p>
                    <ul className="text-sm text-muted-foreground list-disc ml-4">
                      <li>Show the Insights page with conversation analytics</li>
                      <li>Show the Alerts page for wellness monitoring</li>
                      <li>Allow adding additional phone lines (if your plan supports it)</li>
                      <li>Enable inviting family members for notifications</li>
                    </ul>
                    <p className="text-sm text-muted-foreground">
                      Your existing settings and data will be preserved.
                    </p>
                    <Button onClick={handleUpgrade} disabled={isSharingUpdating}>
                      Upgrade to Family Mode
                    </Button>
                  </SectionBody>
                </Section>
              )}
            </>
          );
        }

        return null;
      }
      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-col gap-6 pb-24">
      <NavigationMenu bordered>
        {privacyTabs.map((tab) => (
          <NavigationItem
            key={tab.value}
            className={'flex-1 lg:flex-none'}
            active={tab.value === activeTab.value}
            scroll={false}
            link={{
              path: buildPrivacyUrl(tab.value, PRIVACY_SECTIONS[tab.value][0].value),
              label: tab.label,
            }}
          />
        ))}
      </NavigationMenu>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <PrivacySidebarNav
          tab={activeTab.value}
          sections={sectionsForTab}
          activeSection={activeSection}
        />
        <div className="flex w-full flex-col gap-6 lg:max-w-4xl">
          {activeContent}
        </div>
      </div>

      <ConfirmationDialog
        open={reinviteDialogOpen}
        onOpenChange={setReinviteDialogOpen}
        title="Re-invite this recipient?"
        description="They previously unsubscribed from updates. Re-inviting will send a new confirmation email."
        confirmLabel="Re-invite"
        onConfirm={handleConfirmReinvite}
      />

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete privacy data"
        description="This will permanently delete memories, call insights, and recordings for this account. This action cannot be undone."
        confirmLabel="Delete data"
        variant="destructive"
        onConfirm={handleDataDeletion}
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
        <nav className="w-full">
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
                        : 'text-muted-foreground hover:bg-muted hover:text-primary'
                    )}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon
                      className={classNames(
                        'h-4 w-4',
                        isActive
                          ? 'text-primary'
                          : 'text-muted-foreground group-hover:text-primary'
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
        <MobileNavigationDropdown links={links} currentLabel={activeSection.label} />
      </div>
    </>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '--';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAction(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatActor(value: ConsentAuditEntry['actorType']): string {
  switch (value) {
    case 'payer':
      return 'Account owner';
    case 'line_voice':
      return 'Call recipient';
    case 'system':
      return 'System';
    default:
      return value;
  }
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return '--';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function formatStatusLabel(status: DataExportRequest['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'ready':
      return 'Ready';
    case 'expired':
      return 'Expired';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

function statusToColor(status: DataExportRequest['status']): string {
  switch (status) {
    case 'ready':
      return 'bg-success/10 text-success';
    case 'failed':
      return 'bg-destructive/10 text-destructive';
    case 'expired':
      return 'bg-warning/10 text-warning';
    case 'processing':
    case 'pending':
      return 'bg-info/10 text-info';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function formatToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }

  return phone;
}
