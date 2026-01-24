'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Phone,
  Calendar,
  Settings,
  Play,
  Trash2,
  Edit2,
  CheckCircle,
  AlertTriangle,
  X,
  MessageCircle,
  Bell,
  ChevronRight,
  Gift,
  Users,
} from 'lucide-react';
import type {
  LineRow,
  UsageSummary,
  CallSessionRow,
  RetentionMetrics,
  CallPreview,
  StoryArc,
  SegmentStats,
} from '~/lib/ultaura/types';
import { updateLine, deleteLine } from '~/lib/ultaura/lines';
import { getCallSessionStatus, initiateTestCall } from '~/lib/ultaura/usage';
import type { ActionError } from '@ultaura/schemas';
import { formatTime, TELEPHONY } from '~/lib/ultaura/constants';
import { CallActivityList } from './components/CallActivityList';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from '~/core/ui/RadioGroup';
import Modal from '~/core/ui/Modal';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import {
  modalIconButtonClass,
  modalPrimaryButtonClass,
  modalSecondaryButtonClass,
} from '~/core/ui/modal-button-classes';

const MAX_INTEREST_TOPICS = 5;

const METRIC_CARD_CLASS = 'rounded-lg border border-border bg-muted/40 p-4';
const CARD_CLASS = 'bg-card rounded-xl border border-border p-6';
const CARD_HEADER_CLASS = 'flex items-center gap-2';
const BTN_PRIMARY_CLASS = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_OUTLINE_CLASS = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-input text-foreground hover:bg-muted transition-colors disabled:opacity-50';
const QUICK_LINK_CLASS = 'flex items-center justify-between p-4 rounded-lg border border-border bg-background hover:bg-muted transition-colors group';

interface MetricCardProps {
  label: string;
  value: string;
  large?: boolean;
}

