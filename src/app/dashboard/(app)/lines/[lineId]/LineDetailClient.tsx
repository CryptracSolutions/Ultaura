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
  Save,
  X,
  MessageCircle,
  Bell,
} from 'lucide-react';
import type { LineRow, ScheduleRow, UsageSummary, CallSessionRow } from '~/lib/ultaura/types';
import type { ReminderRow } from '~/lib/ultaura/actions';
import { updateLine, deleteLine, deleteSchedule, initiateTestCall } from '~/lib/ultaura/actions';
import { DAYS_OF_WEEK, formatTime } from '~/lib/ultaura/constants';
import { CallActivityList } from './components/CallActivityList';

const MAX_INTEREST_TOPICS = 5;

// Curated topics that tend to work well for 60+ conversation starters
const INTEREST_TOPIC_OPTIONS = [
  'Family',
  'Grandkids',
  'Friends',
  'Memories',
  'Hometown',
  'Holidays',
  'Cooking',
  'Baking',
  'Gardening',
  'Music',
  'Movies',
  'TV shows',
  'Reading',
  'Faith / spirituality',
  'Pets',
  'Sports',
  'Travel',
  'History',
  'Nature',
  'Games & puzzles',
  'Hobbies & crafts',
  'Community events',
];

interface LineDetailClientProps {
  line: LineRow;
  schedules: ScheduleRow[];
  usage: UsageSummary | null;
  callSessions: CallSessionRow[];
  pendingRemindersCount: number;
  nextReminder: ReminderRow | null;
}

