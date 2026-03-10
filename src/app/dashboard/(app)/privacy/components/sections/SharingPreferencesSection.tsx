'use client';

import Link from 'next/link';
import { Check, Share2, X } from 'lucide-react';

import Button from '~/core/ui/Button';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import { Switch } from '~/core/ui/Switch';
import type { LineRow, LineVoiceConsent } from '~/lib/ultaura/types';
import { useCurrentTimeMs } from '../../hooks/useCurrentTimeMs';
import { PrivacyInfoBanner } from '../PrivacyInfoBanner';
import { formatUsPhoneForDisplay } from '~/lib/ultaura/phone';

export interface SharingFeature {
  text: string;
  included: boolean;
}

export interface SharingPreferencesSectionProps {
  isSelfUser: boolean;
  sharingEnabled: boolean;
  sharingAutoSaveIsSaving: boolean;
  isSharingUpdating: boolean;
  onSharingToggle: (enabled: boolean) => void;
  lines: LineRow[];
  lineConsentById: Map<string, LineVoiceConsent>;
  sharingTierLabels: Record<string, string>;
  sharingTierFeatures: Record<string, SharingFeature[]>;
  sharingCooldownMs: number;
  sharingRequestLineId: string | null;
  isAnyLineRequestPending: boolean;
  onSharingRePrompt: (lineId: string) => void;
  formatShortDate: (value?: string | null) => string | null;
  onUpgradeRequest: () => void;
}

function getConsentBadge(sharingConsent: LineVoiceConsent['sharingConsent'] | undefined) {
  if (sharingConsent === 'granted') {
    return {
      text: 'Granted',
      color: 'bg-success/10 text-success',
    };
  }

  if (sharingConsent === 'denied') {
    return {
      text: 'Declined',
      color: 'bg-destructive/10 text-destructive',
    };
  }

  return {
    text: 'Pending',
    color: 'bg-warning/10 text-warning',
  };
}

