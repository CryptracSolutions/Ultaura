'use client';

import Link from 'next/link';
import { LayoutDashboard, Users } from 'lucide-react';

import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import Button from '~/core/ui/Button';
import { PrivacyInfoBanner } from '../PrivacyInfoBanner';

export interface OverviewSectionProps {
  isSelfUser: boolean;
  lineCount: number;
  consentSummary: {
    recordingSet: number;
    sharingSet: number;
  };
  showSharingSummary: boolean;
  recordingEnabled: boolean;
  aiSummarizationEnabled: boolean;
  sharingEnabled: boolean;
  retentionLabel: string;
  retentionDescription: string;
  showFamilyTab: boolean;
  confirmedRecipients: number;
  activeRecipientCount: number;
  sharingAutoSaveIsSaving: boolean;
  isSharingUpdating: boolean;
  onEnableFamilySharing: () => void;
}

export function OverviewSection({
  isSelfUser,
  lineCount,
  consentSummary,
  showSharingSummary,
  recordingEnabled,
  aiSummarizationEnabled,
  sharingEnabled,
  retentionLabel,
  retentionDescription,
  showFamilyTab,
  confirmedRecipients,
  activeRecipientCount,
  sharingAutoSaveIsSaving,
  isSharingUpdating,
  onEnableFamilySharing,
}: OverviewSectionProps) {
  const enabledTextClass = 'text-success font-medium';
  const disabledTextClass = 'text-muted-foreground';

  return (
    <>
      <PrivacyInfoBanner>
          All data stays in your control. Ultaura stores call insights and
          memories securely.{' '}
          {isSelfUser
            ? 'Your recording and sharing preferences are set during your calls\u2014not from this dashboard.'
            : 'Recording and sharing consent is given by your loved one during their calls\u2014not from this dashboard.'}{' '}
          You can export or delete all data at any time.{' '}
          <Link
            href="/docs/privacy"
            className="text-primary font-medium underline underline-offset-2 hover:no-underline"
          >
            Learn more →
          </Link>
      </PrivacyInfoBanner>

      <Section>
        <SectionHeader
          title={
            <div className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              Summary
            </div>
          }
          description="Snapshot of consent, sharing, and data settings."
        />
        <SectionBody className="gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Consent status
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Recording consent set</span>
                  <span className="font-medium text-foreground">
                    {lineCount === 0
                      ? 'No lines'
                      : `${consentSummary.recordingSet}/${lineCount}`}
                  </span>
                </div>
                {showSharingSummary ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Sharing preferences set</span>
                    <span className="font-medium text-foreground">
                      {lineCount === 0
                        ? 'No lines'
                        : `${consentSummary.sharingSet}/${lineCount}`}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Active privacy settings
              </div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Call recording</span>
                  <span
                    className={
                      recordingEnabled
                        ? enabledTextClass
                        : disabledTextClass
                    }
                  >
                    {recordingEnabled ? 'On' : 'Off'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">AI memory</span>
                  <span
                    className={
                      aiSummarizationEnabled
                        ? enabledTextClass
                        : disabledTextClass
                    }
                  >
                    {aiSummarizationEnabled ? 'On' : 'Off'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Family sharing</span>
                  <span
                    className={
                      sharingEnabled
                        ? enabledTextClass
                        : disabledTextClass
                    }
                  >
                    {sharingEnabled ? 'On' : 'Off'}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Data retention
              </div>
              <div className="mt-3 text-lg font-semibold text-foreground">{retentionLabel}</div>
              <p className="mt-1 text-xs text-muted-foreground">{retentionDescription}</p>
            </div>

            {showFamilyTab && showSharingSummary ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Family recipients
                </div>
                <div className="mt-3 text-lg font-semibold text-foreground">
                  {confirmedRecipients}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Confirmed · {activeRecipientCount} active recipients
                </p>
              </div>
            ) : null}
          </div>
        </SectionBody>
      </Section>

      {isSelfUser && !sharingEnabled ? (
        <Section>
          <SectionHeader
            title={
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Family Sharing
              </div>
            }
            description="Enable sharing to invite family members and send updates."
          />
          <SectionBody className="gap-4">
            <p className="text-sm text-muted-foreground">
              When enabled, you can invite family members to receive weekly
              summaries and wellness alerts. Only data after you enable sharing
              will be shared.
            </p>
            <Button
              type="button"
              variant="default"
              onClick={onEnableFamilySharing}
              disabled={sharingAutoSaveIsSaving || isSharingUpdating}
              loading={sharingAutoSaveIsSaving || isSharingUpdating}
            >
              {sharingAutoSaveIsSaving || isSharingUpdating
                ? 'Enabling family sharing...'
                : 'Enable family sharing'}
            </Button>
          </SectionBody>
        </Section>
      ) : null}
    </>
  );
}
