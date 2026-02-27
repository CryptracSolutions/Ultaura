'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Archive,
  ClipboardList,
  Download,
  LayoutDashboard,
  Mic,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Info,
  Plus,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import classNames from 'clsx';

import { Switch } from '~/core/ui/Switch';
import { Checkbox } from '~/core/ui/Checkbox';
import TextField from '~/core/ui/TextField';
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from '~/core/ui/RadioGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '~/core/ui/Accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/core/ui/Table';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { useAutoSave } from '~/core/hooks/use-auto-save';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  gateDialogAutoFocus,
} from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';
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
import { formatToE164, getUsPhoneValidationError } from '~/lib/ultaura/phone';
import PhoneInput from '~/components/ultaura/PhoneInput';

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
  | 'summary'
  | 'consent-status'
  | 'privacy-controls'
  | 'retention'
  | 'export'
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
  overview: [],
  consent: [
    { value: 'consent-status', label: 'Consent Status', icon: Mic },
    { value: 'privacy-controls', label: 'Privacy Controls', icon: ShieldCheck },
  ],
  data: [
    { value: 'retention', label: 'Data Retention', icon: Archive },
    { value: 'export', label: 'Export Data', icon: Download },
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
  const initialRecordingEnabled = privacySettings?.recordingEnabled ?? false;
  const initialAiSummarizationEnabled =
    privacySettings?.aiSummarizationEnabled ?? true;
  const initialRetentionPeriod =
    privacySettings?.retentionPeriod ?? DEFAULT_RETENTION;
  const initialSharingEnabled = account.sharing_enabled ?? true;

  const [recordingEnabled, setRecordingEnabled] = useState(
    initialRecordingEnabled
  );
  const [aiSummarizationEnabled, setAiSummarizationEnabled] = useState(
    initialAiSummarizationEnabled
  );
  const [retentionPeriod, setRetentionPeriod] = useState<RetentionPeriod>(
    initialRetentionPeriod
  );

  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [includeMemories, setIncludeMemories] = useState(true);
  const [includeCallMetadata, setIncludeCallMetadata] = useState(true);
  const [includeReminders, setIncludeReminders] = useState(true);
  const [exports, setExports] = useState<DataExportRequest[]>(exportRequests);
  const [recipients, setRecipients] = useState<NotificationRecipient[]>(
    notificationRecipients
  );

  const [isExporting, setIsExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSharingUpdating, setIsSharingUpdating] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(initialSharingEnabled);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRelationship, setInviteRelationship] = useState('');
  const [inviteAsTrusted, setInviteAsTrusted] = useState(false);
  const [invitePhoneError, setInvitePhoneError] = useState<string | undefined>();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    setRecordingEnabled(initialRecordingEnabled);
    setAiSummarizationEnabled(initialAiSummarizationEnabled);
    setRetentionPeriod(initialRetentionPeriod);
    setSharingEnabled(initialSharingEnabled);
  }, [
    initialRecordingEnabled,
    initialAiSummarizationEnabled,
    initialRetentionPeriod,
    initialSharingEnabled,
  ]);

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

  const privacyAutoSave = useAutoSave<{
    recordingEnabled: boolean;
    aiSummarizationEnabled: boolean;
    retentionPeriod: RetentionPeriod;
  }>({
    saveFn: async (value) => {
      const result = await updatePrivacySettings(account.id, value);
      if (result.success) return { success: true };
      return { success: false, error: result.error || 'Failed to save' };
    },
    toastSuccess: 'Privacy settings saved',
    onSuccess: () => router.refresh(),
  });

  const sharingAutoSave = useAutoSave<{ sharingEnabled: boolean }>({
    saveFn: async (value) => {
      const result = await updateAccountSharing(account.id, value.sharingEnabled);
      if (result.success) return { success: true };
      return { success: false, error: result.error?.message || 'Failed to save' };
    },
    toastSuccess: 'Sharing updated',
    onSuccess: () => router.refresh(),
  });

  useEffect(() => {
    const handleBeforeUnload = () => {
      privacyAutoSave.flush();
      sharingAutoSave.flush();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [privacyAutoSave.flush, sharingAutoSave.flush]);

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

  const handleRecordingToggle = (checked: boolean) => {
    setRecordingEnabled(checked);
    privacyAutoSave.triggerSave({
      recordingEnabled: checked,
      aiSummarizationEnabled,
      retentionPeriod,
    });
  };

  const handleSummarizationToggle = (checked: boolean) => {
    setAiSummarizationEnabled(checked);
    privacyAutoSave.triggerSave({
      recordingEnabled,
      aiSummarizationEnabled: checked,
      retentionPeriod,
    });
  };

  const handleRetentionChange = (value: RetentionPeriod) => {
    setRetentionPeriod(value);
    privacyAutoSave.triggerSave({
      recordingEnabled,
      aiSummarizationEnabled,
      retentionPeriod: value,
    });
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

  const handleSharingToggle = (nextEnabled: boolean) => {
    setSharingEnabled(nextEnabled);
    sharingAutoSave.triggerSave({ sharingEnabled: nextEnabled });
    if (!nextEnabled && activeTab.value === 'family') {
      router.replace(buildPrivacyUrl('overview'), {
        scroll: false,
      });
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

  const resetInviteForm = useCallback(() => {
    setInviteName('');
    setInviteEmail('');
    setInvitePhone('');
    setInviteRelationship('');
    setInviteAsTrusted(false);
    setInviteError(null);
  }, []);

  const closeInviteModal = useCallback(() => {
    resetInviteForm();
    setShowInviteModal(false);
    setShowDiscardConfirm(false);
  }, [resetInviteForm]);

  const hasInviteChanges =
    inviteName.trim() !== '' ||
    inviteEmail.trim() !== '' ||
    invitePhone.trim() !== '' ||
    inviteRelationship.trim() !== '' ||
    inviteAsTrusted;

  const attemptCloseInvite = useCallback(() => {
    if (isInviting) {
      return;
    }
    if (hasInviteChanges) {
      setShowDiscardConfirm(true);
    } else {
      closeInviteModal();
    }
  }, [closeInviteModal, hasInviteChanges, isInviting]);

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
    setInviteError(null);
    setInvitePhoneError(undefined);
    const payload = buildInvitePayload(override);

    if (!payload.name || !payload.email) {
      setInviteError('Name and email are required');
      return;
    }

    const phoneValidationError = getUsPhoneValidationError(invitePhone, { required: inviteAsTrusted });
    if (phoneValidationError) {
      setInvitePhoneError(phoneValidationError);
      return;
    }

    if (payload.phoneE164 && !TELEPHONY.PHONE_REGEX.test(payload.phoneE164)) {
      setInviteError('Enter a valid US phone number');
      return;
    }

    if (payload.addAsTrustedContact && !payload.phoneE164) {
      setInviteError('Phone number is required for emergency contacts');
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

        setInviteError(result.error.message || 'Failed to send invite');
        return;
      }

      const nextRecipients = recipients.filter((item) => item.id !== result.data.id);
      setRecipients([result.data, ...nextRecipients]);
      closeInviteModal();
      toast.success('Invite sent');
    } catch {
      setInviteError('Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleInviteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await handleInvite(false);
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
        return (
          <>
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3.5">
              <Info className="h-[18px] w-[18px] text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-primary leading-snug">
                All data stays in your control. Ultaura stores call insights and memories
                securely. Recording and sharing consent is given by your loved one during
                their calls—not from this dashboard. You can export or delete all data at
                any time.{' '}
                <Link
                  href="/docs/privacy"
                  className="text-primary font-medium underline underline-offset-2 hover:no-underline"
                >
                  Learn more →
                </Link>
              </p>
            </div>

            <Section>
              <SectionHeader
                title={
                  <div className="flex items-center gap-2">
                    <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                    Summary
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
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => handleSharingToggle(true)}
                    disabled={sharingAutoSave.isSaving || isSharingUpdating}
                  >
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
                        {account.user_type === 'family_managed' ? (
                          <p className="text-xs text-muted-foreground">
                            {line.display_name} controls sharing preferences during calls.
                            Requesting a change will prompt them on the next call.
                          </p>
                        ) : null}

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

                        {(canRequestRecording || canRequestSharing) ? (
                          <div className="flex flex-wrap gap-3 pt-3">
                            {canRequestRecording ? (
                              <button
                                type="button"
                                onClick={() => handleRecordingReenable(line.id)}
                                disabled={
                                  recordingReenableRequestedAt !== null ||
                                  recordingRequestLineId === line.id
                                }
                                className={
                                  recordingReenableRequestedAt !== null ||
                                  recordingRequestLineId === line.id
                                    ? 'text-sm text-muted-foreground'
                                    : 'text-sm font-medium text-primary underline underline-offset-2 hover:opacity-80 transition-opacity'
                                }
                              >
                                {recordingReenableRequestedAt
                                  ? 'Re-enable requested'
                                  : 'Re-enable recording'}
                              </button>
                            ) : null}
                            {canRequestSharing ? (
                              <button
                                type="button"
                                onClick={() => handleSharingRePrompt(line.id)}
                                disabled={
                                  sharingRePromptRequestedAt !== null ||
                                  sharingRequestLineId === line.id
                                }
                                className={
                                  sharingRePromptRequestedAt !== null ||
                                  sharingRequestLineId === line.id
                                    ? 'text-sm text-muted-foreground'
                                    : 'text-sm font-medium text-primary underline underline-offset-2 hover:opacity-80 transition-opacity'
                                }
                              >
                                {sharingRePromptRequestedAt
                                  ? 'Requested'
                                  : 'Request Change'}
                              </button>
                            ) : null}
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
                  disabled={privacyAutoSave.isSaving}
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
                  disabled={privacyAutoSave.isSaving}
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
                        disabled={privacyAutoSave.isSaving}
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

                <div className="border-t border-border/60 pt-6">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                    Delete privacy data
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete AI-generated memories, call insights, and recorded audio.
                    Call session metadata and user-created reminders are preserved.
                  </p>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    Delete privacy data
                  </Button>
                </div>
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
                  <Button
                    type="button"
                    variant="default"
                    className="w-full sm:w-auto"
                    onClick={handleExportRequest}
                    disabled={isExporting || exportInProgress}
                    loading={isExporting}
                  >
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
                        type="button"
                        variant="outline"
                        onClick={() => setAuditPage(Math.max(1, auditPageSafe - 1))}
                        disabled={auditPageSafe <= 1}
                      >
                        Previous
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Page {auditPageSafe} of {auditTotalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
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
        const familyNote = (
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3.5">
            <Info className="h-[18px] w-[18px] text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-primary leading-snug">
              Family sharing lets you invite family members to receive weekly summaries and
              wellness alerts. What is shared follows your loved one&apos;s sharing preferences
              during calls.{' '}
              <Link
                href="/docs/insights-and-reports/sharing-with-family"
                className="text-primary font-medium underline underline-offset-2 hover:no-underline"
              >
                Learn more →
              </Link>
            </p>
          </div>
        );

        if (activeSection.value === 'recipients') {
          return (
            <>
              {familyNote}
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {recipients.length >= 5 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-block w-full sm:w-auto">
                            <Button
                              type="button"
                              variant="default"
                              className="w-full"
                              disabled
                            >
                              <Plus className="w-4 h-4" />
                              Invite Recipient
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Maximum 5 recipients reached</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        type="button"
                        variant="default"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setInviteError(null);
                          setShowInviteModal(true);
                        }}
                        disabled={isInviting}
                      >
                        <Plus className="w-4 h-4" />
                        Invite Recipient
                      </Button>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {recipients.length}/5 recipients
                    </p>
                  </div>

                  <InvitedFamilyList
                    recipients={recipients}
                    onRemove={handleRemoveRecipient}
                    disabled={isInviting}
                  />

                  <Dialog
                    open={showInviteModal}
                    onOpenChange={(open) => {
                      if (!open) {
                        if (isInviting) return;
                        attemptCloseInvite();
                      }
                    }}
                  >
                    <DialogContent
                      className="mobile-form-sheet sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
                      overlayClassName="bg-black/50 backdrop-blur-none"
                      onInteractOutside={(event) => {
                        if (isInviting || hasInviteChanges) {
                          event.preventDefault();
                          attemptCloseInvite();
                        }
                      }}
                      onEscapeKeyDown={(event) => {
                        if (isInviting || hasInviteChanges) {
                          event.preventDefault();
                          attemptCloseInvite();
                        }
                      }}
                      onOpenAutoFocus={(event) => {
                        gateDialogAutoFocus(event, () => {
                          event.preventDefault();
                          firstInputRef.current?.focus();
                        });
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <DialogTitle className="truncate">Invite family recipient</DialogTitle>
                          <DialogDescription className="text-sm text-muted-foreground">
                            This person will receive weekly summaries and wellness alerts.
                          </DialogDescription>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={attemptCloseInvite}
                          disabled={isInviting}
                          aria-label="Close"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>

                      {inviteError && (
                        <div
                          role="alert"
                          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        >
                          {inviteError}
                        </div>
                      )}

                      <form onSubmit={handleInviteSubmit} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextField>
                            <TextField.Label>
                              Name <span className="text-destructive">*</span>
                              <TextField.Input
                                ref={firstInputRef}
                                value={inviteName}
                                onChange={(event) => setInviteName(event.target.value)}
                                placeholder="e.g., Sarah Johnson"
                                required
                              />
                            </TextField.Label>
                          </TextField>
                          <TextField>
                            <TextField.Label>
                              Email <span className="text-destructive">*</span>
                              <TextField.Input
                                type="email"
                                value={inviteEmail}
                                onChange={(event) => setInviteEmail(event.target.value)}
                                placeholder="sarah@example.com"
                                required
                              />
                            </TextField.Label>
                          </TextField>
                          <TextField>
                            <TextField.Label>
                              Phone{' '}
                              {inviteAsTrusted ? (
                                <span className="text-destructive">*</span>
                              ) : (
                                '(optional)'
                              )}
                              <PhoneInput
                                value={invitePhone}
                                onValueChange={(value) => {
                                  setInvitePhone(value);
                                  if (invitePhoneError) {
                                    setInvitePhoneError(undefined);
                                  }
                                }}
                                onBlur={(event) => {
                                  setInvitePhoneError(
                                    getUsPhoneValidationError(event.target.value, { required: inviteAsTrusted }) ??
                                      undefined
                                  );
                                }}
                                placeholder="(555) 123-4567"
                                required={inviteAsTrusted}
                              />
                              <TextField.Error error={invitePhoneError} />
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

                        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={attemptCloseInvite}
                            disabled={isInviting}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="default"
                            className="w-full"
                            disabled={isInviting}
                            loading={isInviting}
                          >
                            {isInviting ? 'Sending' : 'Send invite'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <ConfirmationDialog
                    open={showDiscardConfirm}
                    onOpenChange={(open) => {
                      if (!open) setShowDiscardConfirm(false);
                    }}
                    title="Unsaved changes"
                    description="You have unsaved changes. Leave without saving?"
                    confirmLabel="Discard & leave"
                    cancelLabel="Stay here"
                    variant="default"
                    onConfirm={closeInviteModal}
                  />
                </SectionBody>
              </Section>
            </>
          );
        }

        if (activeSection.value === 'sharing') {
          return (
            <>
              {familyNote}
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
                          disabled={sharingAutoSave.isSaving || isSharingUpdating}
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
                      <Button
                        type="button"
                        variant="default"
                        onClick={handleUpgrade}
                        disabled={isSharingUpdating}
                        loading={isSharingUpdating}
                      >
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
      <div className="flex flex-col gap-6">
        <NavigationMenu bordered scrollable>
          {privacyTabs.map((tab) => (
            <NavigationItem
              key={tab.value}
              active={tab.value === activeTab.value}
              scroll={false}
              link={{
                path:
                  PRIVACY_SECTIONS[tab.value].length > 0
                    ? buildPrivacyUrl(tab.value, PRIVACY_SECTIONS[tab.value][0].value)
                    : buildPrivacyUrl(tab.value),
                label: tab.label,
              }}
            />
          ))}
        </NavigationMenu>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {sectionsForTab.length > 0 && (
            <PrivacySidebarNav
              tab={activeTab.value}
              sections={sectionsForTab}
              activeSection={activeSection}
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {activeContent}
          </div>
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
