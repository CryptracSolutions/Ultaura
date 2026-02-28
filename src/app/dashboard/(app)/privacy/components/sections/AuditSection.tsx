'use client';

import { ClipboardList } from 'lucide-react';

import Button from '~/core/ui/Button';
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
import TextField from '~/core/ui/TextField';
import type { ConsentAuditEntry } from '~/lib/ultaura/types';
import {
  formatAction,
  formatActor,
  formatAuditValue,
  formatDate,
} from '../../lib/privacy-formatters';

export interface AuditSectionProps {
  auditConsentFilter: string;
  onAuditConsentFilterChange: (value: string) => void;
  consentTypeOptions: string[];
  auditActorFilter: ConsentAuditEntry['actorType'] | 'all';
  onAuditActorFilterChange: (
    value: ConsentAuditEntry['actorType'] | 'all',
  ) => void;
  actorTypeOptions: ConsentAuditEntry['actorType'][];
  auditSearch: string;
  onAuditSearchChange: (value: string) => void;
  filteredAuditLog: ConsentAuditEntry[];
  pagedAuditLog: ConsentAuditEntry[];
  auditLog: ConsentAuditEntry[];
  auditStartIndex: number;
  auditEndIndex: number;
  auditPageSafe: number;
  auditTotalPages: number;
  onAuditPrevPage: () => void;
  onAuditNextPage: () => void;
}

export function AuditSection({
  auditConsentFilter,
  onAuditConsentFilterChange,
  consentTypeOptions,
  auditActorFilter,
  onAuditActorFilterChange,
  actorTypeOptions,
  auditSearch,
  onAuditSearchChange,
  filteredAuditLog,
  pagedAuditLog,
  auditLog,
  auditStartIndex,
  auditEndIndex,
  auditPageSafe,
  auditTotalPages,
  onAuditPrevPage,
  onAuditNextPage,
}: AuditSectionProps) {
  return (
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
      <SectionBody className="gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Consent type</p>
            <Select
              value={auditConsentFilter}
              onValueChange={onAuditConsentFilterChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {consentTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatAction(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Actor</p>
            <Select
              value={auditActorFilter}
              onValueChange={(value) =>
                onAuditActorFilterChange(
                  value as ConsentAuditEntry['actorType'] | 'all',
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All actors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actors</SelectItem>
                {actorTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatActor(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TextField>
            <TextField.Label>
              Search
              <TextField.Input
                value={auditSearch}
                onChange={(event) => onAuditSearchChange(event.target.value)}
                placeholder="Search actions or consent types"
              />
            </TextField.Label>
          </TextField>
        </div>

        {filteredAuditLog.length > 0 ? (
          <div className="rounded-lg border border-border overflow-x-auto">
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
                {pagedAuditLog.map((entry) => (
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
          <p className="text-sm text-muted-foreground">
            {auditLog.length === 0
              ? 'No audit events yet.'
              : 'No audit events match the current filters.'}
          </p>
        )}

        {filteredAuditLog.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Showing {auditStartIndex}-{auditEndIndex} of {filteredAuditLog.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                aria-label="Previous audit log page"
                onClick={onAuditPrevPage}
                disabled={auditPageSafe <= 1}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {auditPageSafe} of {auditTotalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                aria-label="Next audit log page"
                onClick={onAuditNextPage}
                disabled={auditPageSafe >= auditTotalPages}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </SectionBody>
    </Section>
  );
}
