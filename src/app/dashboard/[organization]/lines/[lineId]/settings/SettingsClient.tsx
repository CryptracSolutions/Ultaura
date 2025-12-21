'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Settings, Globe, Clock, MessageSquare, Save, X } from 'lucide-react';
import type { LineRow } from '~/lib/ultaura/types';
import { updateLine } from '~/lib/ultaura/actions';
import {
  US_TIMEZONES,
  LANGUAGE_LABELS,
  SPANISH_FORMALITY_LABELS,
  TIME_OPTIONS,
} from '~/lib/ultaura/constants';

interface SettingsClientProps {
  line: LineRow;
  organizationSlug: string;
}

export function SettingsClient({ line, organizationSlug }: SettingsClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [timezone, setTimezone] = useState(line.timezone);
  const [language, setLanguage] = useState(line.preferred_language);
  const [spanishFormality, setSpanishFormality] = useState(line.spanish_formality);
  const [quietHoursStart, setQuietHoursStart] = useState(line.quiet_hours_start);
  const [quietHoursEnd, setQuietHoursEnd] = useState(line.quiet_hours_end);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await updateLine(line.id, {
        timezone,
        preferredLanguage: language,
        spanishFormality,
        quietHoursStart,
        quietHoursEnd,
      });

      if (result.success) {
        router.push(`/dashboard/${organizationSlug}/lines/${line.id}`);
        router.refresh();
      } else {
        setError(result.error || 'Failed to update settings');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges =
    timezone !== line.timezone ||
    language !== line.preferred_language ||
    spanishFormality !== line.spanish_formality ||
    quietHoursStart !== line.quiet_hours_start ||
    quietHoursEnd !== line.quiet_hours_end;

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/${organizationSlug}/lines/${line.id}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {line.display_name}
        </Link>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Line Settings</h1>
            <p className="text-muted-foreground">Configure settings for {line.display_name}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="bg-card rounded-xl border border-border p-6 space-y-6">
          {/* Timezone */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <Globe className="w-4 h-4 text-muted-foreground" />
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:outline-none"
            >
              {US_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground mt-1">
              All call times and quiet hours are based on this timezone.
            </p>
          </div>

          {/* Language */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Preferred Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'auto' | 'en' | 'es')}
              className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:outline-none"
            >
              {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Spanish Formality (only show if Spanish selected) */}
          {language === 'es' && (
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Spanish Formality
              </label>
              <div className="flex gap-3">
                {Object.entries(SPANISH_FORMALITY_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSpanishFormality(value as 'usted' | 'tu')}
                    className={`flex-1 px-4 py-3 rounded-lg border transition-colors ${
                      spanishFormality === value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background text-foreground hover:border-primary/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Choose how Ultaura addresses your loved one in Spanish.
              </p>
            </div>
          )}

          {/* Quiet Hours */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Quiet Hours
            </label>
            <p className="text-sm text-muted-foreground mb-3">
              Ultaura will not make calls during these hours.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Start</label>
                <select
                  value={quietHoursStart}
                  onChange={(e) => setQuietHoursStart(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time.value} value={time.value}>
                      {time.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">End</label>
                <select
                  value={quietHoursEnd}
                  onChange={(e) => setQuietHoursEnd(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-ring focus:outline-none"
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time.value} value={time.value}>
                      {time.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-3">
          <Link
            href={`/dashboard/${organizationSlug}/lines/${line.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-input text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading || !hasChanges}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
