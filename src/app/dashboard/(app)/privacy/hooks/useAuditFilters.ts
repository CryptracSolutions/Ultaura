'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ConsentAuditEntry } from '~/lib/ultaura/types';

export interface UseAuditFiltersOptions {
  auditLog: ConsentAuditEntry[];
  pageSize?: number;
}

export interface UseAuditFiltersResult {
  auditConsentFilter: string;
  setAuditConsentFilter: (value: string) => void;
  auditActorFilter: 'all' | ConsentAuditEntry['actorType'];
  setAuditActorFilter: (value: 'all' | ConsentAuditEntry['actorType']) => void;
  auditSearch: string;
  setAuditSearch: (value: string) => void;
  auditPage: number;
  setAuditPage: (value: number) => void;
  consentTypeOptions: string[];
  actorTypeOptions: ConsentAuditEntry['actorType'][];
  filteredAuditLog: ConsentAuditEntry[];
  pagedAuditLog: ConsentAuditEntry[];
  auditTotalPages: number;
  auditPageSafe: number;
  auditStartIndex: number;
  auditEndIndex: number;
}

export interface AuditFilterCriteria {
  consentFilter: string;
  actorFilter: 'all' | ConsentAuditEntry['actorType'];
  search: string;
}

function buildAuditSearchHaystack(entry: ConsentAuditEntry): string {
  return [entry.action, entry.consentType ?? '', entry.actorType, entry.lineId ?? '']
    .join(' ')
    .toLowerCase();
}

export function filterAuditEntries(
  auditLog: ConsentAuditEntry[],
  criteria: AuditFilterCriteria,
): ConsentAuditEntry[] {
  const searchValue = criteria.search.trim().toLowerCase();

  return auditLog.filter((entry) => {
    if (
      criteria.consentFilter !== 'all' &&
      entry.consentType !== criteria.consentFilter
    ) {
      return false;
    }
    if (
      criteria.actorFilter !== 'all' &&
      entry.actorType !== criteria.actorFilter
    ) {
      return false;
    }
    if (!searchValue) {
      return true;
    }

    const haystack = buildAuditSearchHaystack(entry);

    return haystack.includes(searchValue);
  });
}

export function paginateAuditEntries(
  entries: ConsentAuditEntry[],
  page: number,
  pageSize: number,
) {
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const startIndex = entries.length === 0 ? 0 : (pageSafe - 1) * pageSize + 1;
  const endIndex = Math.min(pageSafe * pageSize, entries.length);
  const paged = entries.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  return {
    totalPages,
    pageSafe,
    startIndex,
    endIndex,
    paged,
  };
}

export function useAuditFilters({
  auditLog,
  pageSize = 10,
}: UseAuditFiltersOptions): UseAuditFiltersResult {
  const [auditConsentFilter, setAuditConsentFilter] = useState<string>('all');
  const [auditActorFilter, setAuditActorFilter] = useState<
    'all' | ConsentAuditEntry['actorType']
  >('all');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  const consentTypeOptions = useMemo(() => {
    const types = new Set(
      auditLog
        .map((entry) => entry.consentType)
        .filter((value): value is string => !!value),
    );
    return Array.from(types);
  }, [auditLog]);

  const actorTypeOptions = useMemo(() => {
    const types = new Set(auditLog.map((entry) => entry.actorType));
    return Array.from(types);
  }, [auditLog]);

  const filteredAuditLog = useMemo(
    () =>
      filterAuditEntries(auditLog, {
        consentFilter: auditConsentFilter,
        actorFilter: auditActorFilter,
        search: auditSearch,
      }),
    [auditActorFilter, auditConsentFilter, auditLog, auditSearch],
  );

  const pagination = useMemo(
    () => paginateAuditEntries(filteredAuditLog, auditPage, pageSize),
    [auditPage, filteredAuditLog, pageSize],
  );

  useEffect(() => {
    setAuditPage(1);
  }, [auditActorFilter, auditConsentFilter, auditSearch]);

  useEffect(() => {
    if (auditPage > pagination.totalPages) {
      setAuditPage(pagination.totalPages);
    }
  }, [auditPage, pagination.totalPages]);

  return {
    auditConsentFilter,
    setAuditConsentFilter,
    auditActorFilter,
    setAuditActorFilter,
    auditSearch,
    setAuditSearch,
    auditPage,
    setAuditPage,
    consentTypeOptions,
    actorTypeOptions,
    filteredAuditLog,
    pagedAuditLog: pagination.paged,
    auditTotalPages: pagination.totalPages,
    auditPageSafe: pagination.pageSafe,
    auditStartIndex: pagination.startIndex,
    auditEndIndex: pagination.endIndex,
  };
}
