'use client';

import { useEffect, useState, useTransition } from 'react';
import { CheckCircle2, XCircle, Clock, Pill, Activity } from 'lucide-react';
import { toast } from 'sonner';
import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import {
  getPendingSuggestionsAction,
  approveSuggestionAsNewAction,
  approveSuggestionAsUpdateAction,
  dismissSuggestionAction,
} from '~/lib/ultaura/health/actions';
import type {
  HealthSuggestion,
  ConditionSuggestionProposedFields,
  MedicationSuggestionProposedFields,
} from '@ultaura/types';

type FilterType = 'all' | 'condition' | 'medication';

interface HealthSuggestionsTabProps {
  lineId: string;
  accountId: string;
}

// ---------------------------------------------------------------------------
// Confidence badge
// ---------------------------------------------------------------------------

const CONFIDENCE_BADGE: Record<'high' | 'medium', { label: string; color: 'success' | 'warn' }> = {
  high: {
    label: 'High confidence',
    color: 'success',
  },
  medium: {
    label: 'Medium confidence',
    color: 'warn',
  },
};

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ---------------------------------------------------------------------------
// Proposed fields preview
// ---------------------------------------------------------------------------

function ProposedFieldsPreview({
  suggestionType,
  proposedFields,
}: {
  suggestionType: 'condition' | 'medication';
  proposedFields: ConditionSuggestionProposedFields | MedicationSuggestionProposedFields;
}) {
  const items: { label: string; value: string }[] = [];

  if (suggestionType === 'condition') {
    const f = proposedFields as ConditionSuggestionProposedFields;
    if (f.status) items.push({ label: 'Status', value: f.status });
    if (f.diagnosedOnsetDate) {
      items.push({ label: 'Onset', value: f.diagnosedOnsetDate.value });
    }
    if (f.standardizedId) {
      items.push({ label: 'Code', value: `${f.standardizedId.system}: ${f.standardizedId.code}` });
    }
  } else {
    const f = proposedFields as MedicationSuggestionProposedFields;
    if (f.status) items.push({ label: 'Status', value: f.status.replace('_', ' ') });
    if (f.dosage) items.push({ label: 'Dosage', value: f.dosage });
    if (f.frequency) items.push({ label: 'Frequency', value: f.frequency });
    if (f.timesOfDay && f.timesOfDay.length > 0) {
      items.push({ label: 'Times', value: f.timesOfDay.join(', ') });
    }
    if (f.startDate) items.push({ label: 'Start', value: f.startDate.value });
    if (f.standardizedId) {
      items.push({ label: 'Code', value: `${f.standardizedId.system}: ${f.standardizedId.code}` });
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
        >
          <span className="font-medium text-foreground/70">{item.label}:</span>
          {item.value}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuggestionCard
// ---------------------------------------------------------------------------

function SuggestionCard({
  suggestion,
  lineId,
  onDismissed,
  onApproved,
}: {
  suggestion: HealthSuggestion;
  lineId: string;
  onDismissed: (id: string) => void;
  onApproved: (id: string) => void;
}) {
  const [_isPending, startTransition] = useTransition();
  const [approveMenuOpen, setApproveMenuOpen] = useState(false);

  const confidenceBadge = CONFIDENCE_BADGE[suggestion.confidenceLabel];
  const relativeTime = formatRelativeTime(suggestion.sourceCallStartedAt);

  const handleDismiss = () => {
    startTransition(async () => {
      const result = await dismissSuggestionAction(suggestion.id, lineId);
      if (result.success) {
        toast.success('Suggestion dismissed');
        onDismissed(suggestion.id);
      } else {
        toast.error('error' in result ? result.error : 'Failed to dismiss suggestion');
      }
    });
  };

  const handleApproveAsNew = () => {
    setApproveMenuOpen(false);
    startTransition(async () => {
      const result = await approveSuggestionAsNewAction(suggestion.id, lineId);
      if (result.success) {
        toast.success(`${suggestion.normalizedName} added`);
        onApproved(suggestion.id);
      } else {
        toast.error('error' in result ? result.error : 'Failed to approve suggestion');
      }
    });
  };

  const handleApproveAsUpdate = () => {
    if (!suggestion.similarItemId) return;
    setApproveMenuOpen(false);
    startTransition(async () => {
      const result = await approveSuggestionAsUpdateAction(suggestion.id, lineId, suggestion.similarItemId!);
      if (result.success) {
        toast.success(`${suggestion.normalizedName} updated`);
        onApproved(suggestion.id);
      } else {
        toast.error('error' in result ? result.error : 'Failed to apply update');
      }
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-2">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {suggestion.suggestionType === 'medication' ? (
            <Pill className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Activity className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-semibold text-sm text-foreground truncate">{suggestion.normalizedName}</span>
          <Badge color={confidenceBadge.color} size="small">{confidenceBadge.label}</Badge>
          {suggestion.similarItemWarning && (
            <Badge color="warn" size="small">Similar {suggestion.suggestionType} exists</Badge>
          )}
        </div>
        {relativeTime && (
          <span className="flex items-center gap-1 shrink-0 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {relativeTime}
          </span>
        )}
      </div>

      {/* Summary paraphrase */}
      <p className="text-sm text-muted-foreground leading-snug">{suggestion.summaryParaphrase}</p>

      {/* Proposed fields */}
      <ProposedFieldsPreview
        suggestionType={suggestion.suggestionType}
        proposedFields={suggestion.proposedFields}
      />

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {/* Approve button / menu */}
        <div className="relative">
          <Button
            size="small"
            variant="default"
            onClick={() => {
              if (suggestion.similarItemId) {
                setApproveMenuOpen((v) => !v);
              } else {
                handleApproveAsNew();
              }
            }}
          >
            <CheckCircle2 className="size-3.5 mr-1" />
            Approve
            {suggestion.similarItemId ? ' ▾' : ''}
          </Button>

          {approveMenuOpen && suggestion.similarItemId && (
            <div className="absolute left-0 top-full mt-1 z-10 min-w-[180px] rounded-md border border-border bg-popover shadow-md py-1">
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                onClick={handleApproveAsNew}
              >
                Add as new
              </button>
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                onClick={handleApproveAsUpdate}
              >
                Apply update to existing
              </button>
            </div>
          )}
        </div>

        <Button size="small" variant="ghost" onClick={handleDismiss}>
          <XCircle className="size-3.5 mr-1" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HealthSuggestionsTab
// ---------------------------------------------------------------------------

export function HealthSuggestionsTab({ lineId, accountId }: HealthSuggestionsTabProps) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [suggestions, setSuggestions] = useState<HealthSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const filterArg = filter === 'all' ? undefined : { type: filter as 'condition' | 'medication' };
    getPendingSuggestionsAction(lineId, filterArg)
      .then((result) => {
        if (cancelled) return;
        if (result.success) {
          setSuggestions(result.suggestions);
        } else {
          setError(result.error);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load suggestions');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineId, filter]);

  const handleDismissed = (id: string) => {
    setSuggestions((prev) => prev?.filter((s) => s.id !== id) ?? null);
  };

  const handleApproved = (id: string) => {
    setSuggestions((prev) => prev?.filter((s) => s.id !== id) ?? null);
  };

  const conditionCount = suggestions?.filter((s) => s.suggestionType === 'condition').length ?? 0;
  const medicationCount = suggestions?.filter((s) => s.suggestionType === 'medication').length ?? 0;
  const totalCount = suggestions?.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-foreground">Suggestions</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          When Ultaura hears mentions of health conditions or medications during calls, suggestions
          will appear here for your review.
        </p>
      </div>

      {/* Filter toggle */}
      <div className="flex items-center gap-2" role="group" aria-label="Filter suggestions">
        {(
          [
            { value: 'all', label: `All${totalCount > 0 ? ` (${totalCount})` : ''}` },
            { value: 'condition', label: `Conditions${conditionCount > 0 ? ` (${conditionCount})` : ''}` },
            { value: 'medication', label: `Medications${medicationCount > 0 ? ` (${medicationCount})` : ''}` },
          ] as { value: FilterType; label: string }[]
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={[
              'min-h-[44px] rounded-md px-3 py-2 text-sm font-medium transition-colors',
              filter === value
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            ].join(' ')}
            aria-pressed={filter === value}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && suggestions === null ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading suggestions…</div>
      ) : error ? (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : !suggestions || suggestions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === 'all'
              ? 'No pending suggestions. They will appear here after Ultaura hears mentions during calls.'
              : `No pending ${filter} suggestions.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              lineId={lineId}
              onDismissed={handleDismissed}
              onApproved={handleApproved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
