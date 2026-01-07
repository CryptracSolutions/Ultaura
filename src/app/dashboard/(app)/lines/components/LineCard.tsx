'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
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
import { deleteLine } from '~/lib/ultaura/lines';
import { formatDistanceToNow } from 'date-fns';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';

interface LineCardProps {
  line: LineRow;
  disabled?: boolean;
}

export function LineCard({ line, disabled = false }: LineCardProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleDelete = async () => {
    const result = await deleteLine(line.id);
    if (!result.success) {
      toast.error(result.error.message || 'Failed to delete line');
      throw new Error('Delete failed');
    }
    toast.success('Line deleted');
    router.refresh();
  };

  const openDeleteDialog = () => {
    setIsMenuOpen(false);
    setDeleteDialogOpen(true);
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

  // Determine link destination based on verification status
  const shortId = line.short_id;
  const linkHref = isVerified
    ? `/dashboard/lines/${shortId}`
    : `/dashboard/lines/${shortId}/verify`;

  return (
    <div
      className={`bg-card rounded-xl border shadow-sm hover:shadow-md transition-all relative ${
        !isVerified ? 'border-warning/50' : isOptedOut || isDisabled ? 'border-destructive/50' : 'border-border'
      }`}
    >
      {/* Clickable card link - covers the main area */}
      <Link
        href={linkHref}
        className="absolute inset-0 z-0 rounded-xl"
        aria-label={`View ${line.display_name}`}
      />

      {/* Header */}
      <div className={`relative ${isMenuOpen ? 'z-50' : 'z-10'} p-6 pb-0`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4 pointer-events-none">
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const next = !isMenuOpen;
                setIsMenuOpen(next);
              }}
              className="p-2 rounded-md hover:bg-muted transition-colors pointer-events-auto"
            >
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
            </button>
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-transparent backdrop-blur-none"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsMenuOpen(false);
                  }}
                />
                <div
                  className="absolute right-0 mt-1 w-48 bg-background rounded-lg shadow-2xl border border-border/80 ring-1 ring-border/60 z-50 pointer-events-auto"
                >
                  <Link
                    href={`/dashboard/lines/${shortId}`}
                    className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors rounded-t-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Details
                  </Link>
                  <Link
                    href={`/dashboard/lines/${shortId}/settings`}
                    className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Settings
                  </Link>
                  {!disabled && (
                    <>
                      <div className="border-t border-border" />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          openDeleteDialog();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors rounded-b-lg flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Line
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Verification Banner */}
      {!isVerified && (
        <div className="relative z-10 px-6 pb-6 pt-4 pointer-events-none">
          <div
            className="flex items-center gap-2 w-full justify-center rounded-lg border border-warning/50 bg-warning/5 px-4 py-2 text-sm font-medium text-warning"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify Phone Number
          </div>
        </div>
      )}

      {/* Call Info */}
      {isVerified && (
        <div className="relative z-10 px-6 pb-6 pt-4 pointer-events-none">
          <div className="pt-4 border-t border-border">
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
        </div>
      )}

      {/* Opted Out Warning */}
      {isOptedOut && (
        <div className="relative z-10 px-6 pb-6 pointer-events-none">
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
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
        </div>
      )}

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Line"
        description={`Are you sure you want to delete "${line.display_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
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
