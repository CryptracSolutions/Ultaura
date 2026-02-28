'use client';

import { Archive, Trash2 } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/core/ui/Accordion';
import Button from '~/core/ui/Button';
import {
  RadioGroup,
  RadioGroupItem,
  RadioGroupItemLabel,
} from '~/core/ui/RadioGroup';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import type { RetentionPeriod } from '~/lib/ultaura/types';

export interface RetentionOption {
  value: RetentionPeriod;
  label: string;
  description: string;
}

export interface DataRetentionSectionProps {
  retentionLabel: string;
  retentionDescription: string;
  retentionPeriod: RetentionPeriod;
  retentionOptions: RetentionOption[];
  isSaving: boolean;
  isPrivacySettingsUnavailable: boolean;
  onRetentionChange: (value: RetentionPeriod) => void;
  onDeletePrivacyData: () => void;
}

export function DataRetentionSection({
  retentionLabel,
  retentionDescription,
  retentionPeriod,
  retentionOptions,
  isSaving,
  isPrivacySettingsUnavailable,
  onRetentionChange,
  onDeletePrivacyData,
}: DataRetentionSectionProps) {
  return (
    <Section>
      <SectionHeader
        title={
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-muted-foreground" />
            Data retention
          </div>
        }
        description="Retention applies to memories, call insights, and recordings."
      />
      <SectionBody className="gap-6">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Current retention
          </div>
          <div className="mt-3 text-lg font-semibold text-foreground">{retentionLabel}</div>
          <p className="mt-1 text-sm text-muted-foreground">{retentionDescription}</p>
        </div>

        <Accordion>
          <AccordionItem value="retention-advanced">
            <AccordionTrigger>Advanced retention settings</AccordionTrigger>
            <AccordionContent>
              <RadioGroup
                value={retentionPeriod}
                onValueChange={(value) => onRetentionChange(value as RetentionPeriod)}
                className="gap-3"
                disabled={isSaving || isPrivacySettingsUnavailable}
              >
                {retentionOptions.map((option) => (
                  <RadioGroupItemLabel key={option.value}>
                    <RadioGroupItem value={option.value} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </RadioGroupItemLabel>
                ))}
              </RadioGroup>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="border-t border-border/60 pt-6">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
            Delete privacy data
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete AI-generated memories, call insights, and
            recorded audio. Call session metadata and user-created reminders are
            preserved.
          </p>
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={onDeletePrivacyData}
          >
            Delete privacy data
          </Button>
        </div>
      </SectionBody>
    </Section>
  );
}
