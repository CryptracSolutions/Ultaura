'use client';

import { Download } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/core/ui/Accordion';
import Button from '~/core/ui/Button';
import { Checkbox } from '~/core/ui/Checkbox';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';
import TableEmptyState from '~/core/ui/TableEmptyState';
import { formatDateTime } from '~/lib/utils/format-date';
import type { DataExportRequest } from '~/lib/ultaura/types';
import {
  formatStatusLabel,
  getSafeDownloadUrl,
  statusToColor,
} from '../../lib/privacy-formatters';

export interface ExportSectionProps {
  exportFormat: 'json' | 'csv';
  onExportFormatChange: (format: 'json' | 'csv') => void;
  isExporting: boolean;
  exportInProgress: boolean;
  lineCount: number;
  exportPollingTimedOut: boolean;
  onExportRequest: () => void;
  includeMemories: boolean;
  includeCallMetadata: boolean;
  includeReminders: boolean;
  onIncludeMemoriesChange: (checked: boolean) => void;
  onIncludeCallMetadataChange: (checked: boolean) => void;
  onIncludeRemindersChange: (checked: boolean) => void;
  exports: DataExportRequest[];
}

export function ExportSection({
  exportFormat,
  onExportFormatChange,
  isExporting,
  exportInProgress,
  lineCount,
  exportPollingTimedOut,
  onExportRequest,
  includeMemories,
  includeCallMetadata,
  includeReminders,
  onIncludeMemoriesChange,
  onIncludeCallMetadataChange,
  onIncludeRemindersChange,
  exports,
}: ExportSectionProps) {
  const isExportBusy = isExporting || exportInProgress;

  return (
    <Section>
      <SectionHeader
        title={
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-muted-foreground" />
            Export data
          </div>
        }
        description="Generate a downloadable export of your account data. Includes all lines and expires in 48 hours."
      />
      <SectionBody className="gap-6">
        <div className="grid gap-4 md:grid-cols-3 md:items-start">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:col-span-2">
            <p className="text-sm font-medium text-foreground sm:shrink-0">
              Format
            </p>
            <Select
              value={exportFormat}
              onValueChange={(value) =>
                onExportFormatChange(value as 'json' | 'csv')
              }
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="csv">CSV (ZIP bundle)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex md:justify-end md:self-end">
            <Button
              type="button"
              variant="default"
              size="small"
              className="w-full sm:w-auto"
              onClick={onExportRequest}
              disabled={isExportBusy}
              loading={isExporting}
            >
              {isExporting
                ? 'Requesting...'
                : exportInProgress
                  ? 'Export in progress'
                  : 'Request export'}
            </Button>
          </div>
        </div>

        {exportInProgress ? (
          <p className="text-xs text-muted-foreground">
            {exportPollingTimedOut
              ? 'Auto-refresh paused after repeated checks. Refresh to check status again.'
              : 'Updating automatically every 10 seconds.'}
          </p>
        ) : null}

        <Accordion>
          <AccordionItem value="export-advanced">
            <AccordionTrigger>Advanced export options</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose which datasets to include in the export bundle.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={includeMemories}
                    onCheckedChange={(checked) =>
                      onIncludeMemoriesChange(Boolean(checked))
                    }
                  />
                  Memories
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={includeCallMetadata}
                    onCheckedChange={(checked) =>
                      onIncludeCallMetadataChange(Boolean(checked))
                    }
                  />
                  Call metadata
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={includeReminders}
                    onCheckedChange={(checked) =>
                      onIncludeRemindersChange(Boolean(checked))
                    }
                  />
                  Reminders
                </label>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {exports.length > 0 ? (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Download</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.map((request) => {
                  const statusLabel = formatStatusLabel(request.status);
                  const statusColor = statusToColor(request.status);
                  const safeDownloadUrl = getSafeDownloadUrl(
                    request.downloadUrl,
                  );
                  const readyDownloadUrl =
                    request.status === 'ready' ? safeDownloadUrl : null;
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        {readyDownloadUrl ? (
                          <a
                            href={readyDownloadUrl}
                            className="inline-flex items-center justify-center rounded-md p-1 text-primary transition-colors hover:text-primary/80"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Download ${request.format} export requested ${formatDateTime(request.createdAt)}`}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            --
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{formatDateTime(request.createdAt)}</TableCell>
                      <TableCell className="uppercase text-xs text-muted-foreground">
                        {request.format}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColor}`}
                        >
                          {statusLabel}
                        </span>
                      </TableCell>
                      <TableCell>
                        {request.expiresAt
                          ? formatDateTime(request.expiresAt)
                          : '--'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <TableEmptyState message="No export requests yet." />
        )}
      </SectionBody>
    </Section>
  );
}
