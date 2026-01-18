'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
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
  Gift,
  Users,
} from 'lucide-react';
import type {
  LineRow,
  UsageSummary,
  CallSessionRow,
  RetentionMetrics,
  CallPreview,
  StoryArc,
  SegmentStats,
} from '~/lib/ultaura/types';
import { updateLine, deleteLine } from '~/lib/ultaura/lines';
import { initiateTestCall } from '~/lib/ultaura/usage';
import { formatTime } from '~/lib/ultaura/constants';
import { CallActivityList } from './components/CallActivityList';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { RadioGroup, RadioGroupItem, RadioGroupItemLabel } from '~/core/ui/RadioGroup';

const MAX_INTEREST_TOPICS = 5;

const METRIC_CARD_CLASS = 'rounded-lg border border-border bg-muted/40 p-4';
const CARD_CLASS = 'bg-card rounded-xl border border-border p-6';
const CARD_HEADER_CLASS = 'flex items-center gap-2';
const BTN_PRIMARY_CLASS = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_OUTLINE_CLASS = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-input text-foreground hover:bg-muted transition-colors disabled:opacity-50';
const QUICK_LINK_CLASS = 'flex items-center justify-between p-4 rounded-lg border border-border bg-background hover:bg-muted transition-colors group';

interface MetricCardProps {
  label: string;
  value: string;
  large?: boolean;
}

