import classNames from 'clsx';
import React from 'react';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={classNames(
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: CardProps) {
  return <div className={classNames('flex flex-col space-y-1.5 p-6', className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={classNames('text-lg font-semibold leading-none tracking-tight', className)} {...props} />;
}

function CardContent({ className, ...props }: CardProps) {
  return <div className={classNames('p-6', className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardContent };
