import { Clock, Phone, Users, Sparkles } from 'lucide-react';

interface TrialStatusCardProps {
  planName: string;
  daysRemaining: number;
  hoursRemaining: number;
  trialEndsAt: string | null;
  minutesIncluded: number | 'Unlimited';
  linesIncluded: number;
}

export function TrialStatusCard({
  planName,
  daysRemaining,
  hoursRemaining,
  trialEndsAt,
  minutesIncluded,
  linesIncluded,
}: TrialStatusCardProps) {
  const isUrgent = daysRemaining <= 1;
  const formattedEndDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  // Show hours if less than 1 day
  const timeDisplay = daysRemaining < 1
    ? `${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'}`
    : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;

  return (
    <div
      className={`rounded-xl border-2 p-6 ${
        isUrgent
          ? 'border-warning/50 bg-warning/5'
          : 'border-primary/30 bg-primary/5'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className={`h-5 w-5 ${isUrgent ? 'text-warning' : 'text-primary'}`} />
            <h3 className="text-lg font-semibold">
              {planName} Plan Trial
            </h3>
          </div>

          <p className="text-muted-foreground mb-4">
            You&apos;re trying out the {planName} plan with full access to all features.
            {isUrgent
              ? ' Your trial is ending soon!'
              : ' Subscribe to continue after your trial ends.'}
          </p>

          {/* Trial features */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">
                  {minutesIncluded === 'Unlimited' ? 'Unlimited' : `${minutesIncluded}`}
                </span>{' '}
                <span className="text-muted-foreground">
                  {minutesIncluded === 'Unlimited' ? 'minutes' : 'min/month'}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">{linesIncluded}</span>{' '}
                <span className="text-muted-foreground">
                  phone line{linesIncluded > 1 ? 's' : ''}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Time remaining badge */}
        <div
          className={`flex flex-col items-center rounded-lg px-4 py-3 ${
            isUrgent
              ? 'bg-warning/10 text-warning'
              : 'bg-primary/10 text-primary'
          }`}
        >
          <Clock className="h-5 w-5 mb-1" />
          <span className="text-2xl font-bold">{timeDisplay}</span>
          <span className="text-xs">remaining</span>
        </div>
      </div>

      {/* End date */}
      {formattedEndDate && (
        <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
          Trial ends: {formattedEndDate}
        </p>
      )}
    </div>
  );
}
