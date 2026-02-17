'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

import Button from '~/core/ui/Button';
import Badge from '~/core/ui/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';

import { logTimelineRawView, logTimelineRedactionModeChanged } from '../actions.server';

import type {
  TimelineEntry,
  TimelineSource,
  RedactionMode,
} from '~/lib/ultaura/admin/timeline-aggregator';

interface TimelineViewProps {
  entries: TimelineEntry[];
  total: number;
  page: number;
  perPage: number;
  currentSources: TimelineSource[];
  currentRedactionMode: RedactionMode;
}

const ALL_SOURCES: { value: TimelineSource; label: string }[] = [
  { value: 'call_session', label: 'Call Sessions' },
  { value: 'call_event', label: 'Call Events' },
  { value: 'safety_event', label: 'Safety Events' },
  { value: 'reminder', label: 'Reminders' },
  { value: 'schedule_event', label: 'Schedule Events' },
  { value: 'opt_out', label: 'Opt-Outs' },
  { value: 'trusted_contact', label: 'Trusted Contacts' },
  { value: 'notification_recipient', label: 'Notification Recipients' },
  { value: 'data_export', label: 'Data Exports' },
  { value: 'consent_audit', label: 'Consent Audit' },
  { value: 'telephony_event', label: 'Telephony Events' },
];

const SOURCE_BADGE_COLORS: Record<TimelineSource, string> = {
  call_session: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  call_event: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  safety_event: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  reminder: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  schedule_event: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  opt_out: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  trusted_contact: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  notification_recipient: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
  data_export: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  consent_audit: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  telephony_event: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
};

const SOURCE_LABELS: Record<TimelineSource, string> = {
  call_session: 'Call Session',
  call_event: 'Call Event',
  safety_event: 'Safety',
  reminder: 'Reminder',
  schedule_event: 'Schedule',
  opt_out: 'Opt-Out',
  trusted_contact: 'Contact',
  notification_recipient: 'Recipient',
  data_export: 'Export',
  consent_audit: 'Consent',
  telephony_event: 'Telephony',
};

const REDACTION_MODE_OPTIONS: { value: RedactionMode; label: string }[] = [
  { value: 'admin_full', label: 'Admin Full' },
  { value: 'payer_simulated', label: 'Payer View' },
  { value: 'recipient_simulated', label: 'Recipient View' },
];

