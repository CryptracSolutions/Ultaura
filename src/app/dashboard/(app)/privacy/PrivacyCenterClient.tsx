'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Archive,
  ClipboardList,
  Download,
  Mic,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';

import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import { Switch } from '~/core/ui/Switch';
import { Checkbox } from '~/core/ui/Checkbox';
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from '~/core/ui/RadioGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '~/core/ui/Accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '~/core/ui/Table';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';

import type {
  AccountPrivacySettings,
  ConsentAuditEntry,
  DataExportRequest,
  LineRow,
  RetentionPeriod,
  UltauraAccountRow,
} from '~/lib/ultaura/types';
import {
  getDataExportRequests,
  requestAccountDataDeletion,
  requestDataExport,
  updatePrivacySettings,
} from '~/lib/ultaura/privacy';

interface PrivacyCenterClientProps {
  account: UltauraAccountRow;
  privacySettings: AccountPrivacySettings | null;
  lines: LineRow[];
  auditLog: ConsentAuditEntry[];
  exportRequests: DataExportRequest[];
}

const RETENTION_OPTIONS: Array<{
  value: RetentionPeriod;
  label: string;
  description: string;
}> = [
  {
    value: '30_days',
    label: '30 days',
    description: 'Short-term retention for highly sensitive data.',
  },
  {
    value: '90_days',
    label: '90 days',
    description: 'Balanced retention for personalization and review.',
  },
  {
    value: '365_days',
    label: '365 days',
    description: 'Longer retention for historical context.',
  },
  {
    value: 'indefinite',
    label: 'Indefinite',
    description: 'Keep data until you delete it.',
  },
];

const DEFAULT_RETENTION: RetentionPeriod = '90_days';

