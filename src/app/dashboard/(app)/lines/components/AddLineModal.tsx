'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Phone, Clock, Info } from 'lucide-react';
import { createLine } from '~/lib/ultaura/lines';
import { LANGUAGE_OPTIONS, US_TIMEZONES } from '~/lib/ultaura/constants';
import { acknowledgeVendorDisclosure } from '~/lib/ultaura/privacy';
import type { SharingTier, UserType } from '~/lib/ultaura/types';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { useLeavePageGuard } from '~/core/hooks/use-leave-page-guard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '~/core/ui/Dialog';
import {
  modalIconButtonClass,
} from '~/core/ui/modal-button-classes';
import {
  COMPACT_OUTLINE_BUTTON_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '~/core/ui/Select';
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from '~/core/ui/RadioGroup';
import {
  TopicPreferencesForm,
  MAX_INTEREST_TOPICS,
} from '~/components/ultaura/TopicPreferencesForm';
import { formatToE164, getUsPhoneValidationError } from '~/lib/ultaura/phone';
import PhoneInput from '~/components/ultaura/PhoneInput';

interface AddLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
  userType?: UserType;
  vendorAlreadyAcknowledged?: boolean;
}

export function AddLineModal({
  isOpen,
  onClose,
  accountId,
  userType,
  vendorAlreadyAcknowledged = false,
}: AddLineModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [preferredLanguage, setPreferredLanguage] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState('');
  const [avoidTopics, setAvoidTopics] = useState('');
  const [disclosure, setDisclosure] = useState(false);
  const [consent, setConsent] = useState(false);
  const [vendorAcknowledged, setVendorAcknowledged] = useState(vendorAlreadyAcknowledged);
  const [defaultSharingTier, setDefaultSharingTier] = useState<SharingTier>('tier_2');

  const resetFormState = useCallback(() => {
    setStep(1);
    setDisplayName('');
    setPhoneNumber('');
    setPhoneError(null);
    setTimezone('America/Los_Angeles');
    setPreferredLanguage(null);
    setSelectedTopics([]);
    setCustomTopics('');
    setAvoidTopics('');
    setDisclosure(false);
    setConsent(false);
    setVendorAcknowledged(vendorAlreadyAcknowledged);
    setDefaultSharingTier('tier_2');
    setError(null);
    setIsLoading(false);
  }, [vendorAlreadyAcknowledged]);

  const discardAndClose = useCallback(() => {
    resetFormState();
    onClose();
  }, [onClose, resetFormState]);

  const hasChanges =
    displayName.trim() !== '' ||
    phoneNumber.trim() !== '' ||
    timezone !== 'America/Los_Angeles' ||
    preferredLanguage !== null ||
    selectedTopics.length > 0 ||
    customTopics.trim() !== '' ||
    avoidTopics.trim() !== '' ||
    disclosure ||
    consent ||
    (!vendorAlreadyAcknowledged && vendorAcknowledged) ||
    (userType === 'family_managed' && defaultSharingTier !== 'tier_2') ||
    step !== 1;
  const shouldWarnOnNavigate = isOpen && hasChanges && !isLoading;
  const { dialogProps } = useLeavePageGuard({
    isDirty: shouldWarnOnNavigate,
    onDiscard: discardAndClose,
  });

  useEffect(() => {
    if (!isOpen) {
      resetFormState();
      return;
    }
    setVendorAcknowledged(vendorAlreadyAcknowledged);
  }, [isOpen, resetFormState, vendorAlreadyAcknowledged]);

  if (!isOpen) return null;

  const normalizeTopic = (topic: string) => topic.trim();

  const parseCustomTopics = (raw: string) =>
    raw
      .split(',')
      .map(normalizeTopic)
      .filter(Boolean);

  const customTopicList = parseCustomTopics(customTopics);

  const combinedTopics = Array.from(
    new Set(
      [...selectedTopics, ...customTopicList].map((topic) => normalizeTopic(topic)),
    ),
  ).slice(0, MAX_INTEREST_TOPICS);

  const isVendorAcknowledged = vendorAlreadyAcknowledged || vendorAcknowledged;
  const isSelfUser = userType === 'self';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!disclosure || !consent || !isVendorAcknowledged) {
      setError('Please acknowledge the required disclosures to continue');
      return;
    }

    const phoneValidationError = getUsPhoneValidationError(phoneNumber, { required: true });
    if (phoneValidationError) {
      setPhoneError(phoneValidationError);
      setStep(1);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Format phone to E.164
      const phoneE164 = formatToE164(phoneNumber);

      const result = await createLine({
        accountId,
        displayName,
        phoneE164,
        timezone,
        preferredLanguageIso: preferredLanguage,
        seedInterests: combinedTopics.length ? combinedTopics : undefined,
        seedAvoidTopics: avoidTopics
          ? Array.from(new Set(avoidTopics.split(',').map((s) => s.trim()).filter(Boolean)))
          : undefined,
        defaultSharingTier: isSelfUser ? undefined : defaultSharingTier,
      });

      if (!result.success) {
        setError(result.error.message || 'Failed to create line');
        return;
      }

      if (result.data?.lineId && result.data?.shortId) {
        if (!vendorAlreadyAcknowledged && vendorAcknowledged) {
          await acknowledgeVendorDisclosure(accountId);
        }
        onClose();
        router.push(`/dashboard/lines/${result.data.shortId}/verify`);
      } else {
        setError('Failed to create line');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            discardAndClose();
          }
        }}
      >
        <DialogContent
          className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">
                {isSelfUser ? 'Add My Phone' : 'Add a Phone Line'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {step === 1
                  ? 'Add the basics for scheduled check-in calls.'
                  : 'Add topics, sharing preferences, and required consent.'}
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={discardAndClose}
              className={modalIconButtonClass}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {step === 1 && (
                <>
                  {/* Display Name */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={isSelfUser ? 'e.g., My phone' : 'e.g., Mom, Dad, Carmen'}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground transition-colors placeholder:text-muted-foreground focus-visible:!outline-none focus-visible:!border-primary"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {isSelfUser
                        ? 'This is how Ultaura will greet you on calls'
                        : 'This is how Ultaura will greet them on calls'}
                    </p>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Phone Number
                    </label>
                    <div className="relative">
                      <PhoneInput
                        value={phoneNumber}
                        onValueChange={(value) => {
                          setPhoneNumber(value);
                          if (phoneError) {
                            setPhoneError(null);
                          }
                        }}
                        onBlur={(event) => {
                          setPhoneError(getUsPhoneValidationError(event.target.value, { required: true }));
                        }}
                        placeholder="(555) 123-4567"
                        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground transition-colors placeholder:text-muted-foreground focus-visible:!outline-none focus-visible:!border-primary"
                        required
                      />
                      {phoneError ? (
                        <p className="text-xs text-destructive">{phoneError}</p>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      US phone numbers only. We&apos;ll verify this number in the next step.
                    </p>
                  </div>

                  {/* Timezone */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Timezone
                    </label>
                  <Select value={timezone} onValueChange={(value) => setTimezone(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {US_TIMEZONES.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Used to schedule calls at appropriate times for the recipient.
                  </p>
                </div>

                {/* Language Preference */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-foreground">
                    Language Preference
                  </label>
                  <Select
                    value={preferredLanguage ?? 'auto'}
                    onValueChange={(value) => setPreferredLanguage(value === 'auto' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auto-detect" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value ?? 'auto'}
                          value={option.value ?? 'auto'}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {preferredLanguage === null
                      ? 'Ultaura will use a bilingual greeting and detect language from the first conversation.'
                      : `Ultaura will start conversations in ${LANGUAGE_OPTIONS.find((option) => option.value === preferredLanguage)?.label}.`}
                  </p>
                </div>
              </>
            )}

            {step === 2 && (
                <>
                  {/* Topics Preferences */}
                  <TopicPreferencesForm
                    selectedTopics={selectedTopics}
                    customTopics={customTopics}
                    avoidTopics={avoidTopics}
                    onSelectedTopicsChange={setSelectedTopics}
                    onCustomTopicsChange={setCustomTopics}
                    onAvoidTopicsChange={setAvoidTopics}
                  />

                  {userType === 'family_managed' ? (
                    <div className="space-y-2 pt-4 border-t border-border">
                      <label className="block text-sm font-medium text-foreground">
                        Default Family Sharing Level
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {displayName || 'They'} can change this during their first call.
                      </p>
                      <RadioGroup
                        value={defaultSharingTier}
                        onValueChange={(value) => setDefaultSharingTier(value as SharingTier)}
                      >
                        <RadioGroupItemLabel>
                          <RadioGroupItem value="tier_1" />
                          <div>
                            <div className="font-medium text-foreground text-sm">Tier 1: Basic Updates & Safety</div>
                            <div className="text-xs text-muted-foreground">Share call statistics, safety alerts, and usage data with your family.</div>
                          </div>
                        </RadioGroupItemLabel>
                        <RadioGroupItemLabel>
                          <RadioGroupItem value="tier_2" />
                          <div>
                            <div className="font-medium text-foreground text-sm">Tier 2: Wellness Insights</div>
                            <div className="text-xs text-muted-foreground">Includes everything from Tier 1, plus mood tracking and engagement patterns.</div>
                          </div>
                        </RadioGroupItemLabel>
                        <RadioGroupItemLabel>
                          <RadioGroupItem value="tier_3" />
                          <div>
                            <div className="font-medium text-foreground text-sm">Tier 3: Conversation Topics</div>
                            <div className="text-xs text-muted-foreground">Includes everything from Tier 2, plus categories of topics discussed during calls.</div>
                          </div>
                        </RadioGroupItemLabel>
                        <RadioGroupItemLabel>
                          <RadioGroupItem value="tier_4" />
                          <div>
                            <div className="font-medium text-foreground text-sm">Tier 4: Full Visibility</div>
                            <div className="text-xs text-muted-foreground">Includes everything from Tier 3, plus wellness concerns and follow-up recommendations.</div>
                          </div>
                        </RadioGroupItemLabel>
                      </RadioGroup>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                      You can enable family sharing later from the Privacy Center if you want to share updates.
                    </div>
                  )}

                  {/* Disclosures */}
                  <div className="space-y-4 pt-4 border-t border-border">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={disclosure}
                        onChange={(e) => setDisclosure(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <span className="text-sm text-foreground">
                        I understand Ultaura is an AI voice companion and is not a medical or mental health service.
                      </span>
                    </label>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      <span className="text-sm text-foreground">
                        I understand Ultaura may call this phone number on the schedule I set. The recipient can stop calls anytime by pressing 9.
                      </span>
                    </label>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3.5">
                    <Info className="h-[18px] w-[18px] text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-primary leading-snug">
                      After each call, Ultaura captures a brief summary of topics discussed
                      and overall mood -- never transcripts or quotes. You can disable
                      insights anytime in line settings.
                    </p>
                  </div>
                </>
              )}

            <div className="flex gap-3 pt-2">
              {step === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={discardAndClose}
                    className={COMPACT_OUTLINE_BUTTON_CLASS}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const phoneValidationError = getUsPhoneValidationError(phoneNumber, { required: true });
                      if (phoneValidationError) {
                        setPhoneError(phoneValidationError);
                        return;
                      }
                      setStep(2);
                    }}
                    disabled={!displayName || !phoneNumber || !!phoneError}
                    className={COMPACT_PRIMARY_BUTTON_CLASS}
                  >
                    Continue
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className={COMPACT_OUTLINE_BUTTON_CLASS}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !disclosure || !consent || !isVendorAcknowledged}
                    className={COMPACT_PRIMARY_BUTTON_CLASS}
                  >
                    {isLoading ? (
                      <>
                        <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Creating
                      </>
                    ) : (
                      'Add Line'
                    )}
                  </button>
                </>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={dialogProps.open}
        onOpenChange={dialogProps.onOpenChange}
        title="Unsaved changes"
        description="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard & leave"
        cancelLabel="Stay here"
        variant="default"
        onConfirm={dialogProps.onConfirm}
      />
    </>
  );
}
