import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

import AdminGuard from '~/app/admin/components/AdminGuard';
import AdminHeader from '~/app/admin/components/AdminHeader';
import { PageBody } from '~/core/ui/Page';
import Tile from '~/core/ui/Tile';
import Heading from '~/core/ui/Heading';
import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';

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
      <AdminHeader>Line Details</AdminHeader>

      <PageBody>
        <div className="flex flex-col space-y-6">
          <Breadcrumbs displayName={line.display_name} />

          {/* Line Info */}
          <Tile>
            <div className="flex items-center justify-between">
              <Heading type={4}>Line Info</Heading>

              <div className="inline-flex">
                <LineStatusBadge status={line.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextFieldLabel>
                Line ID
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={line.id}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Short ID
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={line.short_id}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Display Name
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={line.display_name}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Phone Number
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={line.phone_e164}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Timezone
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={line.timezone}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Preferred Voice
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={line.preferred_grok_voice}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Created At
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={new Date(line.created_at).toLocaleString()}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Account ID
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={line.account_id}
                  disabled
                />
              </TextFieldLabel>
            </div>
          </Tile>

          {/* Call Configuration */}
          <Tile>
            <Heading type={4}>Call Configuration</Heading>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TextFieldLabel>
                Quiet Hours Start
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={line.quiet_hours_start}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Quiet Hours End
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={line.quiet_hours_end}
                  disabled
                />
              </TextFieldLabel>

              <TextFieldLabel>
                Voicemail Behavior
                <TextFieldInput
                  className="max-w-full"
                  defaultValue={line.voicemail_behavior}
                  disabled
                />
              </TextFieldLabel>

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
          </Tile>

          {/* Recent Call Sessions */}
          <Tile>
            <Heading type={4}>
              Recent Call Sessions ({callSessions.length})
            </Heading>

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
          </Tile>

          {/* Quick Links */}
          <Tile>
            <Heading type={4}>Quick Links</Heading>

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
          </Tile>
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

function Breadcrumbs({ displayName }: { displayName: string }) {
  return (
    <div className="flex space-x-1 items-center text-xs p-2">
      <Link href="/admin">Admin</Link>
      <ChevronRightIcon className="w-3" />
      <span>Lines</span>
      <ChevronRightIcon className="w-3" />
      <span>{displayName}</span>
    </div>
  );
}
