'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Phone,
  MoreVertical,
  Calendar,
  Clock,
  ShieldCheck,
  Play,
  Pause,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { LineRow } from '~/lib/ultaura/types';
import { deleteLine } from '~/lib/ultaura/actions';
import { formatDistanceToNow } from 'date-fns';

interface LineCardProps {
  line: LineRow;
}

export function LineCard({ line }: LineCardProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${line.display_name}"? This cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    setIsMenuOpen(false);

    try {
      const result = await deleteLine(line.id);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || 'Failed to delete line');
      }
    } catch {
      alert('An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const isVerified = !!line.phone_verified_at;
  const isActive = line.status === 'active';
  const isPaused = line.status === 'paused';
  const isDisabled = line.status === 'disabled';
  const isOptedOut = line.do_not_call;

  // Format phone number for display
  const formattedPhone = formatPhoneNumber(line.phone_e164);

  // Get status badge
  const getStatusBadge = () => {
    if (!isVerified) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
          Pending
        </span>
      );
    }
    if (isOptedOut) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
          Opted Out
        </span>
      );
    }
    if (isActive) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
          Active
        </span>
      );
    }
    if (isPaused) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
          Paused
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
        Disabled
      </span>
    );
  };

  // Get icon background color
  const getIconBgClass = () => {
    if (!isVerified) return 'bg-warning/10';
    if (isOptedOut || isDisabled) return 'bg-destructive/10';
    return 'bg-primary/10';
  };

  const getIconColorClass = () => {
    if (!isVerified) return 'text-warning';
    if (isOptedOut || isDisabled) return 'text-destructive';
    return 'text-primary';
  };

  return (
    <div
      className={`bg-card rounded-xl border p-6 shadow-sm hover:shadow-md transition-all ${
        !isVerified ? 'border-warning/50' : isOptedOut || isDisabled ? 'border-destructive/50' : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full ${getIconBgClass()} flex items-center justify-center`}>
            <Phone className={`w-6 h-6 ${getIconColorClass()}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{line.display_name}</h3>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-muted-foreground">{formattedPhone}</p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-md hover:bg-muted transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-muted-foreground" />
          </button>
          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-popover rounded-lg shadow-lg border border-border z-20">
                <Link
                  href={`/dashboard/lines/${line.id}`}
                  className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors rounded-t-lg"
                >
                  View Details
                </Link>
                <Link
                  href={`/dashboard/lines/${line.id}/schedule`}
                  className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  Edit Schedule
                </Link>
                <Link
                  href={`/dashboard/lines/${line.id}/settings`}
                  className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  Settings
                </Link>
                <div className="border-t border-border" />
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors rounded-b-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? 'Deleting...' : 'Delete Line'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Verification Banner */}
      {!isVerified && (
        <div className="mt-4">
          <Link
            href={`/dashboard/lines/${line.id}/verify`}
            className="flex items-center gap-2 w-full justify-center rounded-lg border border-warning/50 bg-warning/5 px-4 py-2 text-sm font-medium text-warning hover:bg-warning/10 transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify Phone Number
          </Link>
        </div>
      )}

      {/* Call Info */}
      {isVerified && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last call
              </p>
              <p className="font-medium text-foreground">
                {line.last_successful_call_at
                  ? formatDistanceToNow(new Date(line.last_successful_call_at), { addSuffix: true })
                  : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Next scheduled
              </p>
              <p className="font-medium text-foreground">
                {line.next_scheduled_call_at
                  ? formatNextCall(line.next_scheduled_call_at)
                  : 'Not scheduled'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Opted Out Warning */}
      {isOptedOut && (
        <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Outbound calls stopped</p>
              <p className="text-xs text-destructive/80 mt-0.5">
                This person has opted out of receiving calls.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatPhoneNumber(e164: string): string {
  // Format +15551234567 to (555) 123-4567
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const areaCode = digits.slice(1, 4);
    const exchange = digits.slice(4, 7);
    const subscriber = digits.slice(7);
    return `(${areaCode}) ${exchange}-${subscriber}`;
  }
  return e164;
}

function formatNextCall(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) {
    return 'Soon';
  }

  if (diff < 24 * 60 * 60 * 1000) {
    // Today
    return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  if (diff < 48 * 60 * 60 * 1000) {
    // Tomorrow
    return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  // Other days
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
