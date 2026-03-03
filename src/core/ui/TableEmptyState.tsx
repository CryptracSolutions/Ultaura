import cn from 'clsx';

interface TableEmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  message: string;
  className?: string;
}

function TableEmptyState({
  icon: Icon,
  message,
  className,
}: TableEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className,
      )}
    >
      {Icon && <Icon className="h-8 w-8 text-muted-foreground/50 mb-3" />}
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default TableEmptyState;
