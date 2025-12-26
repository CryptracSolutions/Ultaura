import Link from 'next/link';
import { Repeat, Phone, Clock, Zap } from 'lucide-react';

import AppHeader from './components/AppHeader';
import { withI18n } from '~/i18n/with-i18n';
import Trans from '~/core/ui/Trans';
import { PageBody } from '~/core/ui/Page';
import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import { getLines, getLineActivity, getUltauraAccount, getUsageSummary, getUpcomingScheduledCalls, getUpcomingReminders } from '~/lib/ultaura/actions';
import { getShortLineId } from '~/lib/ultaura';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
                Start a free trial to add a loved one, set schedules, and view
                call activity in one place.
              </p>
              <Link
                href="/dashboard/settings/subscription"
                className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </PageBody>
      </>
    );
  }

  const [lines, usage, activity, upcomingSchedules, upcomingReminders] = await Promise.all([
    getLines(account.id),
    getUsageSummary(account.id),
    getLineActivity(account.id),
    getUpcomingScheduledCalls(account.id),
    getUpcomingReminders(account.id),
  ]);

  const unverifiedCount = lines.filter((l) => !l.phone_verified_at).length;
  const activeCount = lines.filter((l) => l.status === 'active').length;
  const pausedCount = lines.filter((l) => l.status === 'paused').length;

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

  return (
    <>
      <AppHeader
        title={<Trans i18nKey={'common:dashboardTabLabel'} />}
        description={<Trans i18nKey={'common:dashboardTabDescription'} />}
      />

      <PageBody>
        <div className="flex flex-col space-y-6 pb-24">
          {/* Alerts */}
          {(unverifiedCount > 0 || (usage && usage.minutesRemaining <= 5)) && (
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

              {usage && usage.minutesRemaining <= 5 && (
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

          {/* At a glance */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div className="text-base font-medium text-foreground">Lines</div>
              </div>
              <div className="text-3xl font-bold text-foreground">
                {lines.length}
              </div>
              <div className="flex-1" />
              <div className="mt-auto space-y-2">
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

            <div className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div className="text-base font-medium text-foreground">Minutes</div>
              </div>
              <div className="text-3xl font-bold text-foreground">
                {usage ? usage.minutesRemaining : '—'}
              </div>
              {usage && (
                <div className="mt-3">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((usage.minutesUsed / usage.minutesIncluded) * 100, 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
              <div className="flex-1" />
              <div className="mt-auto space-y-2">
                <div className="text-xs text-muted-foreground">
                  {usage
                    ? `${usage.minutesUsed} used • ${usage.minutesIncluded} included`
                    : 'Usage not available yet.'}
                </div>
                <Link
                  href="/dashboard/settings/subscription"
                  className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                >
                  View plan →
                </Link>
              </div>
            </div>

            <div className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <div className="text-base font-medium text-foreground">Quick actions</div>
              </div>
              <div className="flex-1" />
              <div className="mt-auto space-y-2">
                <div className="grid gap-2">
                  <Link
                    href="/dashboard/calls"
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    View schedules
                  </Link>
                  <Link
                    href="/dashboard/reminders"
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    View reminders
                  </Link>
                  <Link
                    href="/dashboard/lines"
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    View lines
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming scheduled calls */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-foreground">
                Upcoming calls
              </h2>
              <Link
                href="/dashboard/calls"
                className="text-sm text-primary hover:underline"
              >
                View all
              </Link>
            </div>

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
                  <div
                    key={item.scheduleId}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-medium text-foreground">
                        {item.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(item.nextRunAt)}
                      </div>
                    </div>
                    <div className="mt-2">
                      <Link
                        href={`/dashboard/lines/${getShortLineId(item.lineId)}/schedule`}
                        className="text-sm text-primary hover:underline"
                      >
                        Edit schedule
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming reminders */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-foreground">
                Upcoming reminders
              </h2>
              <Link
                href="/dashboard/reminders"
                className="text-sm text-primary hover:underline"
              >
                View all
              </Link>
            </div>

            {upcomingReminders.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No reminders scheduled.{' '}
                <Link href="/dashboard/reminders" className="text-primary hover:underline">
                  Add a reminder
                </Link>{' '}
                for medication, appointments, or important tasks.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {upcomingReminders.slice(0, 4).map((reminder) => (
                  <div
                    key={reminder.reminderId}
                    className="rounded-lg border border-border bg-background p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-medium text-foreground">
                        {reminder.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(reminder.dueAt)}
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                      {reminder.message}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      {reminder.isRecurring && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-medium">
                          <Repeat className="w-3 h-3" />
                          {formatRecurrence(reminder)}
                        </span>
                      )}
                      <Link
                        href={`/dashboard/lines/${getShortLineId(reminder.lineId)}/reminders`}
                        className="text-sm text-primary hover:underline"
                      >
                        View reminders
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent calls */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-foreground">
                Recent call activity
              </h2>
              <Link
                href="/dashboard/lines"
                className="text-sm text-primary hover:underline"
              >
                Open a line
              </Link>
            </div>

            {recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No calls yet. Once calls start, you'll see timestamps and durations here — not transcripts.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-border rounded-lg border border-border bg-background">
                {recent.map((item) => (
                  <div
                    key={item.lineId}
                    className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium text-foreground">
                        {item.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(item.lastCallAt!)}
                        {typeof item.lastCallDuration === 'number'
                          ? ` • ${formatDuration(item.lastCallDuration)}`
                          : ''}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/lines/${getShortLineId(item.lineId)}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View details
                    </Link>
                  </div>
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

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}
