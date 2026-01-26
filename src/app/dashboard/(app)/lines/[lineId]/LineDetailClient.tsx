'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Phone,
  Play,
  Trash2,
  AlertTriangle,
  Calendar,
  PhoneCall,
  Clock,
  ChevronDown,
} from 'lucide-react';
import type {
  LineRow,
  UsageSummary,
  CallSessionRow,
} from '~/lib/ultaura/types';
import { deleteLine } from '~/lib/ultaura/lines';
import { getCallSessionStatus, initiateTestCall } from '~/lib/ultaura/usage';
import type { ActionError } from '@ultaura/schemas';
import { TELEPHONY } from '~/lib/ultaura/constants';
import { CallActivityList } from './components/CallActivityList';
import { LinePageHeader } from './components/LinePageHeader';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from '~/core/ui/RadioGroup';
import Modal from '~/core/ui/Modal';

const CARD_CLASS = 'bg-card rounded-xl border border-border p-6';
const CARD_HEADER_CLASS = 'flex items-center gap-2';
const BTN_PRIMARY_CLASS = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_OUTLINE_CLASS = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-input text-foreground hover:bg-muted transition-colors disabled:opacity-50';
const BTN_DESTRUCTIVE_OUTLINE_CLASS = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const STAT_CARD_CLASS = 'rounded-lg border border-border bg-card p-4';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
}

function StatCard({ icon, label, value, subtext }: StatCardProps): JSX.Element {
  return (
    <div className={STAT_CARD_CLASS}>
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
      {subtext && <div className="text-xs text-muted-foreground mt-1">{subtext}</div>}
    </div>
  );
}

interface LineDetailClientProps {
  line: LineRow;
  usage: UsageSummary | null;
  callSessions: CallSessionRow[];
  activeSchedulesCount: number;
  pendingRemindersCount: number;
  milestonesCount: number;
  trustedContactsCount: number;
  isReadOnly?: boolean;
  isTrialActive?: boolean;
}

export function LineDetailClient({
  line,
  usage,
  callSessions,
  activeSchedulesCount,
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

  // Calculate quick stats
  const callsThisWeek = callSessions.filter((session) => {
    if (!session.started_at) return false;
    const sessionDate = new Date(session.started_at);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return sessionDate >= oneWeekAgo;
  }).length;

  const nextScheduledCall = activeSchedulesCount > 0 ? 'Scheduled' : 'Not scheduled';
  const minutesUsed = usage ? usage.minutesUsed : 0;
  const minutesRemaining = usage ? usage.minutesRemaining : 0;

  return (
    <div className="w-full">
      {/* Line Page Header with Tabs */}
      <LinePageHeader
        lineName={line.display_name}
        lineShortId={line.short_id}
        phoneE164={line.phone_e164}
        timezone={line.timezone}
        status={line.status}
        isVerified={!!line.phone_verified_at}
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              onClick={() => {
                setIsTestCallModalOpen(true);
                setTestCallError(null);
                setAlternatePhoneError(null);
              }}
              disabled={isReadOnly}
              className={`${BTN_PRIMARY_CLASS} w-full sm:w-auto px-2.5 py-1 text-xs gap-1 rounded-sm`}
            >
              <Play className="w-3 h-3" />
              Test Call
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isReadOnly}
              className={`${BTN_DESTRUCTIVE_OUTLINE_CLASS} w-full sm:w-auto px-2.5 py-1 text-xs gap-1 rounded-sm`}
            >
              <Trash2 className="w-3 h-3" />
              Delete Line
            </button>
          </div>
        }
      />

      {/* Overview Content */}
      <div className="space-y-6 mt-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Calendar className="w-4 h-4" />}
            label="Next Call"
            value={nextScheduledCall}
            subtext={activeSchedulesCount > 0 ? `${activeSchedulesCount} active schedule${activeSchedulesCount !== 1 ? 's' : ''}` : undefined}
          />
          <StatCard
            icon={<PhoneCall className="w-4 h-4" />}
            label="Calls This Week"
            value={String(callsThisWeek)}
          />
          <StatCard
            icon={<Clock className="w-4 h-4" />}
            label="Minutes Used"
            value={String(minutesUsed)}
            subtext={`${minutesRemaining} remaining`}
          />
          <StatCard
            icon={<Phone className="w-4 h-4" />}
            label="Total Calls"
            value={String(callSessions.length)}
          />
        </div>

        {/* Recent Calls */}
        <details className={`${CARD_CLASS} group`}>
          <summary className="flex items-center justify-between gap-3 cursor-pointer select-none [&::-webkit-details-marker]:hidden">
            <div className={`${CARD_HEADER_CLASS}`}>
              <Phone className="w-5 h-5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">Recent Calls</h2>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-6">
            <CallActivityList sessions={callSessions} />
          </div>
        </details>
      </div>

      {/* Test Call Modal */}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Line"
        description="Are you sure you want to delete this line? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
