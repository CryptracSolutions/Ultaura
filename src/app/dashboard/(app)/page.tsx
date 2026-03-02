import Link from 'next/link';
import { Phone, Clock, Zap, User, Calendar, Bell, History } from 'lucide-react';

import AppHeader from './components/AppHeader';
import { DashboardUpcomingTabs } from './components/DashboardUpcomingTabs';
import WhatsNewSection from './components/WhatsNewSection';
import { withI18n } from '~/i18n/with-i18n';
import Trans from '~/core/ui/Trans';
import { PageBody } from '~/core/ui/Page';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import {
  getPublishedChangelogDashboardItems,
  getUserChangelogDismissal,
} from '~/lib/ultaura/changelog';
import { getLines } from '~/lib/ultaura/lines';
import {
  getActiveScheduleStatsByLine,
  getUpcomingScheduledCalls,
} from '~/lib/ultaura/schedules';
import {
  getScheduledReminderStatsByLine,
  getUpcomingReminders,
} from '~/lib/ultaura/reminders';
import { getEffectiveReminderLimit } from '~/lib/ultaura/helpers';
import { getLineActivity, getUsageSummary } from '~/lib/ultaura/usage';
import { BILLING, PLANS } from '~/lib/ultaura/constants';
import Button from '~/core/ui/Button';
import { TrialExpiredBanner } from '~/components/ultaura/TrialExpiredBanner';
import { MfaNudgeBanner } from '~/components/ultaura/MfaNudgeBanner';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RATE_CENTS = BILLING.OVERAGE_RATE_CENTS;

