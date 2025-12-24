'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Phone, Globe, Clock } from 'lucide-react';
import { createLine } from '~/lib/ultaura/actions';
import { US_TIMEZONES, LANGUAGE_LABELS } from '~/lib/ultaura/constants';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '~/core/ui/Select';

interface AddLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: string;
}

export function AddLineModal({
  isOpen,
  onClose,
  accountId,
}: AddLineModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [language, setLanguage] = useState<'auto' | 'en' | 'es'>('auto');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [interests, setInterests] = useState('');
  const [avoidTopics, setAvoidTopics] = useState('');
  const [disclosure, setDisclosure] = useState(false);
  const [consent, setConsent] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!disclosure || !consent) {
      setError('Please acknowledge the disclosures to continue');
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
        preferredLanguage: language,
        timezone,
        seedInterests: interests ? interests.split(',').map(s => s.trim()) : undefined,
        seedAvoidTopics: avoidTopics ? avoidTopics.split(',').map(s => s.trim()) : undefined,
      });

      if (result.success && result.lineId) {
        onClose();
        router.push(`/dashboard/lines/${result.lineId}/verify`);
      } else {
        setError(result.error || 'Failed to create line');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-card rounded-xl shadow-lg border border-border">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Add a Phone Line</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-6">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  {error}
                </div>
              )}

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
                      placeholder="e.g., Mom, Dad, Carmen"
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      This is how Ultaura will greet them on calls
                    </p>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="(555) 123-4567"
                        className="w-full pl-10 pr-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      US phone numbers only. We'll verify this number in the next step.
                    </p>
                  </div>

                  {/* Language */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      <Globe className="inline w-4 h-4 mr-1" />
                      Language Preference
                    </label>
                    <Select value={language} onValueChange={(value) => setLanguage(value as 'auto' | 'en' | 'es')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto-detect</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Timezone */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      <Clock className="inline w-4 h-4 mr-1" />
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
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  {/* Interests */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Topics They Enjoy (optional)
                    </label>
                    <textarea
                      value={interests}
                      onChange={(e) => setInterests(e.target.value)}
                      placeholder="e.g., gardening, cooking, family, sports..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Separate topics with commas
                    </p>
                  </div>

                  {/* Topics to Avoid */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-foreground">
                      Topics to Avoid (optional)
                    </label>
                    <textarea
                      value={avoidTopics}
                      onChange={(e) => setAvoidTopics(e.target.value)}
                      placeholder="e.g., politics, health issues..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    />
                  </div>

                  {/* Disclosures */}
                  <div className="space-y-4 pt-4 border-t border-border">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={disclosure}
                        onChange={(e) => setDisclosure(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-input accent-primary focus:ring-ring"
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
                        className="mt-1 h-4 w-4 rounded border-input accent-primary focus:ring-ring"
                      />
                      <span className="text-sm text-foreground">
                        I understand Ultaura may call this phone number on the schedule I set. The recipient can stop calls anytime by pressing 9.
                      </span>
                    </label>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-border bg-muted/50 rounded-b-xl">
              {step === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!displayName || !phoneNumber}
                    className="px-4 py-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !disclosure || !consent}
                    className="px-4 py-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Creating...' : 'Add Line'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
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
