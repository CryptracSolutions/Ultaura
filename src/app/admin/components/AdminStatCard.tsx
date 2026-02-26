import { cn } from '~/core/generic/shadcn-utils';

interface AdminStatCardProps {
  icon?: React.ElementType;
  label: string;
  value?: string | number;
  subtext?: string;
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

function AdminStatCard({
  icon: Icon,
  label,
  value,
  subtext,
  headerRight,
  children,
  className,
}: AdminStatCardProps) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-card p-5 card-border-accent', className)}>
      <div className="absolute -top-8 -right-8 w-16 h-16 bg-primary/5 rounded-full blur-2xl" />
      <div className="relative flex items-center gap-2 mb-1">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="text-base font-medium text-foreground">{label}</span>
        {headerRight ? <div className="ml-auto">{headerRight}</div> : null}
      </div>
      {value !== undefined && value !== null && value !== '' ? (
        <div className="relative text-3xl font-bold text-foreground">{value}</div>
      ) : null}
      {subtext && <div className="text-xs text-muted-foreground">{subtext}</div>}
      {children}
    </div>
  );
}

export default AdminStatCard;
