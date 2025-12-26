'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  Calendar,
  Settings,
  Play,
  Trash2,
  Edit2,
  CheckCircle,
  AlertTriangle,
  Save,
  X,
  MessageCircle,
  Bell,
  ChevronRight,
} from 'lucide-react';
import type { LineRow, UsageSummary, CallSessionRow } from '~/lib/ultaura/types';
import { updateLine, deleteLine, initiateTestCall } from '~/lib/ultaura/actions';
import { formatTime, getShortLineId } from '~/lib/ultaura';
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
  usage: UsageSummary | null;
  callSessions: CallSessionRow[];
  activeSchedulesCount: number;
  pendingRemindersCount: number;
}

export function LineDetailClient({
  line,
  usage,
  callSessions,
  activeSchedulesCount,
  pendingRemindersCount,
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
    <div className="w-full p-6 pb-12">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/lines"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Lines
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
            <Phone className="w-4 h-4" />
            <span className="font-medium">{formatPhone(line.phone_e164)}</span>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4 text-success" />
              <span className="text-sm text-success">Verified</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              onClick={handleTestCall}
              disabled={isTestCalling}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 w-full sm:w-auto"
            >
              <Play className="w-4 h-4" />
              {isTestCalling ? 'Calling...' : 'Test Call'}
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 w-full sm:w-auto"
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
            href={`/dashboard/lines/${getShortLineId(line.id)}/settings`}
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

          {!isEditingTopics && (
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

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end pt-4 border-t border-border">
              <button
                type="button"
                onClick={cancelEditingTopics}
                disabled={isSavingTopics}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-input text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTopics}
                disabled={isSavingTopics}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSavingTopics ? 'Saving...' : 'Save Changes'}
              </button>
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

      {/* Quick Links */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="space-y-3">
          <Link
            href={`/dashboard/lines/${getShortLineId(line.id)}/schedule`}
            className="flex items-center justify-between p-4 rounded-lg border border-border bg-background hover:bg-muted transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Call Schedules</p>
                <p className="text-sm text-muted-foreground">
                  {activeSchedulesCount === 0
                    ? 'No schedules set up'
                    : `${activeSchedulesCount} active schedule${activeSchedulesCount !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>

          <Link
            href={`/dashboard/lines/${getShortLineId(line.id)}/reminders`}
            className="flex items-center justify-between p-4 rounded-lg border border-border bg-background hover:bg-muted transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Reminders</p>
                <p className="text-sm text-muted-foreground">
                  {pendingRemindersCount === 0
                    ? 'No reminders scheduled'
                    : `${pendingRemindersCount} reminder${pendingRemindersCount !== 1 ? 's' : ''} scheduled`}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        </div>
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
