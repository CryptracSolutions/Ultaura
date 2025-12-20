'use client';

import Link from 'next/link';
import { AlertTriangle, CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useState } from 'react';

interface AlertBannerProps {
  type: 'warning' | 'success' | 'error' | 'info';
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  dismissible?: boolean;
}

export function AlertBanner({
  type,
  title,
  message,
  actionLabel,
  actionHref,
  onAction,
  dismissible = true,
}: AlertBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const iconMap = {
    warning: AlertTriangle,
    success: CheckCircle,
    error: XCircle,
    info: Info,
  };

  const colorMap = {
    warning: {
      bg: 'bg-warning/10',
      border: 'border-warning/20',
      text: 'text-warning',
    },
    success: {
      bg: 'bg-success/10',
      border: 'border-success/20',
      text: 'text-success',
    },
    error: {
      bg: 'bg-destructive/10',
      border: 'border-destructive/20',
      text: 'text-destructive',
    },
    info: {
      bg: 'bg-info/10',
      border: 'border-info/20',
      text: 'text-info',
    },
  };

  const Icon = iconMap[type];
  const colors = colorMap[type];

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-lg p-4 flex items-start gap-3`}>
      <Icon className={`w-5 h-5 ${colors.text} flex-shrink-0 mt-0.5`} />
      <div className="flex-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{message}</p>
      </div>
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link
            href={actionHref}
            className="flex-shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            onClick={onAction}
            className="flex-shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {actionLabel}
          </button>
        )
      )}
      {dismissible && (
        <button
          onClick={() => setIsDismissed(true)}
          className="flex-shrink-0 p-1 rounded hover:bg-foreground/5 transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
