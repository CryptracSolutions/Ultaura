'use client';

import { useState } from 'react';
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  CheckCircle,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { CallSessionRow, InsightMood } from '~/lib/ultaura/types';
import { getLanguageDisplayName } from '~/lib/ultaura/language';
import { getCallTypeLabel } from '~/lib/ultaura/call-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';

interface CallActivityListProps {
  sessions: Array<CallSessionRow & { mood_overall?: InsightMood | null }>;
}

export function CallActivityList({ sessions }: CallActivityListProps) {
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = last month, etc.

  // Calculate the viewing month based on offset
  const getViewingMonth = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + monthOffset);
    return date;
  };

  const viewingMonth = getViewingMonth();
  const viewingYear = viewingMonth.getFullYear();
  const viewingMonthIndex = viewingMonth.getMonth();

  // Filter sessions for the selected month
  const filteredSessions = sessions.filter((session) => {
    const sessionDate = new Date(session.created_at);
    return (
      sessionDate.getFullYear() === viewingYear &&
      sessionDate.getMonth() === viewingMonthIndex
    );
  });

  // Check if we can navigate (limit to 12 months back)
  const canGoBack = monthOffset > -11;
  const canGoForward = monthOffset < 0;

  const handlePrevMonth = () => {
    if (canGoBack) setMonthOffset(monthOffset - 1);
  };

  const handleNextMonth = () => {
    if (canGoForward) setMonthOffset(monthOffset + 1);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div>
      {/* Month Navigation */}
      <div className="flex items-center justify-center gap-2 mb-4 pb-3 border-b border-border">
        <button
          onClick={handlePrevMonth}
          disabled={!canGoBack}
          className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5 text-primary" />
        </button>
        <span className="text-sm font-medium text-foreground">
          {formatMonthYear(viewingMonth)}
        </span>
        <button
          onClick={handleNextMonth}
          disabled={!canGoForward}
          className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5 text-primary" />
        </button>
      </div>

      {/* Call List */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-8">
          <PhoneOutgoing className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No calls in {formatMonthYear(viewingMonth)}</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filteredSessions.map((session) => (
            <CallActivityItem key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function CallActivityItem({
  session,
}: {
  session: CallSessionRow & { mood_overall?: InsightMood | null };
}) {
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

  // Always use primary tiffany blue for icon backgrounds and colors
  const bgColor = 'bg-primary/10';
  const iconColor = 'text-primary';

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

  const callTypeLabel = getCallTypeLabel(session);

  return (
    <div className="flex items-center gap-4 py-3">
      <div
        className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center flex-shrink-0`}
      >
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">
          {callTypeLabel}
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
