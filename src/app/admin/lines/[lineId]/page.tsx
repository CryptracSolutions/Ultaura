import Link from 'next/link';

import AdminGuard from '~/app/admin/components/AdminGuard';
import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminBreadcrumbs from '~/app/admin/components/AdminBreadcrumbs';
import { PageBody } from '~/core/ui/Page';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import configuration from '~/configuration';
import {
  writeAdminAuditLog,
  getCurrentAdminContext,
} from '~/lib/ultaura/admin/audit-log';

interface Params {
  params: {
    lineId: string;
  };
}

export const metadata = {
  title: `Line Details | ${configuration.site.siteName}`,
};

async function AdminLineDetailPage({ params }: Params) {
  const lineId = params.lineId;
  const client = getSupabaseServerComponentClient({ admin: true });

  const [lineResult, callSessionsResult] = await Promise.all([
    client
      .from('ultaura_lines')
      .select(
        'id, display_name, phone_e164, status, timezone, quiet_hours_start, quiet_hours_end, do_not_call, voicemail_behavior, account_id, created_at, preferred_grok_voice, inbound_allowed, vacation_ranges, short_id',
      )
      .eq('id', lineId)
      .single(),
    client
      .from('ultaura_call_sessions')
      .select(
        'id, status, direction, started_at, ended_at, seconds_connected, answered_by, end_reason, twilio_call_sid, created_at',
      )
      .eq('line_id', lineId)
      .order('created_at', { ascending: false })
      .limit(10),
    getCurrentAdminContext().then((admin) =>
      admin
        ? writeAdminAuditLog(admin, {
            action: 'admin.view.line',
            targetType: 'line',
            targetId: lineId,
          })
        : undefined,
    ).catch(() => {}),
  ]);

  const line = lineResult.data;

  if (!line) {
    return (
      <div className="flex flex-col flex-1">
        <AdminHeader>Line Not Found</AdminHeader>
        <PageBody>
          <p>No line found with ID: {lineId}</p>
        </PageBody>
      </div>
    );
  }

  const callSessions = callSessionsResult.data ?? [];

  return (
    <div className="flex flex-col flex-1">
      <AdminHeader description="Line configuration and call history">Line Details</AdminHeader>

      <PageBody>
        <div className="flex flex-col space-y-6">
          <AdminBreadcrumbs
            items={[
              { label: 'Account', href: '/admin/accounts/' + line.account_id },
              { label: line.display_name },
            ]}
          />

          {/* Line Info */}
          <div className="rounded-xl bg-card p-5 card-border-accent">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Line Info</h3>

              <div className="inline-flex">
                <LineStatusBadge status={line.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Line ID</span>
                <span className="text-sm text-foreground">{line.id || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Short ID</span>
                <span className="text-sm text-foreground">{line.short_id || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Display Name</span>
                <span className="text-sm text-foreground">{line.display_name || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Phone Number</span>
                <span className="text-sm text-foreground">{line.phone_e164 || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Timezone</span>
                <span className="text-sm text-foreground">{line.timezone || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Preferred Voice</span>
                <span className="text-sm text-foreground">{line.preferred_grok_voice || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Created At</span>
                <span className="text-sm text-foreground">{new Date(line.created_at).toLocaleString()}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Account ID</span>
                <span className="text-sm text-foreground">{line.account_id || '—'}</span>
              </div>
            </div>
          </div>

          {/* Call Configuration */}
          <div className="rounded-xl bg-card p-5 card-border-accent">
            <h3 className="text-lg font-semibold text-foreground mb-4">Call Configuration</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Quiet Hours Start</span>
                <span className="text-sm text-foreground">{line.quiet_hours_start || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Quiet Hours End</span>
                <span className="text-sm text-foreground">{line.quiet_hours_end || '—'}</span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Voicemail Behavior</span>
                <span className="text-sm text-foreground">{line.voicemail_behavior || '—'}</span>
              </div>

              <div className="flex flex-col space-y-1">
                <span className="text-sm font-medium">Inbound Allowed</span>
                <div className="inline-flex pt-2">
                  {line.inbound_allowed ? (
                    <Badge color="success" size="small">
                      Yes
                    </Badge>
                  ) : (
                    <Badge color="normal" size="small">
                      No
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="flex flex-col space-y-1">
                <span className="text-sm font-medium">Do Not Call</span>
                <div className="inline-flex pt-2">
                  {line.do_not_call ? (
                    <Badge color="error" size="small">
                      DNC Active
                    </Badge>
                  ) : (
                    <Badge color="success" size="small">
                      Not DNC
                    </Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <span className="text-sm font-medium">Vacation Ranges</span>
                <div className="pt-2">
                  <pre className="text-xs text-muted-foreground bg-muted rounded p-2 overflow-auto max-h-24">
                    {JSON.stringify(line.vacation_ranges, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Call Sessions */}
          <div className="rounded-xl bg-card p-5 card-border-accent">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Recent Call Sessions ({callSessions.length})
            </h3>

            {callSessions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Answered By</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>End Reason</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {callSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <span
                          className="text-xs font-mono"
                          title={session.id}
                        >
                          {session.id.slice(0, 8)}...
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="inline-flex">
                          <Badge
                            color={
                              session.direction === 'outbound'
                                ? 'info'
                                : 'normal'
                            }
                            size="small"
                          >
                            {session.direction}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="inline-flex">
                          <CallStatusBadge status={session.status} />
                        </div>
                      </TableCell>

                      <TableCell>
                        {session.answered_by ?? '-'}
                      </TableCell>

                      <TableCell>
                        {session.seconds_connected != null
                          ? formatDuration(session.seconds_connected)
                          : '-'}
                      </TableCell>

                      <TableCell>
                        <span className="text-xs">
                          {session.end_reason ?? '-'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs">
                          {new Date(session.created_at).toLocaleString()}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No call sessions found for this line.
              </p>
            )}
          </div>

          {/* Quick Links */}
          <div className="rounded-xl bg-card p-5 card-border-accent">
            <h3 className="text-lg font-semibold text-foreground mb-4">Quick Links</h3>

            <div className="flex space-x-3">
              <Button variant="outline" size="small">
                <Link href={`/admin/accounts/${line.account_id}`}>
                  View Parent Account
                </Link>
              </Button>

              <Button variant="outline" size="small">
                <Link href={`/admin/timeline?lineId=${lineId}`}>
                  View Timeline
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(AdminLineDetailPage);

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins === 0) {
    return `${secs}s`;
  }

  return `${mins}m ${secs}s`;
}

function LineStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <Badge color="success" size="small">
          Active
        </Badge>
      );
    case 'paused':
      return (
        <Badge color="warn" size="small">
          Paused
        </Badge>
      );
    case 'disabled':
      return (
        <Badge color="error" size="small">
          Disabled
        </Badge>
      );
    default:
      return (
        <Badge color="normal" size="small">
          {status}
        </Badge>
      );
  }
}

function CallStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <Badge color="success" size="small">
          Completed
        </Badge>
      );
    case 'in_progress':
      return (
        <Badge color="info" size="small">
          In Progress
        </Badge>
      );
    case 'ringing':
      return (
        <Badge color="info" size="small">
          Ringing
        </Badge>
      );
    case 'failed':
      return (
        <Badge color="error" size="small">
          Failed
        </Badge>
      );
    case 'canceled':
      return (
        <Badge color="warn" size="small">
          Canceled
        </Badge>
      );
    case 'created':
      return (
        <Badge color="normal" size="small">
          Created
        </Badge>
      );
    default:
      return (
        <Badge color="normal" size="small">
          {status}
        </Badge>
      );
  }
}
