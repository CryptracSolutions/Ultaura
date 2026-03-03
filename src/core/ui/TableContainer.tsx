import cn from 'clsx';

interface TableContainerProps {
  children: React.ReactNode;
  className?: string;
}

function TableContainer({ children, className }: TableContainerProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

export default TableContainer;
