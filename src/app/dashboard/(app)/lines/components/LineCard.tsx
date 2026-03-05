'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  PhoneCall,
  MoreVertical,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  Palmtree,
  CheckCircle,
  Eye,
  Settings,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import { LineRow } from '~/lib/ultaura/types';
import { deleteLine } from '~/lib/ultaura/lines';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '~/core/ui/Dropdown';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';
import { Dialog, DialogContent, DialogTitle } from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
import { useIsViewer } from '~/lib/contexts/viewer';

interface LineCardProps {
  line: LineRow;
  disabled?: boolean;
  callStatus?: 'ringing' | 'in_progress' | null;
  isOnVacation?: boolean;
}

export function LineCard({
  line,
  disabled = false,
  callStatus = null,
  isOnVacation = false,
}: LineCardProps) {
  const isViewer = useIsViewer();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
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

  const openDeleteFromSheet = () => {
    setIsSheetOpen(false);
    setDeleteDialogOpen(true);
  };

  const isVerified = !!line.phone_verified_at;
  const isActive = line.status === 'active';
  const isPaused = line.status === 'paused';
  const isDisabled = line.status === 'disabled';
  const isOptedOut = line.do_not_call;
  const callBadge = callStatus === 'in_progress'
    ? { label: 'On call', className: 'bg-green-100 text-green-800 animate-pulse' }
    : callStatus === 'ringing'
    ? { label: 'Calling...', className: 'bg-blue-100 text-blue-800 animate-pulse' }
    : null;

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
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
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
  const linkHref = `/dashboard/lines/${shortId}`;

  return (
    <div
      className={`bg-card rounded-xl border shadow-sm hover:shadow-md transition-all relative flex flex-col cursor-pointer ${
        !isVerified ? 'border-warning/50' : isOptedOut || isDisabled ? 'border-destructive/50' : 'border-border'
      }`}
    >
      {/* Clickable card link - covers the main area */}
      <Link
        href={linkHref}
        className="absolute inset-0 z-10 rounded-xl"
        aria-label={`View ${line.display_name}`}
      />

      {/* Header */}
      <div className={`relative ${isMenuOpen ? 'z-50' : 'z-10'} p-6 pointer-events-none`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-full ${getIconBgClass()} flex items-center justify-center`}>
              <User className={`w-6 h-6 ${getIconColorClass()}`} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="min-w-0 flex-1 font-semibold text-foreground truncate">
                  {line.display_name}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {callBadge && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${callBadge.className}`}
                  >
                    <PhoneCall className="w-3 h-3" />
                    {callBadge.label}
                  </span>
                )}
                {isOnVacation && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    <Palmtree className="w-3 h-3" />
                    Vacation
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle className={`w-3 h-3 ${isVerified ? 'text-primary' : 'text-muted-foreground/60'}`} />
                    <span>{formattedPhone}</span>
                  </span>
                  <span className="text-border">•</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3 text-primary" />
                    <span>{formatTimezone(line.timezone)}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="relative pointer-events-auto flex flex-col items-end gap-2 -mt-3">
            {!isViewer ? (
              <DropdownMenu
              open={isMenuOpen}
              onOpenChange={(open) => {
                if (open && typeof window !== 'undefined' && !window.matchMedia('(min-width: 640px)').matches) {
                  setIsSheetOpen(true);
                } else {
                  setIsMenuOpen(open);
                }
              }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="pointer-events-auto">
                      <MoreVertical className="w-5 h-5 text-primary" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent sideOffset={20}>Menu</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link
                    href={`/dashboard/lines/${shortId}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Eye className="w-5 h-5 mr-2" />
                    View Details
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={`/dashboard/lines/${shortId}/settings`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Settings className="w-5 h-5 mr-2" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={`/dashboard/lines/${shortId}/settings?tab=call-controls`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SlidersHorizontal className="w-5 h-5 mr-2" />
                    Call Controls
                  </Link>
                </DropdownMenuItem>
                {!disabled && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openDeleteDialog();
                      }}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <Trash2 className="w-5 h-5 mr-2" />
                      Delete Line
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <div className="shrink-0">{getStatusBadge()}</div>
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

      {!isViewer ? (
        <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="z-[60] p-0" overlayClassName="z-[60]" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogTitle className="px-5 pt-5 pb-2 text-base font-semibold">
            {line.display_name}
          </DialogTitle>
          <div className="pb-2">
            <Link
              href={`/dashboard/lines/${shortId}`}
              onClick={() => setIsSheetOpen(false)}
              className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors touch-manipulation"
            >
              <Eye className="h-[22px] w-[22px] text-primary" />
              <span className="text-[14.5px] text-foreground">View Details</span>
            </Link>
            <Link
              href={`/dashboard/lines/${shortId}/settings`}
              onClick={() => setIsSheetOpen(false)}
              className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors touch-manipulation"
            >
              <Settings className="h-[22px] w-[22px] text-primary" />
              <span className="text-[14.5px] text-foreground">Settings</span>
            </Link>
            <Link
              href={`/dashboard/lines/${shortId}/settings?tab=call-controls`}
              onClick={() => setIsSheetOpen(false)}
              className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors touch-manipulation"
            >
              <SlidersHorizontal className="h-[22px] w-[22px] text-primary" />
              <span className="text-[14.5px] text-foreground">Call Controls</span>
            </Link>
            {!disabled && (
              <button
                onClick={openDeleteFromSheet}
                className="flex w-full items-center space-x-[14px] h-[50px] px-[14px] hover:bg-muted transition-colors touch-manipulation"
              >
                <Trash2 className="h-[22px] w-[22px] text-destructive" />
                <span className="text-[14.5px] text-destructive">Delete Line</span>
              </button>
            )}
          </div>
        </DialogContent>
        </Dialog>
      ) : null}
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

function formatTimezone(timezone: string): string {
  return timezone.replace(/_/g, ' ');
}
