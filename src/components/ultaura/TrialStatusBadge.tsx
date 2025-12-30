import { Clock } from 'lucide-react';

export function TrialStatusBadge(props: { daysRemaining: number; planName: string }) {
  const urgent = props.daysRemaining <= 1;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
        urgent
          ? 'border-warning/40 bg-warning/10 text-warning'
          : 'border-muted-foreground/20 bg-muted/30 text-muted-foreground'
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>
        {props.planName} trial • {props.daysRemaining} day{props.daysRemaining === 1 ? '' : 's'} left
      </span>
    </div>
  );
}