export function LineDetailClient({
  line,
  schedules,
  usage,
  callSessions,
  pendingRemindersCount,
  nextReminder,
}: LineDetailClientProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTestCalling, setIsTestCalling] = useState(false);
  const [isEditingTopics, setIsEditingTopics] = useState(false);
  const [isSavingTopics, setIsSavingTopics] = useState(false);
  const [topicChips, setTopicChips] = useState<string[]>([]);
  const [topicCustom, setTopicCustom] = useState('');
  const [avoidTopicsText, setAvoidTopicsText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const normalizeTopic = (topic: string) => topic.trim();

  const parseTopics = (raw: string) =>
    raw
      .split(',')
      .map(normalizeTopic)
      .filter(Boolean);

  const dedupeTopics = (topics: string[]) => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const topic of topics) {
      const normalized = normalizeTopic(topic);
      if (!normalized) continue;

      const key = normalized.toLowerCase();
      if (seen.has(key)) continue;

      seen.add(key);
      result.push(normalized);
    }

    return result;
  };

  const combinedTopics = dedupeTopics([...topicChips, ...parseTopics(topicCustom)]).slice(
    0,
    MAX_INTEREST_TOPICS,
  );

  const topicsSelectedCount = combinedTopics.length;
  const customDisabled = topicChips.length >= MAX_INTEREST_TOPICS;

  const formatPhone = (e164: string) => {
    const digits = e164.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return e164;
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this line? This cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      const result = await deleteLine(line.id);
      if (result.success) {
        router.push('/dashboard/lines');
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

  const startEditingTopics = () => {
    const interests = line.seed_interests ?? [];
    const avoid = line.seed_avoid_topics ?? [];

    const curatedSet = new Set(INTEREST_TOPIC_OPTIONS);
    const selected = interests.filter((t) => curatedSet.has(t));
    const custom = interests.filter((t) => !curatedSet.has(t));

    setTopicChips(dedupeTopics(selected).slice(0, MAX_INTEREST_TOPICS));
    setTopicCustom(custom.join(', '));
    setAvoidTopicsText(avoid.join(', '));
    setIsEditingTopics(true);
    setError(null);
  };

  const cancelEditingTopics = () => {
    setIsEditingTopics(false);
    setIsSavingTopics(false);
    setError(null);
  };

  const toggleTopic = (topic: string) => {
    setTopicChips((prev) => {
      const exists = prev.includes(topic);
      if (exists) return prev.filter((t) => t !== topic);
      if (combinedTopics.length >= MAX_INTEREST_TOPICS) return prev;
      return [...prev, topic];
    });
  };

  const saveTopics = async () => {
    setIsSavingTopics(true);
    setError(null);

    const seedInterests = combinedTopics;
    const seedAvoidTopics = dedupeTopics(parseTopics(avoidTopicsText));

    try {
      const result = await updateLine(line.id, {
        seedInterests,
        seedAvoidTopics,
      });

      if (!result.success) {
        setError(result.error || 'Failed to update topics');
        return;
      }

      setIsEditingTopics(false);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSavingTopics(false);
    }
  };

  return (
    <div className="w-full p-6">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/lines"
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
            href={`/dashboard/lines/${line.id}/settings`}
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

      {/* Conversation Topics Card */}
      <div className="bg-card rounded-xl border border-border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Conversation topics</h2>
          </div>

          {isEditingTopics ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEditingTopics}
                disabled={isSavingTopics}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-input text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTopics}
                disabled={isSavingTopics}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSavingTopics ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditingTopics}
              className="text-sm text-primary hover:underline inline-flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>

        {isEditingTopics ? (
          <div className="space-y-6">
            {/* Enjoy topics */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm font-medium text-foreground">
                  Topics they enjoy
                </div>
                <div className="text-xs text-muted-foreground">
                  Selected: {topicsSelectedCount}/{MAX_INTEREST_TOPICS}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {INTEREST_TOPIC_OPTIONS.map((topic) => {
                  const isSelected = topicChips.includes(topic);
                  const disabled =
                    !isSelected && combinedTopics.length >= MAX_INTEREST_TOPICS;

                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      disabled={disabled}
                      className={[
                        'rounded-full border px-3 py-1 text-sm transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-foreground hover:bg-muted',
                        disabled ? 'opacity-50 cursor-not-allowed' : '',
                      ].join(' ')}
                    >
                      {topic}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">
                  Other topics (comma-separated)
                </label>
                <input
                  value={topicCustom}
                  onChange={(e) => setTopicCustom(e.target.value)}
                  placeholder="e.g., baseball, baking, church"
                  disabled={customDisabled}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
                {customDisabled ? (
                  <p className="text-xs text-muted-foreground">
                    Remove a selected topic to add a custom one.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    We'll save up to {MAX_INTEREST_TOPICS} total topics.
                  </p>
                )}
              </div>
            </div>

            {/* Avoid topics */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                Topics to avoid
              </div>
              <textarea
                value={avoidTopicsText}
                onChange={(e) => setAvoidTopicsText(e.target.value)}
                placeholder="e.g., politics, health issues..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Separate topics with commas.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">Topics they enjoy</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(line.seed_interests ?? []).length ? (
                  (line.seed_interests ?? []).map((topic) => (
                    <span
                      key={topic}
                      className="inline-flex items-center rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-xs text-primary"
                    >
                      {topic}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">None yet</span>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-muted-foreground">Topics to avoid</div>
              <div className="mt-2 text-sm text-foreground">
                {(line.seed_avoid_topics ?? []).length
                  ? (line.seed_avoid_topics ?? []).join(', ')
                  : 'None'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Schedules Card */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Call Schedules</h2>
          </div>
          <Link
            href={`/dashboard/lines/${line.id}/schedule`}
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
              href={`/dashboard/lines/${line.id}/schedule`}
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <Plus className="w-4 h-4" />
              Create your first schedule
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {activeSchedules.map((schedule) => (
              <ScheduleRowItem
                key={schedule.id}
                schedule={schedule}
                onDelete={() => handleDeleteSchedule(schedule.id)}
                lineId={line.id}
              />
            ))}
            {inactiveSchedules.length > 0 && (
              <>
                <div className="border-t border-border pt-4 mt-4">
                  <p className="text-sm text-muted-foreground mb-3">Inactive Schedules</p>
                </div>
                {inactiveSchedules.map((schedule) => (
                  <ScheduleRowItem
                    key={schedule.id}
                    schedule={schedule}
                    onDelete={() => handleDeleteSchedule(schedule.id)}
                    lineId={line.id}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Reminders Card */}
      <div className="bg-card rounded-xl border border-border p-6 mt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Reminders</h2>
            {pendingRemindersCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {pendingRemindersCount} scheduled
              </span>
            )}
          </div>
          <Link
            href={`/dashboard/lines/${line.id}/reminders`}
            className="inline-flex items-center gap-2 text-sm bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Reminder
          </Link>
        </div>

        {nextReminder ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-border bg-background">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">Next Reminder</p>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {nextReminder.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(nextReminder.due_at).toLocaleString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      timeZone: line.timezone,
                    })}
                  </p>
                </div>
              </div>
            </div>
            {pendingRemindersCount > 1 && (
              <Link
                href={`/dashboard/lines/${line.id}/reminders`}
                className="block text-center text-sm text-primary hover:underline"
              >
                View all {pendingRemindersCount} scheduled reminders
              </Link>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No reminders scheduled</p>
            <Link
              href={`/dashboard/lines/${line.id}/reminders`}
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <Plus className="w-4 h-4" />
              Create a reminder
            </Link>
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

interface ScheduleRowItemProps {
  schedule: ScheduleRow;
  onDelete: () => void;
  lineId: string;
}

function ScheduleRowItem({ schedule, onDelete, lineId }: ScheduleRowItemProps) {
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
          href={`/dashboard/lines/${lineId}/schedule/${schedule.id}`}
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
