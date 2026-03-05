'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Phone } from 'lucide-react';
import type { ActionError } from '@ultaura/schemas';
import type { LineRow, UsageSummary } from '~/lib/ultaura/types';
import { getCallSessionStatus, initiateTestCall } from '~/lib/ultaura/usage';
import { TELEPHONY } from '~/lib/ultaura/constants';
import { formatToE164, getUsPhoneValidationError } from '~/lib/ultaura/phone';
import PhoneInput from '~/components/ultaura/PhoneInput';
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupItemLabel,
} from '~/core/ui/RadioGroup';
import Modal from '~/core/ui/Modal';
import Button from '~/core/ui/Button';

interface LineHeaderActionsProps {
  line: LineRow;
  usage: UsageSummary | null;
  isReadOnly?: boolean;
  isTrialActive?: boolean;
}

export function LineHeaderActions({
  line,
  usage,
  isReadOnly = false,
  isTrialActive = false,
}: LineHeaderActionsProps) {
  const [isTestCalling, setIsTestCalling] = useState(false);
  const [isTestCallModalOpen, setIsTestCallModalOpen] = useState(false);
  const [testCallTarget, setTestCallTarget] = useState<'line' | 'alternate'>(
    'line',
  );
  const [alternatePhone, setAlternatePhone] = useState('');
  const [alternatePhoneError, setAlternatePhoneError] = useState<string | null>(
    null,
  );
  const [testCallError, setTestCallError] = useState<string | null>(null);
  const [testCallStatus, setTestCallStatus] = useState<
    'idle' | 'calling' | 'error'
  >('idle');
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [testCallSessionId, setTestCallSessionId] = useState<string | null>(
    null,
  );
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

    if (
      normalizedCode === 'do_not_call' ||
      normalizedCode === 'line_opted_out'
    ) {
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

  const handleTestCall = async () => {
    if (isReadOnly) {
      setTestCallError('Your trial has ended. Subscribe to continue.');
      setTestCallStatus('error');
      setTestCallSessionId(null);
      return;
    }

    if (
      !isTrialActive &&
      (!usage || (usage.minutesRemaining <= 0 && usage.minutesIncluded > 0))
    ) {
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
      if (
        status === 'completed' ||
        status === 'failed' ||
        status === 'canceled'
      ) {
        const answeredByMachine = answeredBy?.startsWith('machine') ?? false;
        const shouldShowVoicemail =
          endReason === 'no_answer' || answeredByMachine;
        const shouldShowFailed =
          !shouldShowVoicemail &&
          (status === 'failed' ||
            status === 'canceled' ||
            endReason === 'busy' ||
            endReason === 'error');
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

  return (
    <>
      {!isReadOnly ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
          <Button
            onClick={() => {
              setIsTestCallModalOpen(true);
              setTestCallError(null);
              setAlternatePhoneError(null);
            }}
            variant="default"
            size="small"
            className="w-full sm:w-auto"
          >
            Test Call
          </Button>
        </div>
      ) : null}

      <Modal
        heading="Test call"
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
            We&apos;ll place a short, guided preview call. You can hang up
            anytime.
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
                  <div className="text-sm font-medium text-foreground">
                    Call this line
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatPhone(line.phone_e164)}
                  </div>
                </div>
              </RadioGroupItemLabel>
              <RadioGroupItemLabel className="items-start">
                <RadioGroupItem value="alternate" />
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    Call a different number
                  </div>
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
                <PhoneInput
                  value={alternatePhone}
                  onValueChange={(value) => {
                    setAlternatePhone(value);
                    setAlternatePhoneError(null);
                  }}
                  onBlur={(event) => {
                    setAlternatePhoneError(
                      getUsPhoneValidationError(event.target.value, {
                        required: true,
                      }),
                    );
                  }}
                  placeholder="(555) 555-1234"
                  error={alternatePhoneError ?? undefined}
                  errorId="alternate-phone-error"
                />
                {alternatePhoneError && (
                  <p
                    id="alternate-phone-error"
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    {alternatePhoneError}
                  </p>
                )}
              </div>
            )}
          </div>

          {(testCallStatus === 'calling' || isTestCalling) && (
            <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3.5">
              <Phone className="h-[18px] w-[18px] text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-primary leading-snug">
                Ultaura is calling now.
              </p>
            </div>
          )}

          {showVoicemailNotice && (
            <p className="text-xs text-muted-foreground">
              It went to voicemail—no message was left. You can try again in a
              moment.
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

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
            <Button
              type="button"
              onClick={() => setIsTestCallModalOpen(false)}
              variant="outline"
              size="small"
              className="w-full"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleTestCall}
              disabled={isTestCalling || cooldownSeconds > 0 || isReadOnly}
              variant="default"
              size="small"
              className="w-full"
            >
              {cooldownSeconds > 0
                ? `Try again in ${cooldownSeconds}s`
                : isTestCalling
                  ? 'Calling...'
                  : 'Start test call'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
