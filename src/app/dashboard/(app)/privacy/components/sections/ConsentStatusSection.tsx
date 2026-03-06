'use client';

import { Mic } from 'lucide-react';

import Button from '~/core/ui/Button';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import type { LineRow, LineVoiceConsent } from '~/lib/ultaura/types';
import { useCurrentTimeMs } from '../../hooks/useCurrentTimeMs';

export interface ConsentStatusSectionProps {
  recordingEnabled: boolean;
  lines: LineRow[];
  lineConsentById: Map<string, LineVoiceConsent>;
  latestRecordingRequestByLine: Map<string, string>;
  recordingRequestLineId: string | null;
  isAnyLineRequestPending: boolean;
  recordingReenableCooldownMs: number;
  onRecordingReenable: (lineId: string) => void;
  formatShortDate: (value?: string | null) => string | null;
}

export function ConsentStatusSection({
  recordingEnabled,
  lines,
  lineConsentById,
  latestRecordingRequestByLine,
  recordingRequestLineId,
  isAnyLineRequestPending,
  recordingReenableCooldownMs,
  onRecordingReenable,
  formatShortDate,
}: ConsentStatusSectionProps) {
  const nowMs = useCurrentTimeMs();

  return (
    <Section>
      <SectionHeader
        title={
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-muted-foreground" />
            Consent Status
          </div>
        }
        description="Review recording consent for each line."
      />
      <SectionBody className="gap-4">
        {!recordingEnabled ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Account recording is currently off. Even if a line shows approved
            consent, new calls will not be recorded until you turn recording back
            on.
          </div>
        ) : null}
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
            const recordingReenableRequestedAtRaw =
              consent?.recordingReenableRequestedAt ?? null;
            const recordingReenableDeclineCount =
              consent?.recordingReenableDeclineCount ?? 0;
            const recordingReenableBlockedAt =
              consent?.recordingReenableBlockedAt ?? null;
            const latestRecordingReenableRequestedAt =
              latestRecordingRequestByLine.get(line.id) ?? null;
            const recordingReenableRequestedAt =
              recordingReenableRequestedAtRaw ?? latestRecordingReenableRequestedAt;
            const isRecordingReenablePending =
              recordingReenableRequestedAtRaw !== null;
            const recordingConsentAt = formatShortDate(consent?.recordingConsentAt);
            const recordingCooldownExpiresAt =
              recordingReenableRequestedAt !== null
                ? new Date(
                    new Date(recordingReenableRequestedAt).getTime() +
                      recordingReenableCooldownMs,
                  )
                : null;
            const isRecordingOnCooldown =
              recordingCooldownExpiresAt !== null &&
              recordingCooldownExpiresAt.getTime() > nowMs;
            const isRecordingDenied = recordingConsent === 'denied';
            const isRecordingReenableBlocked =
              isRecordingDenied &&
              recordingPreferencePermanent &&
              (recordingReenableBlockedAt !== null ||
                recordingReenableDeclineCount >= 1);
            const recordingStatus =
              recordingConsent === 'granted'
                ? 'Approved'
                : isRecordingDenied
                  ? recordingPreferencePermanent
                    ? `Declined by ${line.display_name}`
                    : 'Ask each call'
                  : 'Awaiting consent';
            const recordingNote = isRecordingReenableBlocked
              ? 'Recording re-enable is unavailable after a declined request.'
              : isRecordingReenablePending
                ? `Re-enable requested on ${
                    formatShortDate(recordingReenableRequestedAt) ?? 'recently'
                  }. ${line.display_name} will be asked on their next call.`
                : isRecordingOnCooldown
                  ? `Available again on ${
                      formatShortDate(recordingCooldownExpiresAt?.toISOString()) ??
                      'a later date'
                    }`
                  : recordingConsentAt
                    ? `Set on ${recordingConsentAt}`
                    : null;
            const canRequestRecording =
              isRecordingDenied &&
              recordingPreferencePermanent &&
              !isRecordingReenableBlocked &&
              !isRecordingOnCooldown &&
              !isRecordingReenablePending;

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

                <div>
                  <div className="text-xs text-muted-foreground">Recording</div>
                  <div className={`text-sm ${recordingStatus === 'Approved' ? 'text-primary' : 'text-foreground'}`}>
                    {recordingStatus}
                  </div>
                  {recordingNote ? (
                    <div className="text-xs text-muted-foreground mt-1">{recordingNote}</div>
                  ) : null}
                </div>

                {canRequestRecording ? (
                  <div className="flex flex-wrap gap-3 pt-3">
                    <Button
                      type="button"
                      variant="link"
                      size="custom"
                      onClick={() => onRecordingReenable(line.id)}
                      disabled={isAnyLineRequestPending}
                      className="h-auto min-h-0 min-w-0 p-0 text-sm"
                    >
                      {recordingRequestLineId === line.id
                        ? 'Requesting...'
                        : 'Re-enable recording'}
                    </Button>
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