export default function TimelineView({
  entries,
  total,
  page,
  perPage,
  currentSources,
  currentRedactionMode,
}: TimelineViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selectedSources, setSelectedSources] = useState<Set<TimelineSource>>(
    () => new Set(currentSources),
  );

  const pageCount = Math.ceil(total / perPage);

  const buildUrl = useCallback(
    (overrides: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(overrides)) {
        if (value === undefined || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams],
  );

  const navigateTo = useCallback(
    (url: string) => {
      startTransition(() => {
        router.push(url);
      });
    },
    [router],
  );

  const handleSourceToggle = useCallback(
    (source: TimelineSource) => {
      setSelectedSources((prev) => {
        const next = new Set(prev);
        if (next.has(source)) {
          next.delete(source);
        } else {
          next.add(source);
        }

        const typesValue =
          next.size === 0 || next.size === ALL_SOURCES.length
            ? undefined
            : Array.from(next).join(',');

        navigateTo(buildUrl({ types: typesValue, page: '1' }));
        return next;
      });
    },
    [buildUrl, navigateTo],
  );

  const handleRedactionChange = useCallback(
    (mode: string) => {
      logTimelineRedactionModeChanged(mode, currentRedactionMode).catch(() => {});
      navigateTo(
        buildUrl({
          redaction: mode === 'admin_full' ? undefined : mode,
          page: '1',
        }),
      );
    },
    [buildUrl, navigateTo, currentRedactionMode],
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      navigateTo(
        buildUrl({ page: newPage === 1 ? undefined : String(newPage) }),
      );
    },
    [buildUrl, navigateTo],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Filter Bar */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Source Filters
            </span>
            <div className="flex flex-wrap gap-2">
              {ALL_SOURCES.map(({ value, label }) => {
                const isActive = selectedSources.has(value) || selectedSources.size === 0;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleSourceToggle(value)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? SOURCE_BADGE_COLORS[value] + ' border-transparent'
                        : 'border-border bg-muted/30 text-muted-foreground opacity-50 hover:opacity-75'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Redaction Preview
            </span>
            <Select
              value={currentRedactionMode}
              onValueChange={handleRedactionChange}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Redaction mode" />
              </SelectTrigger>
              <SelectContent>
                {REDACTION_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {currentRedactionMode !== 'admin_full' && (
          <div className="rounded-md border border-warning/50 bg-warning/5 px-3 py-2 text-sm text-warning">
            Viewing in simulated <strong>{currentRedactionMode === 'payer_simulated' ? 'payer' : 'recipient'}</strong> mode.
            Some entries and payload details are hidden or redacted.
          </div>
        )}
      </div>

      {/* Loading overlay */}
      {isPending && (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-2 text-sm text-muted-foreground">
            Loading...
          </span>
        </div>
      )}

      {/* Results summary */}
      <div className="text-sm text-muted-foreground">
        Showing {entries.length} of {total} entries
        {page > 1 ? ` (page ${page})` : ''}
      </div>

      {/* Timeline */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <p className="text-sm text-muted-foreground">
            No timeline entries found for the current filters.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="flex flex-col gap-1">
            {entries.map((entry) => (
              <TimelineEntryRow
                key={`${entry.source}-${entry.id}`}
                entry={entry}
                redactionMode={currentRedactionMode}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="small"
            disabled={page <= 1 || isPending}
            onClick={() => handlePageChange(page - 1)}
          >
            Previous
          </Button>

          <span className="px-3 text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </span>

          <Button
            variant="outline"
            size="small"
            disabled={page >= pageCount || isPending}
            onClick={() => handlePageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function TimelineEntryRow({
  entry,
  redactionMode,
}: {
  entry: TimelineEntry;
  redactionMode: RedactionMode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [auditLogged, setAuditLogged] = useState(false);

  const handleViewRaw = useCallback(async () => {
    const willExpand = !expanded;
    setExpanded(willExpand);

    if (willExpand && !auditLogged) {
      setAuditLogged(true);
      await logTimelineRawView(entry.id, entry.source);
    }
  }, [expanded, auditLogged, entry.id, entry.source]);

  const createdDate = new Date(entry.createdAt);
  const relativeTime = getRelativeTime(createdDate);
  const absoluteTime = createdDate.toLocaleString();

  const hasPayload =
    entry.payload && Object.keys(entry.payload).length > 0;

  return (
    <div className="group relative ml-8 rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/30">
      {/* Timeline dot */}
      <div className="absolute -left-[25px] top-5 h-2.5 w-2.5 rounded-full border-2 border-background bg-border group-hover:bg-primary" />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge size="small" color="custom" className={SOURCE_BADGE_COLORS[entry.source]}>
              {SOURCE_LABELS[entry.source]}
            </Badge>

            <span className="text-sm text-foreground">{entry.summary}</span>
          </div>

          <span
            className="shrink-0 text-xs text-muted-foreground"
            title={absoluteTime}
          >
            {relativeTime}
          </span>
        </div>

        {/* Metadata row */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {entry.accountId && (
            <span>
              Account: <span className="font-mono">{truncateId(entry.accountId)}</span>
            </span>
          )}
          {entry.lineId && (
            <span>
              Line: <span className="font-mono">{truncateId(entry.lineId)}</span>
            </span>
          )}
          <span>
            ID: <span className="font-mono">{truncateId(entry.entityId)}</span>
          </span>
        </div>

        {/* Expand / View Raw */}
        {hasPayload && (
          <div className="pt-1">
            <button
              type="button"
              onClick={handleViewRaw}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {expanded ? 'Hide Raw' : 'View Raw'}
            </button>

            {expanded && (
              <div className="mt-2 overflow-hidden rounded-md border border-border">
                <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {redactionMode === 'admin_full'
                      ? 'Full Payload'
                      : 'Redacted Payload'}
                  </span>
                  {redactionMode !== 'admin_full' && (
                    <span className="text-xs text-warning">
                      Fields marked [hidden] are redacted in this view
                    </span>
                  )}
                </div>
                <pre className="max-h-80 overflow-auto p-3 text-xs leading-relaxed text-foreground">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...`;
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}