export function PrivacyCenterClient({
  account,
  privacySettings,
  lines,
  auditLog,
  exportRequests,
}: PrivacyCenterClientProps) {
  const [recordingEnabled, setRecordingEnabled] = useState(
    privacySettings?.recordingEnabled ?? false
  );
  const [aiSummarizationEnabled, setAiSummarizationEnabled] = useState(
    privacySettings?.aiSummarizationEnabled ?? true
  );
  const [retentionPeriod, setRetentionPeriod] = useState<RetentionPeriod>(
    privacySettings?.retentionPeriod ?? DEFAULT_RETENTION
  );

  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [includeMemories, setIncludeMemories] = useState(true);
  const [includeCallMetadata, setIncludeCallMetadata] = useState(true);
  const [includeReminders, setIncludeReminders] = useState(true);
  const [exports, setExports] = useState<DataExportRequest[]>(exportRequests);

  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const lineCount = lines.length;
  const exportInProgress = exports.some(
    (request) => request.status === 'pending' || request.status === 'processing'
  );

  const retentionDescription = useMemo(() => {
    const match = RETENTION_OPTIONS.find((option) => option.value === retentionPeriod);
    return match?.description ?? '';
  }, [retentionPeriod]);

  const handleRecordingToggle = async (checked: boolean) => {
    const previous = recordingEnabled;
    setRecordingEnabled(checked);
    setIsUpdating(true);
    try {
      const result = await updatePrivacySettings(account.id, {
        recordingEnabled: checked,
      });

      if (!result.success) {
        setRecordingEnabled(previous);
        toast.error(result.error || 'Failed to update recording setting');
      } else {
        toast.success(`Recording ${checked ? 'enabled' : 'disabled'}`);
      }
    } catch {
      setRecordingEnabled(previous);
      toast.error('Failed to update recording setting');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSummarizationToggle = async (checked: boolean) => {
    const previous = aiSummarizationEnabled;
    setAiSummarizationEnabled(checked);
    setIsUpdating(true);
    try {
      const result = await updatePrivacySettings(account.id, {
        aiSummarizationEnabled: checked,
      });

      if (!result.success) {
        setAiSummarizationEnabled(previous);
        toast.error(result.error || 'Failed to update AI summarization setting');
      } else {
        toast.success(`AI memory ${checked ? 'enabled' : 'disabled'}`);
      }
    } catch {
      setAiSummarizationEnabled(previous);
      toast.error('Failed to update AI summarization setting');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRetentionChange = async (value: RetentionPeriod) => {
    const previous = retentionPeriod;
    setRetentionPeriod(value);
    setIsUpdating(true);
    try {
      const result = await updatePrivacySettings(account.id, {
        retentionPeriod: value,
      });

      if (!result.success) {
        setRetentionPeriod(previous);
        toast.error(result.error || 'Failed to update retention period');
      } else {
        toast.success('Retention period updated');
      }
    } catch {
      setRetentionPeriod(previous);
      toast.error('Failed to update retention period');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportRequest = async () => {
    setIsExporting(true);
    try {
      const result = await requestDataExport(account.id, {
        format: exportFormat,
        includeMemories,
        includeCallMetadata,
        includeReminders,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to start export');
        return;
      }

      const refreshed = await getDataExportRequests(account.id);
      setExports(refreshed);
      toast.success('Export requested. We will prepare your file shortly.');
    } catch {
      toast.error('Failed to start export');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDataDeletion = async () => {
    const result = await requestAccountDataDeletion(account.id, 'user_request');
    if (!result.success) {
      toast.error(result.error || 'Failed to delete data');
      throw new Error(result.error || 'Deletion failed');
    }
    toast.success('Deletion requested. Privacy data will be removed shortly.');
  };

  return (
    <div className="flex flex-col gap-6 pb-24">
      <Alert type="info">
        <Alert.Heading>Vendor disclosure</Alert.Heading>
        <p>
          Ultaura uses xAI and Twilio to power voice conversations. Audio is processed in real-time
          by these services.{' '}
          <a href="/privacy" className="text-primary hover:underline" target="_blank" rel="noreferrer">
            Learn more in our Privacy Policy
          </a>
          .
        </p>
      </Alert>

      <Section>
        <SectionHeader
          title={
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Privacy controls
            </div>
          }
          description="Manage recording and AI memory settings for this account."
        />
        <SectionBody className="gap-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Mic className="h-4 w-4 text-muted-foreground" />
                Call recording
              </p>
              <p className="text-sm text-muted-foreground">
                When enabled, calls may be recorded. Disclosure is always announced at call start.
              </p>
            </div>
            <Switch
              checked={recordingEnabled}
              onCheckedChange={handleRecordingToggle}
              disabled={isUpdating}
            />
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                AI memory & personalization
              </p>
              <p className="text-sm text-muted-foreground">
                Controls memory storage, retrieval, and post-call summaries across all lines.
              </p>
            </div>
            <Switch
              checked={aiSummarizationEnabled}
              onCheckedChange={handleSummarizationToggle}
              disabled={isUpdating}
            />
          </div>
        </SectionBody>
      </Section>

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
        <SectionBody className="gap-4">
          <RadioGroup
            value={retentionPeriod}
            onValueChange={(value) => handleRetentionChange(value as RetentionPeriod)}
            className="gap-3"
            disabled={isUpdating}
          >
            {RETENTION_OPTIONS.map((option) => (
              <RadioGroupItemLabel key={option.value}>
                <RadioGroupItem value={option.value} />
                <div>
                  <p className="text-sm font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </div>
              </RadioGroupItemLabel>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">{retentionDescription}</p>
        </SectionBody>
      </Section>

      <Section>
        <SectionHeader
          title={
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              Export data
            </div>
          }
          description="Generate a downloadable export of your account data."
        />
        <SectionBody className="gap-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Format</p>
              <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as 'json' | 'csv')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV (ZIP bundle)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <p className="text-sm font-medium text-foreground">Include</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={includeMemories}
                    onCheckedChange={(checked) => setIncludeMemories(Boolean(checked))}
                  />
                  Memories
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={includeCallMetadata}
                    onCheckedChange={(checked) => setIncludeCallMetadata(Boolean(checked))}
                  />
                  Call metadata
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={includeReminders}
                    onCheckedChange={(checked) => setIncludeReminders(Boolean(checked))}
                  />
                  Reminders
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={handleExportRequest}
              disabled={isExporting || exportInProgress}
            >
              {isExporting ? 'Requesting...' : exportInProgress ? 'Export in progress' : 'Request export'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Exports are available for 48 hours and include {lineCount} line{lineCount === 1 ? '' : 's'}.
            </p>
          </div>

          {exports.length > 0 ? (
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Requested</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exports.map((request) => {
                    const statusLabel = formatStatusLabel(request.status);
                    const statusColor = statusToColor(request.status);
                    const isReady = request.status === 'ready' && request.downloadUrl;
                    return (
                      <TableRow key={request.id}>
                        <TableCell>{formatDate(request.createdAt)}</TableCell>
                        <TableCell className="uppercase text-xs text-muted-foreground">
                          {request.format}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </TableCell>
                        <TableCell>{request.expiresAt ? formatDate(request.expiresAt) : '--'}</TableCell>
                        <TableCell className="text-right">
                          {isReady ? (
                            <a
                              href={request.downloadUrl || '#'}
                              className="text-primary hover:underline text-sm"
                              target="_blank"
                              rel="noreferrer"
                            >
                              Download
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">--</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No export requests yet.</p>
          )}
        </SectionBody>
      </Section>

      <Section>
        <SectionHeader
          title={
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              Delete privacy data
            </div>
          }
          description="Remove memories, call insights, and recordings for this account."
        />
        <SectionBody className="gap-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete AI-generated memories, call insights, and any recorded audio.
            Call session metadata and user-created reminders are preserved.
          </p>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            Delete privacy data
          </Button>
        </SectionBody>
      </Section>

      <Section>
        <SectionHeader
          title={
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Consent audit log
            </div>
          }
          description="Track changes to consent and privacy settings."
        />
        <SectionBody>
          <Accordion>
            <AccordionItem value="audit-log">
              <AccordionTrigger>View recent consent changes</AccordionTrigger>
              <AccordionContent>
                {auditLog.length > 0 ? (
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Consent</TableHead>
                          <TableHead>Actor</TableHead>
                          <TableHead>Change</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLog.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{formatDate(entry.createdAt)}</TableCell>
                            <TableCell>{formatAction(entry.action)}</TableCell>
                            <TableCell>{entry.consentType ?? '--'}</TableCell>
                            <TableCell>{formatActor(entry.actorType)}</TableCell>
                            <TableCell>
                              {entry.oldValue !== null || entry.newValue !== null
                                ? `${formatAuditValue(entry.oldValue)} -> ${formatAuditValue(entry.newValue)}`
                                : '--'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No audit events yet.</p>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SectionBody>
      </Section>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete privacy data"
        description="This will permanently delete memories, call insights, and recordings for this account. This action cannot be undone."
        confirmLabel="Delete data"
        variant="destructive"
        onConfirm={handleDataDeletion}
      />
    </div>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '--';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAction(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatActor(value: ConsentAuditEntry['actorType']): string {
  switch (value) {
    case 'payer':
      return 'Account owner';
    case 'line_voice':
      return 'Call recipient';
    case 'system':
      return 'System';
    default:
      return value;
  }
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return '--';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function formatStatusLabel(status: DataExportRequest['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing';
    case 'ready':
      return 'Ready';
    case 'expired':
      return 'Expired';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

function statusToColor(status: DataExportRequest['status']): string {
  switch (status) {
    case 'ready':
      return 'bg-success/10 text-success';
    case 'failed':
      return 'bg-destructive/10 text-destructive';
    case 'expired':
      return 'bg-warning/10 text-warning';
    case 'processing':
    case 'pending':
      return 'bg-info/10 text-info';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
