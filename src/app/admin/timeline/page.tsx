import { Metadata } from 'next';

import AdminGuard from '~/app/admin/components/AdminGuard';
import AdminHeader from '~/app/admin/components/AdminHeader';
import { PageBody } from '~/core/ui/Page';
import Alert from '~/core/ui/Alert';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getPageFromQueryParams from '~/app/admin/utils/get-page-from-query-param';
import configuration from '~/configuration';
import getLogger from '~/core/logger';

import {
  aggregateTimeline,
  type TimelineFilter,
  type TimelineSource,
  type RedactionMode,
} from '~/lib/ultaura/admin/timeline-aggregator';
import { applyRedaction } from '~/lib/ultaura/admin/timeline-redaction';

import TimelineView from './components/TimelineView';

export const metadata: Metadata = {
  title: `Case Timeline | ${configuration.site.siteName}`,
};

const PER_PAGE = 50;

const VALID_SOURCES: Set<string> = new Set([
  'call_session',
  'call_event',
  'safety_event',
  'reminder',
  'schedule_event',
  'opt_out',
  'trusted_contact',
  'notification_recipient',
  'data_export',
  'consent_audit',
  'telephony_event',
]);

const VALID_REDACTION_MODES: Set<string> = new Set([
  'admin_full',
  'payer_simulated',
  'recipient_simulated',
]);

interface TimelinePageProps {
  searchParams: {
    userId?: string;
    orgId?: string;
    accountId?: string;
    lineId?: string;
    types?: string;
    page?: string;
    redaction?: string;
  };
}

async function TimelinePage({ searchParams }: TimelinePageProps) {
  const logger = getLogger();
  const page = getPageFromQueryParams(searchParams.page);
  const offset = (page - 1) * PER_PAGE;

  const redactionMode = parseRedactionMode(searchParams.redaction);
  const validSources = parseSources(searchParams.types);

  // Resolve filter context
  let accountIds: string[] = [];
  let lineIds: string[] = [];
  let filterContext = '';
  let resolveError: string | null = null;

  try {
    const resolved = await resolveFilterContext(searchParams);
    accountIds = resolved.accountIds;
    lineIds = resolved.lineIds;
    filterContext = resolved.description;
  } catch (err) {
    logger.error({ err }, 'Failed to resolve timeline filter context');
    resolveError =
      err instanceof Error
        ? err.message
        : 'Failed to resolve filter context.';
  }

  // Build timeline filter
  const filter: TimelineFilter = {
    accountIds: accountIds.length > 0 ? accountIds : undefined,
    lineIds: lineIds.length > 0 ? lineIds : undefined,
    sources: validSources.length > 0 ? validSources : undefined,
  };

  let entries: Awaited<ReturnType<typeof aggregateTimeline>>['entries'] = [];
  let total = 0;
  let fetchError: string | null = null;

  if (!resolveError) {
    try {
      const result = await aggregateTimeline(filter);
      const redactedEntries = applyRedaction(result.entries, redactionMode);
      total = redactedEntries.length;
      entries = redactedEntries.slice(offset, offset + PER_PAGE);
    } catch (err) {
      logger.error({ err }, 'Failed to aggregate timeline');
      fetchError =
        err instanceof Error
          ? err.message
          : 'Failed to load timeline entries.';
    }
  }

  const displayError = resolveError ?? fetchError;

  return (
    <div className="flex flex-1 flex-col">
      <AdminHeader>Case Timeline</AdminHeader>

      <PageBody>
        <div className="flex flex-col gap-6 pb-12">
          <div className="text-sm text-muted-foreground">
            Unified timeline of all events across Ultaura tables.
            {filterContext && (
              <span className="ml-1 font-medium text-foreground">
                Filtered by: {filterContext}
              </span>
            )}
            {!filterContext &&
              !searchParams.userId &&
              !searchParams.orgId &&
              !searchParams.accountId &&
              !searchParams.lineId && (
                <span className="ml-1">
                  Showing all entries. Use query params (userId, orgId,
                  accountId, lineId) to filter.
                </span>
              )}
          </div>

          {displayError && (
            <Alert type="error">
              <Alert.Heading>Error</Alert.Heading>
              <p>{displayError}</p>
            </Alert>
          )}

          {!displayError && (
            <TimelineView
              entries={entries}
              total={total}
              page={page}
              perPage={PER_PAGE}
              currentSources={validSources}
              currentRedactionMode={redactionMode}
            />
          )}
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(TimelinePage);

// ---------------------------------------------------------------------------
// Filter context resolution
// ---------------------------------------------------------------------------

interface ResolvedContext {
  accountIds: string[];
  lineIds: string[];
  description: string;
}

async function resolveFilterContext(
  params: TimelinePageProps['searchParams'],
): Promise<ResolvedContext> {
  const client = getSupabaseServerComponentClient({ admin: true });
  const descriptions: string[] = [];

  let accountIds: string[] = [];
  let lineIds: string[] = [];

  // Direct accountId filter
  if (params.accountId) {
    accountIds.push(params.accountId);
    descriptions.push(`account ${truncateId(params.accountId)}`);
  }

  // Direct lineId filter
  if (params.lineId) {
    lineIds.push(params.lineId);
    descriptions.push(`line ${truncateId(params.lineId)}`);
  }

  // Resolve userId -> find their organizations -> find accounts under those orgs
  if (params.userId) {
    const { data: memberships } = await client
      .from('memberships')
      .select('organization_id')
      .eq('user_id', params.userId);

    if (memberships && memberships.length > 0) {
      const orgIds = memberships.map(
        (m: { organization_id: number }) => m.organization_id,
      );

      const { data: accounts } = await client
        .from('ultaura_accounts')
        .select('id')
        .in('organization_id', orgIds);

      if (accounts && accounts.length > 0) {
        const ids = accounts.map((a: { id: string }) => a.id);
        accountIds = mergeUniqueIds(accountIds, ids);
      }
    }

    descriptions.push(`user ${truncateId(params.userId)}`);
  }

  // Resolve orgId -> find accounts under that org
  if (params.orgId) {
    const orgIdNum = parseInt(params.orgId, 10);

    if (!Number.isNaN(orgIdNum)) {
      const { data: accounts } = await client
        .from('ultaura_accounts')
        .select('id')
        .eq('organization_id', orgIdNum);

      if (accounts && accounts.length > 0) {
        const ids = accounts.map((a: { id: string }) => a.id);
        accountIds = mergeUniqueIds(accountIds, ids);
      }
    }

    descriptions.push(`org ${params.orgId}`);
  }

  return {
    accountIds,
    lineIds,
    description: descriptions.join(', '),
  };
}

function parseRedactionMode(mode: string | undefined): RedactionMode {
  if (mode && VALID_REDACTION_MODES.has(mode)) {
    return mode as RedactionMode;
  }

  return 'admin_full';
}

function parseSources(types: string | undefined): TimelineSource[] {
  const sources = types?.split(',').filter(Boolean) ?? [];
  return sources.filter((source) => VALID_SOURCES.has(source)) as TimelineSource[];
}

function mergeUniqueIds(existing: string[], incoming: string[]): string[] {
  return Array.from(new Set([...existing, ...incoming]));
}

function truncateId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...`;
}
