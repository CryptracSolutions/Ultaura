'use client';

import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';
import type { CallSessionRow, InsightMood } from '~/lib/ultaura/types';
import { getLanguageDisplayName } from '~/lib/ultaura/language';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

interface CallActivityListProps {
  sessions: Array<CallSessionRow & { mood_overall?: InsightMood | null }>;
}

export function CallActivityList({ sessions }: CallActivityListProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8">
        <PhoneOutgoing className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No call history yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Calls will appear here after the first check-in
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {sessions.map((session) => (
        <CallActivityItem key={session.id} session={session} />
      ))}
    </div>
  );
}

function CallActivityItem({ session }: { session: CallSessionRow }) {
  const isCompleted = session.status === 'completed';
  const isFailed = session.status === 'failed';
  const isInProgress = session.status === 'in_progress';
  const isMissed = session.end_reason === 'no_answer';

  // Choose icon based on direction and status
  const Icon = isMissed
    ? PhoneMissed
    : session.direction === 'inbound'
    ? PhoneIncoming
    : PhoneOutgoing;

  // Choose colors based on status
  const bgColor = isCompleted
    ? 'bg-success/10'
    : isFailed || isMissed
    ? 'bg-destructive/10'
    : isInProgress
    ? 'bg-primary/10'
    : 'bg-muted';

  const iconColor = isCompleted
    ? 'text-success'
    : isFailed || isMissed
    ? 'text-destructive'
    : isInProgress
    ? 'text-primary'
    : 'text-muted-foreground';

  const formatDuration = (seconds: number | null) => {
    if (!seconds || seconds === 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    if (diffDays === 0) return `Today, ${timeStr}`;
    if (diffDays === 1) return `Yesterday, ${timeStr}`;
    if (diffDays < 7) {
      return `${date.toLocaleDateString('en-US', { weekday: 'long' })}, ${timeStr}`;
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusLabel = () => {
    if (isMissed) return 'No answer';
    if (isFailed) return 'Failed';
    if (isInProgress) return 'In progress';
    if (isCompleted) return formatDuration(session.seconds_connected) || 'Completed';
    return session.status;
  };

  const languageLabel = session.language_detected
    ? getLanguageDisplayName(session.language_detected)
    : null;

  const moodIndicator =
    session.mood_overall === 'positive'
      ? { color: 'bg-success', label: 'Mood: Positive' }
      : session.mood_overall === 'low'
      ? { color: 'bg-destructive', label: 'Mood: Low' }
      : null;

  return (
    <div className="flex items-center gap-4 py-3">
      <div
        className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center flex-shrink-0`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground capitalize">
          {session.direction === 'inbound' ? 'Inbound' : 'Outbound'} call
        </p>
        <p className="text-sm text-muted-foreground truncate">
          {getStatusLabel()} &middot; {formatDate(session.created_at)}
          {languageLabel && (
            <>
              {' '}
              &middot; {languageLabel}
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {isCompleted && <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />}
        {(isFailed || isMissed) && <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />}
        {isInProgress && <Clock className="w-5 h-5 text-primary flex-shrink-0 animate-pulse" />}
        {moodIndicator && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex h-2 w-2 rounded-full ${moodIndicator.color}`}
                aria-label={moodIndicator.label}
              />
            </TooltipTrigger>
            <TooltipContent>{moodIndicator.label}</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
