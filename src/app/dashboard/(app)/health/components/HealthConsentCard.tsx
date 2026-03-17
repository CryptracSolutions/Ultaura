'use client';

import { useState, useTransition } from 'react';
import { ShieldCheck, ShieldX, Clock, RefreshCw } from 'lucide-react';
import type { HealthConsentStatus } from '@ultaura/types';
import {
  requestHealthConsentRePromptAction,
  grantHealthConsentSelfAction,
  revokeHealthConsentSelfAction,
} from '~/lib/ultaura/health/actions';
import { Section, SectionHeader, SectionBody } from '~/core/ui/Section';
import Button from '~/core/ui/Button';

const COOLDOWN_DAYS = 30;

interface ConsentHistoryPreviewEntry {
  id: string;
  eventType: string;
  resultingStatus: HealthConsentStatus | null;
  createdAt: string;
}

interface HealthConsentCardProps {
  lineId: string;
  accountId: string;
  userType: 'self' | 'family_managed';
  consentStatus: HealthConsentStatus;
  consentRequestedAt: string | null;
  historyPreview: ConsentHistoryPreviewEntry[];
}

function formatEventLabel(eventType: string, resultingStatus: HealthConsentStatus | null): string {
  switch (eventType) {
    case 'owner_request':
      return 'Consent request sent to companion';
    case 'spoken_prompt':
      return 'Consent prompt read during call';
    case 'spoken_decision':
      return resultingStatus === 'granted'
        ? 'Consent granted during call'
        : resultingStatus === 'denied'
          ? 'Consent denied during call'
          : 'Consent revoked during call';
    case 'self_service_decision':
      return resultingStatus === 'granted'
        ? 'Health enabled for calls'
        : 'Health disabled for calls';
    default:
      return eventType;
  }
}

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isCooldownActive(requestedAt: string | null): boolean {
  if (!requestedAt) return false;
  const ms = Date.now() - new Date(requestedAt).getTime();
  return ms < COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

export function HealthConsentCard({
  lineId,
  userType,
  consentStatus,
  consentRequestedAt,
  historyPreview,
}: HealthConsentCardProps) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [localConsentStatus, setLocalConsentStatus] = useState(consentStatus);
  const cooldownActive = isCooldownActive(consentRequestedAt);

  const handleRePrompt = () => {
    setFeedback(null);

    startTransition(async () => {
      const result = await requestHealthConsentRePromptAction(lineId);

      if (!result.success) {
        if (result.code === 'health_cooldown') {
          setFeedback({ type: 'error', message: `A consent request was already sent within the last ${COOLDOWN_DAYS} days.` });
        } else {
          setFeedback({ type: 'error', message: 'Could not send the request. Please try again.' });
        }
        return;
      }

      setFeedback({ type: 'success', message: 'Request sent. Ultaura will ask for consent on the next call.' });
    });
  };

  const handleSelfToggle = () => {
    setFeedback(null);
    const granting = localConsentStatus !== 'granted';

    startTransition(async () => {
      const result = granting
        ? await grantHealthConsentSelfAction(lineId)
        : await revokeHealthConsentSelfAction(lineId);

      if (!result.success) {
        setFeedback({ type: 'error', message: 'Could not update consent. Please try again.' });
        return;
      }

      setLocalConsentStatus(granting ? 'granted' : 'revoked');
      setFeedback({
        type: 'success',
        message: granting
          ? 'Health is now enabled for calls.'
          : 'Health has been disabled for calls.',
      });
    });
  };

  const isGranted = localConsentStatus === 'granted';
  const StatusIcon = isGranted ? ShieldCheck : ShieldX;

  const statusTitle = (
    <span className="flex items-center gap-2">
      <StatusIcon
        className={`h-4 w-4 shrink-0 ${isGranted ? 'text-green-600' : 'text-muted-foreground'}`}
        aria-hidden="true"
      />
      {isGranted ? 'Health active in calls' : 'Health not active in calls'}
    </span>
  );

  const statusDescription = !isGranted
    ? 'Health information is not being used during Ultaura calls.'
    : undefined;

  return (
    <Section>
      <SectionHeader title={statusTitle} description={statusDescription} />
      <SectionBody className="gap-3">
        <div className="flex items-center gap-3">
          {userType === 'family_managed' ? (
            <Button
              type="button"
              variant="outline"
              size="small"
              onClick={handleRePrompt}
              disabled={isPending || cooldownActive}
              title={
                cooldownActive
                  ? `A request was already sent within the last ${COOLDOWN_DAYS} days`
                  : 'Ask Ultaura to request consent on the next call'
              }
            >
              {cooldownActive ? (
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{cooldownActive ? 'Request sent' : 'Request re-prompt'}</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="small"
              onClick={handleSelfToggle}
              disabled={isPending}
            >
              {isPending ? 'Saving...' : isGranted ? 'Disable Health for calls' : 'Enable Health for calls'}
            </Button>
          )}
        </div>

        {feedback ? (
          <p
            className={`text-xs ${feedback.type === 'success' ? 'text-green-700' : 'text-destructive'}`}
          >
            {feedback.message}
          </p>
        ) : null}

        {historyPreview.length > 0 ? (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Recent activity
            </p>
            <ul className="space-y-1.5">
              {historyPreview.slice(0, 3).map((entry) => (
                <li key={entry.id} className="flex items-center justify-between">
                  <span className="text-xs text-foreground">
                    {formatEventLabel(entry.eventType, entry.resultingStatus)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-4 shrink-0">
                    {formatRelativeDate(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </SectionBody>
    </Section>
  );
}