function MetricCard({ label, value, large = false }: MetricCardProps): JSX.Element {
  return (
    <div className={METRIC_CARD_CLASS}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold text-foreground ${large ? 'text-lg' : 'text-sm'} capitalize`}>
        {value}
      </div>
    </div>
  );
}

interface QuickLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  count: number;
  zeroLabel: string;
  itemLabel: string;
}

function QuickLink({ href, icon, title, count, zeroLabel, itemLabel }: QuickLinkProps): JSX.Element {
  const description = count === 0
    ? zeroLabel
    : `${count} ${itemLabel}${count !== 1 ? 's' : ''}`;

  return (
    <Link href={href} className={QUICK_LINK_CLASS}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}

// Curated topics that tend to work well for 60+ conversation starters
const INTEREST_TOPIC_OPTIONS = [
  'Family',
  'Grandkids',
  'Friends',
  'Memories',
  'Hometown',
  'Holidays',
  'Cooking',
  'Baking',
  'Gardening',
  'Music',
  'Movies',
  'TV shows',
  'Reading',
  'Faith / spirituality',
  'Pets',
  'Sports',
  'Travel',
  'History',
  'Nature',
  'Games & puzzles',
  'Hobbies & crafts',
  'Community events',
];

interface LineDetailClientProps {
  line: LineRow;
  usage: UsageSummary | null;
  callSessions: CallSessionRow[];
  activeSchedulesCount: number;
  pendingRemindersCount: number;
  milestonesCount: number;
  trustedContactsCount: number;
  retentionMetrics: RetentionMetrics;
  previewHistory: CallPreview[];
  storyArcs: StoryArc[];
  segmentStats: SegmentStats;
  isReadOnly?: boolean;
  isTrialActive?: boolean;
}

export function LineDetailClient({
  line,
  usage,
  callSessions,
  activeSchedulesCount,
  pendingRemindersCount,
  milestonesCount,
  trustedContactsCount,
  retentionMetrics,
  previewHistory,
  storyArcs,
  segmentStats,
  isReadOnly = false,
  isTrialActive = false,
}: LineDetailClientProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isTestCalling, setIsTestCalling] = useState(false);
  const [isTestCallModalOpen, setIsTestCallModalOpen] = useState(false);
  const [testCallTarget, setTestCallTarget] = useState<'line' | 'alternate'>('line');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [alternatePhoneError, setAlternatePhoneError] = useState<string | null>(null);
  const [testCallError, setTestCallError] = useState<string | null>(null);
  const [testCallStatus, setTestCallStatus] = useState<'idle' | 'calling' | 'error'>('idle');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [testCallSessionId, setTestCallSessionId] = useState<string | null>(null);
  const [showVoicemailNotice, setShowVoicemailNotice] = useState(false);
  const [showCallFailedNotice, setShowCallFailedNotice] = useState(false);
  const [showTopicsModal, setShowTopicsModal] = useState(false);
  const [showTopicsDiscardConfirm, setShowTopicsDiscardConfirm] = useState(false);
  const [isSavingTopics, setIsSavingTopics] = useState(false);
  const [topicChips, setTopicChips] = useState<string[]>([]);
  const [topicCustom, setTopicCustom] = useState('');
  const [avoidTopicsText, setAvoidTopicsText] = useState('');
  const firstChipRef = useRef<HTMLButtonElement>(null);
  const [initialTopics, setInitialTopics] = useState<{
    chips: string[];
    custom: string;
    avoid: string;
  }>({
    chips: [],
    custom: '',
    avoid: '',
  });
  const [error, setError] = useState<string | null>(null);

  const normalizeTopic = (topic: string) => topic.trim();

  const parseTopics = (raw: string) =>
    raw
      .split(',')
      .map(normalizeTopic)
      .filter(Boolean);

  const dedupeTopics = (topics: string[]) => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const topic of topics) {
      const normalized = normalizeTopic(topic);
      if (!normalized) continue;

      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      result.push(normalized);
    }

    return result;
  };

  const normalizeTopicList = (topics: string[]) =>
    dedupeTopics(topics)
      .map((topic) => normalizeTopic(topic).toLowerCase())
      .sort()
      .join('|');

  const combinedTopics = dedupeTopics([...topicChips, ...parseTopics(topicCustom)]).slice(
    0,
    MAX_INTEREST_TOPICS,
  );

  const topicsSelectedCount = combinedTopics.length;
  const customDisabled = topicChips.length >= MAX_INTEREST_TOPICS;

  const formatPhone = (e164: string) => {
    const digits = e164.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return e164;
  };

  const resolveTestCallError = (error: ActionError): string => {
    const telephonyCode = error.details?.telephonyCode as string | undefined;
    const normalizedCode = (telephonyCode || '').toLowerCase();

    if (normalizedCode === 'do_not_call' || normalizedCode === 'line_opted_out') {
      return 'This line is opted out. Update DNC settings or choose a different number for the preview.';
    }

    if (normalizedCode === 'not_verified') {
      return 'This line is not verified yet. Verify the line or use a different number for the preview.';
    }

    if (normalizedCode === 'trial_expired') {
      return 'Your trial has ended. Subscribe to continue.';
    }

    if (normalizedCode === 'minutes_cap') {
      return 'Minutes cap reached. Update your plan to continue.';
    }

    if (normalizedCode === 'quiet_hours') {
      return 'Quiet hours are active. Try again later or use a different number for the preview.';
    }

    return error.message || 'Failed to initiate test call';
  };

  const formatToE164 = (phone: string): string => {
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
  };

  const favoriteSegments = Object.entries(segmentStats.byType)
    .filter(([, stats]) => stats.count > 0)
    .map(([type, stats]) => ({
      type: type.replace(/_/g, ' '),
      score: stats.enjoymentRate,
      count: stats.count,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.count - a.count;
    })
    .slice(0, 3)
    .map((entry) => entry.type);

  const preferredSegmentLabel = retentionMetrics.preferredSegmentType
    ? retentionMetrics.preferredSegmentType.replace(/_/g, ' ')
    : 'None yet';

  const formatPreviewDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  function getPreviewStatusLabel(preview: CallPreview): string {
    if (preview.followThroughResponse === 'engaged') return 'Engaged';
    if (preview.followThroughResponse === 'redirected') return 'Redirected';
    if (preview.status === 'declined') return 'Declined';
    if (preview.status === 'expired') return 'Expired';
    if (preview.status === 'used') return 'Used';
    return 'Pending';
  }

  function getStatusBadgeClass(status: string): string {
    if (status === 'active') return 'bg-success/10 text-success';
    if (status === 'paused') return 'bg-warning/10 text-warning';
    return 'bg-muted text-muted-foreground';
  }

  function getFeatureBadgeClass(enabled: boolean): string {
    return enabled
      ? 'bg-primary/10 text-primary'
      : 'bg-muted text-muted-foreground';
  }

  const handleDelete = async () => {
    if (isReadOnly) return;

    const result = await deleteLine(line.id);
    if (!result.success) {
      toast.error(result.error.message || 'Failed to delete line');
      throw new Error('Delete failed');
    }
    toast.success('Line deleted');
    router.push('/dashboard/lines');
  };

  const handleTestCall = async () => {
    if (isReadOnly) {
      setTestCallError('Your trial has ended. Subscribe to continue.');
      setTestCallStatus('error');
      setTestCallSessionId(null);
      return;
    }

    if (!isTrialActive && (!usage || (usage.minutesRemaining <= 0 && usage.minutesIncluded > 0))) {
      setTestCallError('No minutes remaining. Please upgrade your plan.');
      setTestCallStatus('error');
      setTestCallSessionId(null);
      return;
    }

    let targetPhoneNumber: string | undefined;

    if (testCallTarget === 'alternate') {
      const formatted = formatToE164(alternatePhone.trim());
      if (!TELEPHONY.PHONE_REGEX.test(formatted)) {
        setAlternatePhoneError('Enter a valid US phone number.');
        return;
      }
      targetPhoneNumber = formatted;
    }

    setAlternatePhoneError(null);
    setTestCallError(null);
    setTestCallStatus('idle');
    setShowVoicemailNotice(false);
    setShowCallFailedNotice(false);
    const shouldClearAlternate = testCallTarget === 'alternate';
    setIsTestCalling(true);
    setCooldownSeconds(30);
    setShowVoicemailNotice(false);
    setShowCallFailedNotice(false);
    try {
      const result = await initiateTestCall(line.id, {
        isPreviewMode: true,
        targetPhoneNumber,
        overrideQuietHours: true,
      });
      if (!result.success) {
        setTestCallError(resolveTestCallError(result.error));
        setTestCallStatus('error');
        setTestCallSessionId(null);
        return;
      }
      setTestCallStatus('calling');
      setTestCallSessionId(result.data.sessionId);
    } catch {
      setTestCallError('Failed to initiate test call');
      setTestCallStatus('error');
      setTestCallSessionId(null);
    } finally {
      setIsTestCalling(false);
      if (shouldClearAlternate) {
        setAlternatePhone('');
      }
    }
  };

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (!testCallSessionId) return;

    let isActive = true;
    let attempts = 0;
    const maxAttempts = 15; // ~2 minutes at 8s intervals

    const pollStatus = async () => {
      attempts += 1;
      const result = await getCallSessionStatus(line.id, testCallSessionId);
      if (!isActive || !result.success) {
        if (attempts >= maxAttempts) {
          setTestCallSessionId(null);
        }
        return;
      }

      const { status, endReason, answeredBy } = result.data;
      if (status === 'completed' || status === 'failed' || status === 'canceled') {
        const answeredByMachine = answeredBy?.startsWith('machine') ?? false;
        const shouldShowVoicemail = endReason === 'no_answer' || answeredByMachine;
        const shouldShowFailed = !shouldShowVoicemail && (
          status === 'failed' ||
          status === 'canceled' ||
          endReason === 'busy' ||
          endReason === 'error'
        );
        setShowVoicemailNotice(shouldShowVoicemail);
        setShowCallFailedNotice(shouldShowFailed);
        setTestCallSessionId(null);
        setTestCallStatus('idle');
      }
    };

    const interval = setInterval(pollStatus, 8000);
    pollStatus();

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [line.id, testCallSessionId]);

  const openTopicsModal = () => {
    if (isReadOnly) return;

    const interests = line.seed_interests ?? [];
    const avoid = line.seed_avoid_topics ?? [];

    const curatedSet = new Set(INTEREST_TOPIC_OPTIONS);
    const selected = interests.filter((t) => curatedSet.has(t));
    const custom = interests.filter((t) => !curatedSet.has(t));

    const initialState = {
      chips: dedupeTopics(selected).slice(0, MAX_INTEREST_TOPICS),
      custom: custom.join(', '),
      avoid: avoid.join(', '),
    };

    setInitialTopics(initialState);
    setTopicChips(initialState.chips);
    setTopicCustom(initialState.custom);
    setAvoidTopicsText(initialState.avoid);
    setShowTopicsModal(true);
    setError(null);
  };

  const closeTopicsModal = useCallback(() => {
    setTopicChips(initialTopics.chips);
    setTopicCustom(initialTopics.custom);
    setAvoidTopicsText(initialTopics.avoid);
    setError(null);
    setShowTopicsModal(false);
    setShowTopicsDiscardConfirm(false);
  }, [initialTopics.avoid, initialTopics.chips, initialTopics.custom]);

  const initialCombinedTopics = dedupeTopics([
    ...initialTopics.chips,
    ...parseTopics(initialTopics.custom),
  ]).slice(0, MAX_INTEREST_TOPICS);
  const hasTopicChanges =
    showTopicsModal &&
    (normalizeTopicList(combinedTopics) !== normalizeTopicList(initialCombinedTopics) ||
      normalizeTopicList(parseTopics(avoidTopicsText)) !==
        normalizeTopicList(parseTopics(initialTopics.avoid)));
  const attemptCloseTopics = useCallback(() => {
    if (isSavingTopics) {
      return;
    }
    if (hasTopicChanges) {
      setShowTopicsDiscardConfirm(true);
    } else {
      closeTopicsModal();
    }
  }, [closeTopicsModal, hasTopicChanges, isSavingTopics]);
  const confirmDiscardTopics = useCallback(() => {
    setShowTopicsDiscardConfirm(false);
    closeTopicsModal();
  }, [closeTopicsModal]);
  const cancelDiscardTopics = useCallback(() => {
    setShowTopicsDiscardConfirm(false);
  }, []);

  const toggleTopic = (topic: string) => {
    if (isReadOnly) return;

    setTopicChips((prev) => {
      const exists = prev.includes(topic);
      if (exists) return prev.filter((t) => t !== topic);
      if (combinedTopics.length >= MAX_INTEREST_TOPICS) return prev;
      return [...prev, topic];
    });
  };

  const saveTopics = async () => {
    if (isReadOnly) return;

    setIsSavingTopics(true);
    setError(null);

    const seedInterests = combinedTopics;
    const seedAvoidTopics = dedupeTopics(parseTopics(avoidTopicsText));

    try {
      const result = await updateLine(line.id, {
        seedInterests,
        seedAvoidTopics,
      });

      if (!result.success) {
        setError(result.error.message || 'Failed to update topics');
        return;
      }

      setShowTopicsModal(false);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSavingTopics(false);
    }
  };

  const handleTopicsSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    saveTopics();
  };

  return (
    <div className="w-full p-6 pb-12">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/lines"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lines
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
            <Phone className="w-4 h-4" />
            <span className="font-medium">{formatPhone(line.phone_e164)}</span>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-sm text-success">Verified</span>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-col gap-1">
              <button
                onClick={() => {
                  setIsTestCallModalOpen(true);
                  setTestCallError(null);
                  setAlternatePhoneError(null);
                }}
                disabled={isReadOnly}
                className={`${BTN_PRIMARY_CLASS} w-full sm:w-auto`}
              >
                <Play className="w-4 h-4" />
                Test Call
              </button>
              <p className="text-xs text-muted-foreground">
                Ultaura will call this line and give you the full experience.
              </p>
            </div>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isReadOnly}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Settings Card */}
      <div className={`${CARD_CLASS} mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className={CARD_HEADER_CLASS}>
            <Settings className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Line Settings</h2>
          </div>
          <Link
            href={`/dashboard/lines/${line.short_id}/settings`}
            className="text-sm text-primary hover:underline"
          >
            {isReadOnly ? 'View' : 'Edit'}
          </Link>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted-foreground">Timezone</dt>
            <dd className="text-foreground">{line.timezone}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Quiet Hours</dt>
            <dd className="text-foreground">
              {formatTime(line.quiet_hours_start)} - {formatTime(line.quiet_hours_end)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Status</dt>
            <dd>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(line.status)}`}>
                {line.status.charAt(0).toUpperCase() + line.status.slice(1)}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Conversation Topics Card */}
      <div className={`${CARD_CLASS} mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className={CARD_HEADER_CLASS}>
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Conversation topics</h2>
          </div>

          {!isReadOnly && (
            <button
              type="button"
              onClick={openTopicsModal}
              className="text-sm text-primary hover:underline inline-flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">Topics they enjoy</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {line.seed_interests?.length ? (
                line.seed_interests.map((topic) => (
                  <span key={topic} className="inline-flex items-center rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-xs text-primary">
                    {topic}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None yet</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Topics to avoid</div>
            <div className="mt-2 text-sm text-foreground">
              {line.seed_avoid_topics?.length ? line.seed_avoid_topics.join(', ') : 'None'}
            </div>
          </div>
        </div>

        <Dialog
          open={showTopicsModal}
          onOpenChange={(open) => {
            if (!open) {
              if (isSavingTopics) return;
              attemptCloseTopics();
            }
          }}
        >
          <DialogContent
            className="max-w-[468px]"
            overlayClassName="bg-black/50 backdrop-blur-none"
            onInteractOutside={(event) => {
              if (isSavingTopics || hasTopicChanges) {
                event.preventDefault();
                attemptCloseTopics();
              }
            }}
            onEscapeKeyDown={(event) => {
              if (isSavingTopics || hasTopicChanges) {
                event.preventDefault();
                attemptCloseTopics();
              }
            }}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              firstChipRef.current?.focus();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="truncate">Conversation topics</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Customize what Ultaura discusses during calls.
                </DialogDescription>
              </div>
              <button
                type="button"
                onClick={attemptCloseTopics}
                disabled={isSavingTopics}
                className={modalIconButtonClass}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleTopicsSubmit} className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-medium text-foreground">Topics they enjoy</div>
                  <div className="text-xs text-muted-foreground">
                    Selected: {topicsSelectedCount}/{MAX_INTEREST_TOPICS}
                  </div>
                </div>

                <div className="max-h-32 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_TOPIC_OPTIONS.map((topic, index) => {
                      const isSelected = topicChips.includes(topic);
                      const disabled =
                        isReadOnly || (!isSelected && combinedTopics.length >= MAX_INTEREST_TOPICS);

                      return (
                        <button
                          key={topic}
                          ref={index === 0 ? firstChipRef : undefined}
                          type="button"
                          onClick={() => toggleTopic(topic)}
                          disabled={disabled}
                          className={[
                            'rounded-full border px-3 py-1 text-sm transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-background text-foreground hover:bg-muted',
                            disabled ? 'opacity-50 cursor-not-allowed' : '',
                          ].join(' ')}
                        >
                          {topic}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Other topics (comma-separated)
                  </label>
                  <input
                    value={topicCustom}
                    onChange={(event) => setTopicCustom(event.target.value)}
                    placeholder="e.g., baseball, baking, church"
                    disabled={customDisabled || isReadOnly}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  />
                  {customDisabled ? (
                    <p className="text-xs text-muted-foreground">
                      Remove a selected topic to add a custom one.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll save up to {MAX_INTEREST_TOPICS} total topics.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">Topics to avoid</div>
                <textarea
                  value={avoidTopicsText}
                  onChange={(event) => setAvoidTopicsText(event.target.value)}
                  placeholder="e.g., politics, health issues..."
                  rows={2}
                  disabled={isReadOnly}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground">Separate topics with commas.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={attemptCloseTopics}
                  disabled={isSavingTopics}
                  className={modalSecondaryButtonClass}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTopics || isReadOnly}
                  className={modalPrimaryButtonClass}
                >
                  {isSavingTopics ? (
                    <>
                      <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving
                    </>
                  ) : (
                    'Save changes'
                  )}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Engagement Features Card */}
      <div className={`${CARD_CLASS} mb-6`}>
        <div className={`${CARD_HEADER_CLASS} mb-4`}>
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Engagement features</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard label="Preview follow-through" value={`${retentionMetrics.callPreviewFollowThrough}%`} large />
          <MetricCard label="Segment completion" value={`${retentionMetrics.segmentCompletionRate}%`} large />
          <MetricCard label="Preferred segment" value={preferredSegmentLabel} />
          <MetricCard
            label="Avg segment duration"
            value={retentionMetrics.averageSegmentDuration ? `${retentionMetrics.averageSegmentDuration}s` : 'N/A'}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Favorite segments</div>
            <div className="text-sm font-medium text-foreground mt-1 capitalize">
              {favoriteSegments.length ? favoriteSegments.join(', ') : 'None yet'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Features enabled</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['callPreview', 'segments', 'stories'] as const).map((feature) => (
                <span
                  key={feature}
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getFeatureBadgeClass(retentionMetrics.featureEnrollment[feature])}`}
                >
                  {feature === 'callPreview' ? 'Call preview' : feature.charAt(0).toUpperCase() + feature.slice(1)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-xs text-muted-foreground">Active story arcs</div>
          {storyArcs.length > 0 ? (
            <div className="mt-2 space-y-2">
              {storyArcs.map((arc) => (
                <div key={arc.id} className={`${METRIC_CARD_CLASS.replace('p-4', 'p-3')}`}>
                  <div className="text-sm font-medium text-foreground">{arc.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Chapter {arc.currentChapter}/{arc.totalChapters}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-1">No active stories</div>
          )}
        </div>
      </div>

      {/* Call Preview History */}
      <div className={`${CARD_CLASS} mb-6`}>
        <div className={`${CARD_HEADER_CLASS} mb-4`}>
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Call preview history</h2>
        </div>

        {previewHistory.length > 0 ? (
          <div className="divide-y divide-border">
            {previewHistory.map((preview) => (
              <div key={preview.id} className="flex items-center justify-between py-3 gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{preview.topicDisplay}</div>
                  <div className="text-xs text-muted-foreground">
                    {preview.topicType.replace(/_/g, ' ')} · {formatPreviewDate(preview.createdAt)}
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{getPreviewStatusLabel(preview)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No previews yet</div>
        )}
      </div>

      {/* Quick Links */}
      <div className={CARD_CLASS}>
        <div className="space-y-3">
          <QuickLink
            href={`/dashboard/lines/${line.short_id}/schedule`}
            icon={<Calendar className="w-5 h-5 text-primary" />}
            title="Call Schedules"
            count={activeSchedulesCount}
            zeroLabel="No schedules set up"
            itemLabel="active schedule"
          />
          <QuickLink
            href={`/dashboard/lines/${line.short_id}/reminders`}
            icon={<Bell className="w-5 h-5 text-primary" />}
            title="Reminders"
            count={pendingRemindersCount}
            zeroLabel="No reminders scheduled"
            itemLabel="reminder scheduled"
          />
          <QuickLink
            href={`/dashboard/lines/${line.short_id}/milestones`}
            icon={<Gift className="w-5 h-5 text-primary" />}
            title="Milestones"
            count={milestonesCount}
            zeroLabel="No milestones yet"
            itemLabel="milestone"
          />
          <QuickLink
            href={`/dashboard/lines/${line.short_id}/contacts`}
            icon={<Users className="w-5 h-5 text-primary" />}
            title="Trusted Contacts"
            count={trustedContactsCount}
            zeroLabel="No contacts added"
            itemLabel="contact"
          />
        </div>
      </div>

      {/* Call History Card */}
      <div className={`${CARD_CLASS} mt-6`}>
        <div className={`${CARD_HEADER_CLASS} mb-6`}>
          <Phone className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Recent Calls</h2>
        </div>
        <CallActivityList sessions={callSessions} />
      </div>

      <Modal
        heading="Test call preview"
        isOpen={isTestCallModalOpen}
        setIsOpen={(open) => {
          setIsTestCallModalOpen(open);
          if (!open) {
            setTestCallError(null);
            setAlternatePhoneError(null);
            setAlternatePhone('');
            setShowVoicemailNotice(false);
            setShowCallFailedNotice(false);
            setTestCallSessionId(null);
            if (cooldownSeconds === 0) {
              setTestCallStatus('idle');
            }
          }
        }}
      >
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            We&apos;ll place a short, guided preview call. You can hang up anytime.
          </p>

          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground">
              Where should we call?
            </div>
            <RadioGroup
              value={testCallTarget}
              onValueChange={(value) => {
                setTestCallTarget(value as 'line' | 'alternate');
                setTestCallError(null);
                setAlternatePhoneError(null);
              }}
              className="gap-3"
            >
              <RadioGroupItemLabel className="items-start">
                <RadioGroupItem value="line" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">Call this line</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPhone(line.phone_e164)}
                  </div>
                </div>
              </RadioGroupItemLabel>
              <RadioGroupItemLabel className="items-start">
                <RadioGroupItem value="alternate" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">Call a different number</div>
                  <div className="text-xs text-muted-foreground">
                    One-time number used only for this preview.
                  </div>
                </div>
              </RadioGroupItemLabel>
            </RadioGroup>

            {testCallTarget === 'alternate' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Alternate phone number
                </label>
                <input
                  value={alternatePhone}
                  onChange={(event) => {
                    setAlternatePhone(event.target.value);
                    setAlternatePhoneError(null);
                  }}
                  placeholder="(555) 555-1234"
                  type="tel"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {alternatePhoneError && (
                  <p className="text-xs text-destructive">{alternatePhoneError}</p>
                )}
              </div>
            )}
          </div>

          {(testCallStatus === 'calling' || isTestCalling) && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
              <Phone className="w-4 h-4" />
              Ultaura is calling now.
            </div>
          )}

          {showVoicemailNotice && (
            <p className="text-xs text-muted-foreground">
              It went to voicemail—no message was left. You can try again in a moment.
            </p>
          )}

          {showCallFailedNotice && !showVoicemailNotice && (
            <p className="text-xs text-muted-foreground">
              The call did not connect. You can try again in a moment.
            </p>
          )}

          {testCallError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <span>{testCallError}</span>
            </div>
          )}
          {testCallError && (
            <p className="text-xs text-muted-foreground">
              {cooldownSeconds > 0
                ? 'You can retry once the cooldown ends.'
                : 'Please try again.'}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => setIsTestCallModalOpen(false)}
              className={`${BTN_OUTLINE_CLASS} w-full sm:w-auto`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleTestCall}
              disabled={isTestCalling || cooldownSeconds > 0 || isReadOnly}
              className={`${BTN_PRIMARY_CLASS} w-full sm:w-auto`}
            >
              {cooldownSeconds > 0
                ? `Try again in ${cooldownSeconds}s`
                : (isTestCalling ? 'Calling...' : 'Start preview call')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Line"
        description="Are you sure you want to delete this line? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <ConfirmationDialog
        open={showTopicsDiscardConfirm}
        onOpenChange={(open) => {
          if (!open) cancelDiscardTopics();
        }}
        title="Unsaved changes"
        description="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard & leave"
        cancelLabel="Stay here"
        variant="default"
        onConfirm={confirmDiscardTopics}
      />
    </div>
  );
}