export function SharingPreferencesSection({
  isSelfUser,
  sharingEnabled,
  sharingAutoSaveIsSaving,
  isSharingUpdating,
  onSharingToggle,
  lines,
  lineConsentById,
  sharingTierLabels,
  sharingTierFeatures,
  sharingCooldownMs,
  sharingRequestLineId,
  isAnyLineRequestPending,
  onSharingRePrompt,
  formatShortDate,
  onUpgradeRequest,
}: SharingPreferencesSectionProps) {
  const nowMs = useCurrentTimeMs();
  const isSharingBusy = sharingAutoSaveIsSaving || isSharingUpdating;

  return (
    <>
      <PrivacyInfoBanner>
        Family sharing lets you invite family members to receive weekly
          summaries and wellness alerts. What is shared follows your loved
          one&apos;s sharing preferences during calls.{' '}
        <Link
          href="/docs/insights-and-reports/sharing-with-family"
          className="text-primary font-medium underline underline-offset-2 hover:no-underline"
        >
          Learn more →
        </Link>
      </PrivacyInfoBanner>

      <Section>
        <SectionHeader
          title={
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-muted-foreground" />
              Sharing preferences
            </div>
          }
          description={
            isSelfUser
              ? 'Control how family members receive updates.'
              : 'View and manage what is shared with family for each line.'
          }
        />
        <SectionBody className="gap-4">
          {isSelfUser ? (
            <>
              <p className="text-sm text-muted-foreground">
                When enabled, you can invite family members to receive weekly
                summaries and wellness alerts.
              </p>
              <div className="flex items-start justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  {sharingEnabled
                    ? 'Sharing is currently enabled.'
                    : 'Sharing is currently disabled.'}
                </div>
                <Switch
                  aria-label="Family sharing"
                  checked={sharingEnabled}
                  onCheckedChange={onSharingToggle}
                  disabled={isSharingBusy}
                />
              </div>
              {sharingEnabled ? (
                <p className="text-xs text-muted-foreground">
                  Only data after sharing is enabled will be shared.
                </p>
              ) : null}
            </>
          ) : (
            <>
              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add a line to view sharing preferences.
                </p>
              ) : (
                lines.map((line) => {
                  const consent = lineConsentById.get(line.id);
                  const sharingConsent = consent?.sharingConsent ?? 'pending';
                  const sharingTier = consent?.sharingTier ?? 'tier_1';
                  const sharingConsentAt = consent?.sharingConsentAt ?? null;
                  const sharingRePromptRequestedAt =
                    consent?.sharingRePromptRequestedAt ?? null;
                  const sharingLastPromptAt = consent?.sharingLastPromptAt ?? null;

                  const tierLabel = sharingTierLabels[sharingTier] ?? 'Unknown';
                  const tierFeatures = sharingTierFeatures[sharingTier] ?? [];
                  const consentBadge = getConsentBadge(sharingConsent);

                  const isRepromptPending = sharingRePromptRequestedAt !== null;
                  const cooldownExpiresAt = sharingLastPromptAt
                    ? new Date(
                        new Date(sharingLastPromptAt).getTime() + sharingCooldownMs,
                      )
                    : null;
                  const isOnCooldown =
                    cooldownExpiresAt !== null &&
                    cooldownExpiresAt.getTime() > nowMs;
                  const canRequestChange =
                    sharingConsent !== 'pending' && !isRepromptPending && !isOnCooldown;

                  return (
                    <div
                      key={line.id}
                      className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {line.display_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="text-primary font-medium">
                              {formatUsPhoneForDisplay(line.phone_e164)}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${consentBadge.color}`}
                        >
                          {consentBadge.text}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          Current level
                        </div>
                        <div className="text-sm font-medium text-foreground">
                          {sharingConsent === 'pending'
                            ? 'Not set yet'
                            : sharingConsent === 'denied'
                              ? `${tierLabel} (declined)`
                              : tierLabel}
                        </div>
                        {sharingConsent !== 'pending' && (
                          <ul className="space-y-1.5 pt-1">
                            {tierFeatures.map((feature) => (
                              <li
                                key={feature.text}
                                className="flex items-center gap-2 text-sm"
                              >
                                {feature.included ? (
                                  <Check className="h-3.5 w-3.5 text-success flex-shrink-0" />
                                ) : (
                                  <X className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                                )}
                                <span
                                  className={
                                    feature.included
                                      ? 'text-foreground'
                                      : 'text-muted-foreground/60'
                                  }
                                >
                                  {feature.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {sharingConsent === 'pending'
                          ? `${line.display_name} will be asked during their next call.`
                          : sharingConsentAt
                            ? `Set by ${line.display_name} on ${formatShortDate(sharingConsentAt) ?? 'unknown date'}`
                            : `Set by ${line.display_name}`}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border/40">
                        {sharingConsent === 'pending' ? (
                          <span className="text-sm text-muted-foreground">
                            Awaiting first preference
                          </span>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="link"
                              size="custom"
                              onClick={() => onSharingRePrompt(line.id)}
                              disabled={
                                !canRequestChange || isAnyLineRequestPending
                              }
                              className="h-auto min-h-0 min-w-0 p-0 text-sm"
                            >
                              {isRepromptPending
                                ? 'Change requested'
                                : sharingRequestLineId === line.id
                                  ? 'Requesting...'
                                  : 'Request Change'}
                            </Button>
                            {isRepromptPending && (
                              <span className="text-xs text-muted-foreground">
                                Requested on{' '}
                                {formatShortDate(sharingRePromptRequestedAt) ?? 'recently'}.
                                {' '}
                                {line.display_name} will be asked on their next
                                call.
                              </span>
                            )}
                            {!isRepromptPending && isOnCooldown && cooldownExpiresAt && (
                              <span className="text-xs text-muted-foreground">
                                Available again on{' '}
                                {formatShortDate(cooldownExpiresAt.toISOString())}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </>
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
              <li>
                Allow adding additional phone lines (if your plan supports it)
              </li>
              <li>Enable inviting family members for notifications</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Your existing settings and data will be preserved.
            </p>
            <Button
              type="button"
              variant="default"
              onClick={onUpgradeRequest}
              disabled={isSharingBusy}
              loading={isSharingBusy}
            >
              Upgrade to Family Mode
            </Button>
          </SectionBody>
        </Section>
      )}
    </>
  );
}