function MetricCard({ label, value, large = false }: MetricCardProps): JSX.Element {
  return (
    <div className={METRIC_CARD_CLASS}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-semibold text-foreground ${large ? 'text-lg' : 'text-sm'} capitalize`}>
        {value}
      </div>
    </div>
  );
}

interface QuickLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  count: number;
  zeroLabel: string;
  itemLabel: string;
}

function QuickLink({ href, icon, title, count, zeroLabel, itemLabel }: QuickLinkProps): JSX.Element {
  const description = count === 0
    ? zeroLabel
    : `${count} ${itemLabel}${count !== 1 ? 's' : ''}`;

  return (
    <Link href={href} className={QUICK_LINK_CLASS}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
    </Link>
  );
}

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
  milestonesCount: number;
  trustedContactsCount: number;
  retentionMetrics: RetentionMetrics;
  previewHistory: CallPreview[];
  storyArcs: StoryArc[];
  segmentStats: SegmentStats;
  isReadOnly?: boolean;
  isTrialActive?: boolean;
}

export function LineDetailClient({
  line,
  usage,
  callSessions,
  activeSchedulesCount,
  pendingRemindersCount,
  milestonesCount,
  trustedContactsCount,
  retentionMetrics,
  previewHistory,
  storyArcs,
  segmentStats,
  isReadOnly = false,
  isTrialActive = false,
}: LineDetailClientProps) {
  const router = useRouter();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isTestCalling, setIsTestCalling] = useState(false);
  const [isEditingTopics, setIsEditingTopics] = useState(false);
  const [isSavingTopics, setIsSavingTopics] = useState(false);
  const [topicChips, setTopicChips] = useState<string[]>([]);
  const [topicCustom, setTopicCustom] = useState('');
  const [avoidTopicsText, setAvoidTopicsText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [testCallMode, setTestCallMode] = useState<'quick' | 'preview'>('quick');

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

  const favoriteSegments = Object.entries(segmentStats.byType)
    .filter(([, stats]) => stats.count > 0)
    .map(([type, stats]) => ({
      type: type.replace(/_/g, ' '),
      score: stats.enjoymentRate,
      count: stats.count,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.count - a.count;
    })
    .slice(0, 3)
    .map((entry) => entry.type);

  const preferredSegmentLabel = retentionMetrics.preferredSegmentType
    ? retentionMetrics.preferredSegmentType.replace(/_/g, ' ')
    : 'None yet';

  const formatPreviewDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  function getPreviewStatusLabel(preview: CallPreview): string {
    if (preview.followThroughResponse === 'engaged') return 'Engaged';
    if (preview.followThroughResponse === 'redirected') return 'Redirected';
    if (preview.status === 'declined') return 'Declined';
    if (preview.status === 'expired') return 'Expired';
    if (preview.status === 'used') return 'Used';
    return 'Pending';
  }

  function getStatusBadgeClass(status: string): string {
    if (status === 'active') return 'bg-success/10 text-success';
    if (status === 'paused') return 'bg-warning/10 text-warning';
    return 'bg-muted text-muted-foreground';
  }

  function getFeatureBadgeClass(enabled: boolean): string {
    return enabled
      ? 'bg-primary/10 text-primary'
      : 'bg-muted text-muted-foreground';
  }

  const handleDelete = async () => {
    if (isReadOnly) return;

    const result = await deleteLine(line.id);
    if (!result.success) {
      toast.error(result.error.message || 'Failed to delete line');
      throw new Error('Delete failed');
    }
    toast.success('Line deleted');
    router.push('/dashboard/lines');
  };

  const handleTestCall = async () => {
    if (isReadOnly) {
      setError('Your trial has ended. Subscribe to continue.');
      return;
    }

    if (!isTrialActive && (!usage || (usage.minutesRemaining <= 0 && usage.minutesIncluded > 0))) {
      setError('No minutes remaining. Please upgrade your plan.');
      return;
    }

    setIsTestCalling(true);
    setError(null);
    try {
      const result = await initiateTestCall(line.id, { isPreviewMode: testCallMode === 'preview' });
      if (!result.success) {
        setError(result.error.message || 'Failed to initiate test call');
      }
    } catch {
      setError('Failed to initiate test call');
    } finally {
      setIsTestCalling(false);
    }
  };

  const startEditingTopics = () => {
    if (isReadOnly) return;

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
    if (isReadOnly) return;

    setTopicChips((prev) => {
      const exists = prev.includes(topic);
      if (exists) return prev.filter((t) => t !== topic);
      if (combinedTopics.length >= MAX_INTEREST_TOPICS) return prev;
      return [...prev, topic];
    });
  };

  const saveTopics = async () => {
    if (isReadOnly) return;

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
        setError(result.error.message || 'Failed to update topics');
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
              disabled={isReadOnly || isTestCalling}
              className={`${BTN_PRIMARY_CLASS} w-full sm:w-auto`}
            >
              <Play className="w-4 h-4" />
              {isTestCalling ? 'Calling...' : 'Test Call'}
            </button>
            <button
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isReadOnly}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
            >
              <Trash2 className="w-4 h-4" />
              Delete
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

      <div className="mb-6 rounded-xl border border-border bg-card p-6">
        <div className="text-sm font-semibold text-foreground mb-2">Test Call Options</div>
        <p className="text-xs text-muted-foreground mb-4">
          Choose how much of the experience to preview.
        </p>
        <RadioGroup
          value={testCallMode}
          onValueChange={(value) => setTestCallMode(value as 'quick' | 'preview')}
        >
          <RadioGroupItemLabel>
            <RadioGroupItem value="quick" />
            <div>
              <div className="text-sm font-medium text-foreground">Quick Test</div>
              <div className="text-xs text-muted-foreground">
                Test audio and connection only. No disclosures.
              </div>
            </div>
          </RadioGroupItemLabel>
          <RadioGroupItemLabel>
            <RadioGroupItem value="preview" />
            <div>
              <div className="text-sm font-medium text-foreground">Preview Full Experience</div>
              <div className="text-xs text-muted-foreground">
                Hear the complete first-call flow including disclosures.
              </div>
            </div>
          </RadioGroupItemLabel>
        </RadioGroup>
      </div>

      {/* Settings Card */}
      <div className={`${CARD_CLASS} mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className={CARD_HEADER_CLASS}>
            <Settings className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Line Settings</h2>
          </div>
          <Link
            href={`/dashboard/lines/${line.short_id}/settings`}
            className="text-sm text-primary hover:underline"
          >
            {isReadOnly ? 'View' : 'Edit'}
          </Link>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted-foreground">Timezone</dt>
            <dd className="text-foreground">{line.timezone}</dd>
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
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(line.status)}`}>
                {line.status.charAt(0).toUpperCase() + line.status.slice(1)}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      {/* Conversation Topics Card */}
      <div className={`${CARD_CLASS} mb-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className={CARD_HEADER_CLASS}>
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Conversation topics</h2>
          </div>

          {!isEditingTopics && !isReadOnly && (
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
                    isReadOnly || (!isSelected && combinedTopics.length >= MAX_INTEREST_TOPICS);

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
                  disabled={customDisabled || isReadOnly}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
                />
                {customDisabled ? (
                  <p className="text-xs text-muted-foreground">
                    Remove a selected topic to add a custom one.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll save up to {MAX_INTEREST_TOPICS} total topics.
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
                disabled={isReadOnly}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none disabled:opacity-50"
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
                className={`${BTN_OUTLINE_CLASS} w-full sm:w-auto`}
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTopics}
                disabled={isSavingTopics || isReadOnly}
                className={`${BTN_PRIMARY_CLASS} w-full sm:w-auto`}
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
                {line.seed_interests?.length ? (
                  line.seed_interests.map((topic) => (
                    <span key={topic} className="inline-flex items-center rounded-full border border-primary/10 bg-primary/10 px-3 py-1 text-xs text-primary">
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
                {line.seed_avoid_topics?.length ? line.seed_avoid_topics.join(', ') : 'None'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Engagement Features Card */}
      <div className={`${CARD_CLASS} mb-6`}>
        <div className={`${CARD_HEADER_CLASS} mb-4`}>
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Engagement features</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <MetricCard label="Preview follow-through" value={`${retentionMetrics.callPreviewFollowThrough}%`} large />
          <MetricCard label="Segment completion" value={`${retentionMetrics.segmentCompletionRate}%`} large />
          <MetricCard label="Preferred segment" value={preferredSegmentLabel} />
          <MetricCard
            label="Avg segment duration"
            value={retentionMetrics.averageSegmentDuration ? `${retentionMetrics.averageSegmentDuration}s` : 'N/A'}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Favorite segments</div>
            <div className="text-sm font-medium text-foreground mt-1 capitalize">
              {favoriteSegments.length ? favoriteSegments.join(', ') : 'None yet'}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Features enabled</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(['callPreview', 'segments', 'stories'] as const).map((feature) => (
                <span
                  key={feature}
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getFeatureBadgeClass(retentionMetrics.featureEnrollment[feature])}`}
                >
                  {feature === 'callPreview' ? 'Call preview' : feature.charAt(0).toUpperCase() + feature.slice(1)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="text-xs text-muted-foreground">Active story arcs</div>
          {storyArcs.length > 0 ? (
            <div className="mt-2 space-y-2">
              {storyArcs.map((arc) => (
                <div key={arc.id} className={`${METRIC_CARD_CLASS.replace('p-4', 'p-3')}`}>
                  <div className="text-sm font-medium text-foreground">{arc.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Chapter {arc.currentChapter}/{arc.totalChapters}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground mt-1">No active stories</div>
          )}
        </div>
      </div>

      {/* Call Preview History */}
      <div className={`${CARD_CLASS} mb-6`}>
        <div className={`${CARD_HEADER_CLASS} mb-4`}>
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Call preview history</h2>
        </div>

        {previewHistory.length > 0 ? (
          <div className="divide-y divide-border">
            {previewHistory.map((preview) => (
              <div key={preview.id} className="flex items-center justify-between py-3 gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{preview.topicDisplay}</div>
                  <div className="text-xs text-muted-foreground">
                    {preview.topicType.replace(/_/g, ' ')} · {formatPreviewDate(preview.createdAt)}
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground">{getPreviewStatusLabel(preview)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No previews yet</div>
        )}
      </div>

      {/* Quick Links */}
      <div className={CARD_CLASS}>
        <div className="space-y-3">
          <QuickLink
            href={`/dashboard/lines/${line.short_id}/schedule`}
            icon={<Calendar className="w-5 h-5 text-primary" />}
            title="Call Schedules"
            count={activeSchedulesCount}
            zeroLabel="No schedules set up"
            itemLabel="active schedule"
          />
          <QuickLink
            href={`/dashboard/lines/${line.short_id}/reminders`}
            icon={<Bell className="w-5 h-5 text-primary" />}
            title="Reminders"
            count={pendingRemindersCount}
            zeroLabel="No reminders scheduled"
            itemLabel="reminder scheduled"
          />
          <QuickLink
            href={`/dashboard/lines/${line.short_id}/milestones`}
            icon={<Gift className="w-5 h-5 text-primary" />}
            title="Milestones"
            count={milestonesCount}
            zeroLabel="No milestones yet"
            itemLabel="milestone"
          />
          <QuickLink
            href={`/dashboard/lines/${line.short_id}/contacts`}
            icon={<Users className="w-5 h-5 text-primary" />}
            title="Trusted Contacts"
            count={trustedContactsCount}
            zeroLabel="No contacts added"
            itemLabel="contact"
          />
        </div>
      </div>

      {/* Call History Card */}
      <div className={`${CARD_CLASS} mt-6`}>
        <div className={`${CARD_HEADER_CLASS} mb-6`}>
          <Phone className="w-5 h-5 text-muted-foreground" />
          <h2 className="font-semibold text-foreground">Recent Calls</h2>
        </div>
        <CallActivityList sessions={callSessions} />
      </div>

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Line"
        description="Are you sure you want to delete this line? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
