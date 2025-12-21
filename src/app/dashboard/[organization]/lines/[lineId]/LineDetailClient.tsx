'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  Calendar,
  Clock,
  Settings,
  Play,
  Trash2,
  Edit2,
  Plus,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import type { LineRow, ScheduleRow, UsageSummary, CallSessionRow } from '~/lib/ultaura/types';
import { updateLine, deleteLine, deleteSchedule, initiateTestCall } from '~/lib/ultaura/actions';
import { DAYS_OF_WEEK } from '~/lib/ultaura/constants';
import { CallActivityList } from './components/CallActivityList';

interface LineDetailClientProps {
  line: LineRow;
  schedules: ScheduleRow[];
  usage: UsageSummary | null;
  callSessions: CallSessionRow[];
  organizationSlug: string;
}

export function LineDetailClient({
  line,
  schedules,
  usage,
  callSessions,
  organizationSlug,
}: LineDetailClientProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTestCalling, setIsTestCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPhone = (e164: string) => {
    const digits = e164.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return e164;
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this line? This cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteLine(line.id);
      if (result.success) {
        router.push(`/dashboard/${organizationSlug}/lines`);
      } else {
        setError(result.error || 'Failed to delete line');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestCall = async () => {
    if (!usage || usage.minutesRemaining <= 0) {
      setError('No minutes remaining. Please upgrade your plan.');
      return;
    }

    setIsTestCalling(true);
    setError(null);
    try {
      const result = await initiateTestCall(line.id);
      if (!result.success) {
        setError(result.error || 'Failed to initiate test call');
      }
    } catch {
      setError('Failed to initiate test call');
    } finally {
      setIsTestCalling(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Delete this schedule?')) return;

    try {
      const result = await deleteSchedule(scheduleId);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Failed to delete schedule');
      }
    } catch {
      setError('An unexpected error occurred');
    }
  };

  const activeSchedules = schedules.filter((s) => s.enabled);
  const inactiveSchedules = schedules.filter((s) => !s.enabled);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/dashboard/${organizationSlug}/lines`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lines
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{line.display_name}</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Phone className="w-4 h-4" />
              {formatPhone(line.phone_e164)}
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-sm text-success">Verified</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestCall}
              disabled={isTestCalling}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {isTestCalling ? 'Calling...' : 'Test Call'}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Settings Card */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Line Settings</h2>
          </div>
          <Link
            href={`/dashboard/${organizationSlug}/lines/${line.id}/settings`}
            className="text-sm text-primary hover:underline"
          >
            Edit
          </Link>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted-foreground">Timezone</dt>
            <dd className="text-foreground">{line.timezone}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Language</dt>
            <dd className="text-foreground capitalize">{line.preferred_language}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Quiet Hours</dt>
            <dd className="text-foreground">
              {formatTime(line.quiet_hours_start)} - {formatTime(line.quiet_hours_end)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Status</dt>
            <dd>
              <span
                className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  line.status === 'active'
                    ? 'bg-success/10 text-success'
                    : line.status === 'paused'
                    ? 'bg-warning/10 text-warning'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {line.status.charAt(0).toUpperCase() + line.status.slice(1)}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Schedules Card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Call Schedules</h2>
          </div>
          <Link
            href={`/dashboard/${organizationSlug}/lines/${line.id}/schedule`}
            className="inline-flex items-center gap-2 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Schedule
          </Link>
        </div>

        {schedules.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No schedules set up yet</p>
            <Link
              href={`/dashboard/${organizationSlug}/lines/${line.id}/schedule`}
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <Plus className="w-4 h-4" />
              Create your first schedule
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activeSchedules.map((schedule) => (
              <ScheduleRow
                key={schedule.id}
                schedule={schedule}
                onDelete={() => handleDeleteSchedule(schedule.id)}
                organizationSlug={organizationSlug}
                lineId={line.id}
              />
            ))}
            {inactiveSchedules.length > 0 && (
              <>
                <div className="border-t border-border pt-4 mt-4">
                  <p className="text-sm text-muted-foreground mb-3">Inactive Schedules</p>
                </div>
                {inactiveSchedules.map((schedule) => (
                  <ScheduleRow
                    key={schedule.id}
                    schedule={schedule}
                    onDelete={() => handleDeleteSchedule(schedule.id)}
                    organizationSlug={organizationSlug}
                    lineId={line.id}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Call History Card */}
      <div className="bg-card rounded-xl border border-border p-6 mt-6">
        <div className="flex items-center gap-2 mb-6">
          <Phone className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Recent Calls</h2>
        </div>
        <CallActivityList sessions={callSessions} />
      </div>
    </div>
  );
}

interface ScheduleRowProps {
  schedule: ScheduleRow;
  onDelete: () => void;
  organizationSlug: string;
  lineId: string;
}

function ScheduleRow({ schedule, onDelete, organizationSlug, lineId }: ScheduleRowProps) {
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const daysDisplay = schedule.days_of_week
    .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.short || d)
    .join(', ');

  return (
    <div
      className={`flex items-center justify-between p-4 rounded-lg border ${
        schedule.enabled ? 'border-border bg-background' : 'border-border/50 bg-muted/50'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            schedule.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          }`}
        >
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className={`font-medium ${schedule.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
            {formatTime(schedule.time_of_day)}
          </p>
          <p className="text-sm text-muted-foreground">{daysDisplay}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/${organizationSlug}/lines/${lineId}/schedule/${schedule.id}`}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <Edit2 className="w-4 h-4 text-muted-foreground" />
        </Link>
        <button onClick={onDelete} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors">
          <Trash2 className="w-4 h-4 text-destructive" />
        </button>
      </div>
    </div>
  );
}