// Format timeOfDay from "08:00:00" to "8:00 AM"
function formatTimeOfDay(timeOfDay: string): string {
  const [hours, minutes] = timeOfDay.split(':');
  const hour = parseInt(hours!, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getOrdinalSuffix(n: number): string {
  if (n > 3 && n < 21) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatRecurrence(reminder: {
  isRecurring: boolean;
  rrule: string | null;
  intervalDays: number | null;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
}): string {
  if (!reminder.isRecurring || !reminder.rrule) return '';

  if (reminder.rrule.includes('FREQ=DAILY')) {
    const interval = reminder.intervalDays || 1;
    return interval === 1 ? 'Daily' : `Every ${interval} days`;
  }

  if (reminder.rrule.includes('FREQ=WEEKLY')) {
    if (reminder.daysOfWeek && reminder.daysOfWeek.length > 0) {
      const days = reminder.daysOfWeek.map(d => DAY_NAMES[d]).join(', ');
      return `Weekly on ${days}`;
    }
    return 'Weekly';
  }

  if (reminder.rrule.includes('FREQ=MONTHLY')) {
    const day = reminder.dayOfMonth || 1;
    return `Monthly on the ${day}${getOrdinalSuffix(day)}`;
  }

  return 'Recurring';
}

export const metadata = {
  title: 'Dashboard',
};

async function DashboardPage() {
  const appData = await loadAppDataForUser();
  const userId = appData.auth.user.id;
  const organizationId = appData.organization?.id;

  if (!organizationId) {
    return (
      <PageBody>
        <div className="py-8">
          <p className="text-muted-foreground">Organization not found.</p>
        </div>
      </PageBody>
    );
  }

  const account = await getUltauraAccount(organizationId);

  if (!account) {
    return (
      <>
        <AppHeader
          title={<Trans i18nKey={'common:dashboardTabLabel'} />}
          description={<Trans i18nKey={'common:dashboardTabDescription'} />}
        />

        <PageBody>
          <div className="py-8">
            <div className="max-w-lg rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Set up Ultaura for your family
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Start a 14-day free trial to add a loved one, set schedules, and view
                call activity in one place.
              </p>
              <div className="mt-4">
                <Button variant="default" href="/dashboard/settings/subscription">
                  Start 14-day free trial
                </Button>
              </div>
            </div>
          </div>
        </PageBody>
      </>
    );
  }

  const isSelfUser = account.user_type === 'self';
  const headerDescription = isSelfUser
    ? 'Your home for call activity, schedules, and reminders.'
    : <Trans i18nKey={'common:dashboardTabDescription'} />;

  const [
    lines,
    usage,
    activity,
    upcomingSchedules,
    upcomingReminders,
    scheduledReminderStatsByLine,
    activeScheduleStatsByLine,
    publishedChangelog,
    changelogDismissal,
  ] = await Promise.all([
    getLines(account.id),
    getUsageSummary(account.id),
    getLineActivity(account.id),
    getUpcomingScheduledCalls(account.id),
    getUpcomingReminders(account.id),
    getScheduledReminderStatsByLine(account.id),
    getActiveScheduleStatsByLine(account.id),
    getPublishedChangelogDashboardItems({ limit: 5 }),
    getUserChangelogDismissal(userId),
  ]);

  const unverifiedCount = lines.filter((l) => !l.phone_verified_at).length;
  const activeCount = lines.filter((l) => l.status === 'active').length;
  const pausedCount = lines.filter((l) => l.status === 'paused').length;
  const isPayg = account.plan_id === 'payg';
  const isOnTrial = account.status === 'trial';
  const trialEndsAt = account.trial_ends_at ?? account.cycle_end ?? null;
  const msRemaining = isOnTrial && trialEndsAt ? new Date(trialEndsAt).getTime() - Date.now() : 0;
  const isTrialExpired = isOnTrial && !!trialEndsAt && msRemaining <= 0;
  const trialPlanId = (account.trial_plan_id ?? account.plan_id) as keyof typeof PLANS;
  const trialPlanName = PLANS[trialPlanId]?.displayName ?? 'Trial';
  const overageMinutes = usage?.overageMinutes ?? 0;
  const usageCostCents = usage
    ? (isOnTrial ? 0 : isPayg ? usage.minutesUsed * RATE_CENTS : overageMinutes * RATE_CENTS)
    : 0;
  const capCents = account.overage_cents_cap ?? 0;
  const capPercent = capCents > 0 && usage ? Math.min((usageCostCents / capCents) * 100, 100) : 0;
  const capReached = capCents > 0 && usageCostCents >= capCents;
  const includedUsagePercent =
    usage && usage.minutesIncluded > 0
      ? Math.min((Math.min(usage.minutesUsed, usage.minutesIncluded) / usage.minutesIncluded) * 100, 100)
      : 0;
  const overagePercent =
    usage && usage.minutesIncluded > 0
      ? Math.min((overageMinutes / usage.minutesIncluded) * 100, 100)
      : 0;
  const minutesValue = usage
    ? (isOnTrial || isPayg
      ? usage.minutesUsed
      : overageMinutes > 0
      ? overageMinutes
      : usage.minutesRemaining)
    : '—';
  const minutesLabel = usage
    ? (isOnTrial || isPayg
      ? 'minutes used'
      : overageMinutes > 0
      ? 'minutes over'
      : 'minutes remaining')
    : null;
  const usageSummary = usage
    ? (isOnTrial
      ? `${usage.minutesUsed} minutes`
      : isPayg
      ? `${usage.minutesUsed} minutes`
      : `${usage.minutesUsed} used${overageMinutes > 0 ? ` • ${overageMinutes} over` : ''}`)
    : 'Usage not available yet.';
  const usageSummaryRight = usage
    ? (isOnTrial
      ? `${formatCurrency(0)} during trial`
      : isPayg
      ? `${formatCurrency(usageCostCents)} est.`
      : `${usage.minutesIncluded} included`)
    : null;
  const effectiveReminderLimit = getEffectiveReminderLimit(account);
  const reminderAllowanceRows = lines.map((line) => {
    const activeReminderCount = scheduledReminderStatsByLine[line.id] || 0;
    const isCapped = effectiveReminderLimit !== null;
    const atLimit = isCapped && activeReminderCount >= effectiveReminderLimit;

    return {
      lineId: line.id,
      lineName: line.display_name || 'Unnamed line',
      activeReminderCount,
      subtext: isCapped ? `${effectiveReminderLimit} allowed` : 'Unlimited',
      atLimit,
    };
  });
  const scheduleAllowanceRows = lines.map((line) => ({
    lineId: line.id,
    lineName: line.display_name || 'Unnamed line',
    activeScheduleCount: activeScheduleStatsByLine[line.id] || 0,
  }));

  // Get upcoming scheduled calls (already sorted by next_run_at)
  const upcoming = upcomingSchedules.slice(0, 6);

  const recent = activity
    .filter((a) => Boolean(a.lastCallAt))
    .sort((a, b) => {
      const aTime = a.lastCallAt ? new Date(a.lastCallAt).getTime() : 0;
      const bTime = b.lastCallAt ? new Date(b.lastCallAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 8);

  const showWhatsNew = shouldShowWhatsNewSection(
    publishedChangelog.items.length,
    publishedChangelog.latestEntryId,
    publishedChangelog.latestPublishedAt,
    changelogDismissal?.lastSeenEntryId ?? null,
    changelogDismissal?.lastSeenPublishedAt ?? null,
  );

  return (
    <>
      <AppHeader
        title={<Trans i18nKey={'common:dashboardTabLabel'} />}
        description={headerDescription}
      />

      <PageBody>
        <div className="flex flex-col space-y-6 pb-24">
          {isTrialExpired ? <TrialExpiredBanner trialPlanName={trialPlanName} /> : null}
          <MfaNudgeBanner />

          {/* Alerts */}
          {(unverifiedCount > 0 || (usage && !isPayg && !isOnTrial && usage.minutesRemaining <= 5)) && (
            <div className="grid gap-3">
              {unverifiedCount > 0 && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
                  <div className="font-medium text-foreground">
                    Verification needed
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {unverifiedCount} line{unverifiedCount === 1 ? '' : 's'}{' '}
                    {unverifiedCount === 1 ? 'is' : 'are'} not verified yet.
                  </div>
                  <Link
                    href="/dashboard/lines"
                    className="mt-2 inline-flex text-primary hover:underline"
                  >
                    Go to lines
                  </Link>
                </div>
              )}

              {usage && !isPayg && !isOnTrial && usage.minutesRemaining <= 5 && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
                  <div className="font-medium text-foreground">
                    Minutes running low
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    You have {usage.minutesRemaining} minute
                    {usage.minutesRemaining === 1 ? '' : 's'} remaining.
                  </div>
                  <Link
                    href="/dashboard/settings/subscription"
                    className="mt-2 inline-flex text-primary hover:underline"
                  >
                    Manage subscription
                  </Link>
                </div>
              )}
            </div>
          )}

          {showWhatsNew ? (
            <WhatsNewSection
              userId={userId}
              initialUpdates={publishedChangelog.items}
              totalCount={publishedChangelog.totalCount}
              latestEntryId={publishedChangelog.latestEntryId}
              latestPublishedAt={publishedChangelog.latestPublishedAt}
            />
          ) : null}

          {/* At a glance */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-xl bg-card p-5 card-border-accent">
              <div className="absolute -top-8 -right-8 w-16 h-16 bg-primary/5 rounded-full blur-2xl" />
              <div className="relative flex items-center gap-2 mb-1">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div className="text-base font-medium text-foreground">Lines</div>
              </div>
              <div className="relative text-3xl font-bold text-foreground">
                {lines.length}
              </div>
              <div className="relative flex-1" />
              <div className="relative mt-auto space-y-2">
                <div className="text-xs text-muted-foreground">
                  {activeCount} active{pausedCount > 0 ? ` • ${pausedCount} paused` : ''}
                </div>
                <Link
                  href="/dashboard/lines"
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  Manage lines →
                </Link>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl bg-card p-5 card-border-accent">
              <div className="absolute -top-8 -right-8 w-16 h-16 bg-primary/5 rounded-full blur-2xl" />
              <div className="relative flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="text-base font-medium text-foreground">Minutes</div>
                </div>
                <Link
                  href="/dashboard/usage"
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  View usage →
                </Link>
              </div>
              <div className="relative text-3xl font-bold text-foreground">
                {minutesValue}
              </div>
              {minutesLabel && (
                <div className="relative text-xs text-muted-foreground mb-1">
                  {minutesLabel}
                </div>
              )}
              {usage && !isOnTrial && (
                <div className="relative mt-2">
                  {isPayg ? (
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 transition-all duration-300 ${capReached ? 'bg-warning' : 'bg-primary'}`}
                        style={{ width: `${capPercent}%` }}
                      ></div>
                    </div>
                  ) : (
                    <div className="relative w-full bg-muted rounded-full h-2 overflow-visible">
                      <div className="absolute inset-0 flex overflow-visible">
                        <div
                          className={`h-2 ${overageMinutes > 0 ? 'rounded-l-full' : 'rounded-full'} bg-primary transition-all duration-300`}
                          style={{ width: `${includedUsagePercent}%` }}
                        ></div>
                        {overageMinutes > 0 && (
                          <div
                            className="h-2 rounded-r-full bg-warning transition-all duration-300"
                            style={{ width: `${overagePercent}%` }}
                          ></div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="relative flex-1" />
              <div className="relative mt-auto space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{usageSummary}</span>
                  {usageSummaryRight && <span>{usageSummaryRight}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <DashboardUpcomingTabs
              callsContent={
                <>
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      Upcoming calls
                    </h2>
                    <Link
                      href="/dashboard/calls"
                      className="text-sm text-primary hover:underline"
                    >
                      View all
                    </Link>
                  </div>

                  {scheduleAllowanceRows.length > 0 && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        {scheduleAllowanceRows.map((row) => (
                          <div
                            key={row.lineId}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground"
                          >
                            <span className="font-medium text-foreground">{row.lineName}</span>
                            <span aria-hidden="true">•</span>
                            <span className="text-primary">
                              {row.activeScheduleCount} active
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {upcoming.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No scheduled calls yet.{' '}
                      <Link href="/dashboard/calls" className="text-primary hover:underline">
                        Add a schedule
                      </Link>{' '}
                      to start recurring check-ins.
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {upcoming.map((item) => (
                        <Link
                          key={item.scheduleId}
                          href={`/dashboard/calls?line=${item.lineShortId}`}
                          className="rounded-lg border border-border border-l-4 bg-background p-4 block hover:bg-muted/30 transition-colors"
                          style={{
                            borderLeftColor: item.isOneTime
                              ? 'var(--info)'
                              : 'var(--primary)'
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-primary shrink-0" />
                            <div className="font-semibold text-foreground">
                              {item.displayName}
                            </div>
                            <div className="text-xs text-muted-foreground ml-auto">
                              {formatDateTime(item.nextRunAt, item.lineTimezone)}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatTimeOfDay(item.timeOfDay)}
                            {item.daysOfWeek && item.daysOfWeek.length > 0 && (
                              <span className="ml-1">
                                • {item.daysOfWeek.map((d: number) => DAY_NAMES[d]).join(', ')}
                              </span>
                            )}
                          </p>
                          {(item.isOneTime || item.rescheduledFrom) && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {item.isOneTime && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium">
                                  One-time
                                </span>
                              )}
                              {item.rescheduledFrom && (
                                <span className="text-xs text-muted-foreground">
                                  {item.rescheduledFrom}
                                </span>
                              )}
                            </div>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              }
              remindersContent={
                <>
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      Upcoming reminders
                    </h2>
                    <Link
                      href="/dashboard/reminders"
                      className="text-sm text-primary hover:underline"
                    >
                      View all
                    </Link>
                  </div>

                  {reminderAllowanceRows.length > 0 && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                      {reminderAllowanceRows.map((row) => (
                        <div
                          key={row.lineId}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                            row.atLimit
                              ? 'border-warning/40 bg-warning/10 text-warning-foreground'
                              : 'border-border bg-muted/30 text-muted-foreground'
                          }`}
                        >
                          <span className="font-medium text-foreground">{row.lineName}</span>
                          <span aria-hidden="true">•</span>
                          <span className="text-primary">
                            {row.activeReminderCount} active
                          </span>
                        </div>
                      ))}
                      </div>
                    </div>
                  )}

                  {upcomingReminders.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No reminders scheduled.{' '}
                      <Link href="/dashboard/reminders" className="text-primary hover:underline">
                        Set a reminder
                      </Link>{' '}
                      for medication, appointments, or important tasks.
                    </p>
                  ) : (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {upcomingReminders.slice(0, 4).map((reminder) => (
                        <Link
                          key={reminder.reminderId}
                          href={`/dashboard/reminders?line=${reminder.lineShortId}`}
                          className="rounded-lg border border-border border-l-4 bg-background p-4 block hover:bg-muted/30 transition-colors"
                          style={{ borderLeftColor: 'var(--primary)' }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-primary shrink-0" />
                            <div className="font-semibold text-foreground">
                              {reminder.displayName}
                            </div>
                            <div className="text-xs text-muted-foreground ml-auto">
                              {formatDateTime(reminder.dueAt, reminder.lineTimezone)}
                            </div>
                          </div>
                          <p className="text-sm text-foreground font-medium line-clamp-2">
                            {reminder.message}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              }
            />
          </div>

          {/* Recent calls */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Recent call activity
              </h2>
            </div>

            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No calls yet. Once calls start, you&apos;ll see timestamps and durations here — not transcripts.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {recent.map((item) => (
                  <Link
                    key={item.lineId}
                    href={`/dashboard/lines/${item.lineShortId}`}
                    className="rounded-lg border border-border border-l-4 bg-background p-4 block hover:bg-muted/30 transition-colors"
                    style={{ borderLeftColor: 'var(--primary)' }}
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary shrink-0" />
                      <div className="font-semibold text-foreground">
                        {item.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground ml-auto">
                        {formatDateTime(item.lastCallAt!)}
                      </div>
                    </div>
                    {item.lastCallDuration != null && item.lastCallDuration > 0 && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Duration: {formatDuration(item.lastCallDuration)}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </PageBody>
    </>
  );
}

export default withI18n(DashboardPage);

function shouldShowWhatsNewSection(
  itemCount: number,
  latestEntryId: string | null,
  latestPublishedAt: string | null,
  dismissedEntryId: string | null,
  dismissedPublishedAt: string | null,
) {
  if (itemCount === 0) {
    return false;
  }

  const latestTime = toTimestampOrNaN(latestPublishedAt);
  const dismissedTime = toTimestampOrNaN(dismissedPublishedAt);
  const dismissedMatchesLatestByTime =
    Number.isFinite(latestTime) &&
    Number.isFinite(dismissedTime) &&
    dismissedTime >= latestTime;
  const dismissedMatchesLatestByEntryId =
    Boolean(dismissedEntryId) &&
    Boolean(latestEntryId) &&
    dismissedEntryId === latestEntryId;

  return !(dismissedMatchesLatestByTime || dismissedMatchesLatestByEntryId);
}

function toTimestampOrNaN(value: string | null) {
  return value ? new Date(value).getTime() : Number.NaN;
}

function formatDateTime(iso: string, timezone?: string | null) {
  const date = new Date(iso);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  };

  if (timezone) {
    options.timeZone = timezone;
  }

  try {
    return new Intl.DateTimeFormat('en-US', options).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(date);
  }
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}
