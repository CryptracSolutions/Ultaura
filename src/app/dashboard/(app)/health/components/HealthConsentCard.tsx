'use client';

import { useState, useTransition } from 'react';
import { ShieldCheck, ShieldX, Clock, RefreshCw, ChevronDown } from 'lucide-react';
import type { HealthConsentStatus } from '@ultaura/types';
import {
  requestHealthConsentRePromptAction,
  grantHealthConsentSelfAction,
  revokeHealthConsentSelfAction,
} from '~/lib/ultaura/health/actions';
import Button from '~/core/ui/Button';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '~/core/ui/Popover';

const COOLDOWN_DAYS = 30;

interface HealthConsentCardProps {
  lineId: string;
  lineName: string;
  userType: 'self' | 'family_managed';
  consentStatus: HealthConsentStatus;
  consentRequestedAt: string | null;
}

function isCooldownActive(requestedAt: string | null): boolean {
  if (!requestedAt) return false;
  const ms = Date.now() - new Date(requestedAt).getTime();
  return ms < COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

export function HealthConsentCard({
  lineId,
  lineName,
  userType,
  consentStatus,
  consentRequestedAt,
}: HealthConsentCardProps) {
  const [isPending, startTransition] = useTransition();
  const [popoverOpen, setPopoverOpen] = useState(false);
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

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:opacity-80 ${
            isGranted
              ? 'border-primary/30 bg-primary/5 text-primary'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          }`}
        >
          <StatusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          User Status
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform duration-200 ${popoverOpen ? 'rotate-180' : ''}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3" onClick={(e) => { if ((e.target as HTMLElement).closest('button')) return; setPopoverOpen(false); }}>
        <div className="space-y-2.5">
          <p className="text-sm font-medium text-foreground">
            {isGranted ? `Health information for ${lineName} is actively being used during calls with Ultaura` : `Health information for ${lineName} is not actively being used during calls with Ultaura`}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isGranted
              ? `${lineName} has granted consent. Ultaura uses this to provide more informed companionship.`
              : `${lineName} controls this setting. Request a re-prompt to have Ultaura ask them for permission to use this during calls.`}
          </p>

          {userType === 'family_managed' ? (
            !isGranted && (
              <Button
                type="button"
                variant="outline"
                size="small"
                block
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
            )
          ) : (
            <Button
              type="button"
              variant="outline"
              size="small"
              block
              onClick={handleSelfToggle}
              disabled={isPending}
            >
              {isPending ? 'Saving...' : isGranted ? 'Disable Health for calls' : 'Enable Health for calls'}
            </Button>
          )}

          {feedback ? (
            <p
              className={`text-xs ${feedback.type === 'success' ? 'text-green-700' : 'text-destructive'}`}
            >
              {feedback.message}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
