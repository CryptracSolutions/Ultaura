'use client';

import { useEffect, useRef, useState } from 'react';
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
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    if (typeof window === 'undefined') return;

    const el = menuRef.current;
    if (!el) return;

    const cs = window.getComputedStyle(el);
    const root = window.getComputedStyle(document.documentElement);

    const chain: Array<{
      tag: string;
      className: string;
      opacity: string;
      transform: string;
      filter: string;
      backdropFilter: string;
      mixBlendMode: string;
      zIndex: string;
    }> = [];

    let cur: HTMLElement | null = el;
    for (let i = 0; i < 30; i += 1) {
      const ccs = window.getComputedStyle(cur);
      chain.push({
        tag: cur.tagName.toLowerCase(),
        className: (cur.getAttribute('class') || '').slice(0, 200),
        opacity: ccs.opacity,
        transform: ccs.transform,
        filter: ccs.filter,
        backdropFilter: (ccs as any).backdropFilter || '',
        mixBlendMode: (ccs as any).mixBlendMode || '',
        zIndex: ccs.zIndex,
      });
      cur = cur.parentElement;
      if (!cur) break;
    }

    const rect = el.getBoundingClientRect();
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);

    const hit = (document.elementsFromPoint?.(cx, cy) || []).slice(0, 8);
    const hitInfo = hit.map((node) => {
      const n = node as HTMLElement;
      const ncs = window.getComputedStyle(n);
      return {
        tag: n.tagName.toLowerCase(),
        className: (n.getAttribute('class') || '').slice(0, 200),
        bg: ncs.backgroundColor,
        opacity: ncs.opacity,
        position: ncs.position,
        zIndex: ncs.zIndex,
        pointerEvents: ncs.pointerEvents,
        isMenuEl: n === el,
      };
    });

    // #region agent log - menu transparency debug
    fetch(
      'http://127.0.0.1:7242/ingest/bfc7f6db-53e6-40c2-9811-6a220af63ed2',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'post-fix-3',
          hypothesisId: 'H5',
          location: 'LineCard.tsx:menu-open-computed-style',
          message: 'LineCard menu opened: computed styles + theme vars',
          data: {
            lineId: String(line.id),
            themeClass: (document.documentElement.getAttribute('class') || '').slice(0, 200),
            cssVars: {
              popover: root.getPropertyValue('--popover').trim(),
              colorPopover: root.getPropertyValue('--color-popover').trim(),
              background: root.getPropertyValue('--background').trim(),
              card: root.getPropertyValue('--card').trim(),
              surfaceElevated: root.getPropertyValue('--surface-elevated').trim(),
              colorSurfaceElevated: root.getPropertyValue('--color-surface-elevated').trim(),
            },
            menu: {
              className: (el.getAttribute('class') || '').slice(0, 250),
              rect: {
                left: Math.round(rect.left),
                top: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              backgroundColor: cs.backgroundColor,
              opacity: cs.opacity,
              zIndex: cs.zIndex,
              position: cs.position,
              filter: cs.filter,
              backdropFilter: (cs as any).backdropFilter || '',
              mixBlendMode: (cs as any).mixBlendMode || '',
              boxShadow: cs.boxShadow,
              borderColor: cs.borderColor,
            },
            ancestorChain: chain,
            hitTest: {
              point: { x: cx, y: cy },
              topElements: hitInfo,
            },
          },
          timestamp: Date.now(),
        }),
      },
    ).catch(() => {});
    // #region agent log - menu transparency debug
    fetch(
      'http://127.0.0.1:7242/ingest/bfc7f6db-53e6-40c2-9811-6a220af63ed2',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'debug-session',
          runId: 'post-fix-3',
          hypothesisId: 'H4',
          location: 'LineCard.tsx:oklch-support-check',
          message: 'CSS.supports checks for oklch and computed background-color',
          data: {
            lineId: String(line.id),
            ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
            supports: {
              bgOklchLiteral: typeof CSS !== 'undefined' ? CSS.supports('background-color', 'oklch(1 0 0)') : null,
              colorOklchLiteral: typeof CSS !== 'undefined' ? CSS.supports('color', 'oklch(1 0 0)') : null,
              bgComputed: typeof CSS !== 'undefined' ? CSS.supports('background-color', cs.backgroundColor) : null,
            },
            computed: {
              backgroundColor: cs.backgroundColor,
            },
          },
          timestamp: Date.now(),
        }),
      },
    ).catch(() => {});
    // #endregion agent log - menu transparency debug
    // #endregion agent log - menu transparency debug
  }, [isMenuOpen, line.id]);

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

  // Determine link destination based on verification status
  const linkHref = isVerified
    ? `/dashboard/lines/${line.id}`
    : `/dashboard/lines/${line.id}/verify`;

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
      <div className="relative z-10 p-6 pb-0">
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
                // #region agent log - menu transparency debug
                fetch(
                  'http://127.0.0.1:7242/ingest/bfc7f6db-53e6-40c2-9811-6a220af63ed2',
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      sessionId: 'debug-session',
                      runId: 'post-fix-3',
                      hypothesisId: 'H2',
                      location: 'LineCard.tsx:menu-button-click',
                      message: 'LineCard menu button clicked',
                      data: { lineId: String(line.id), nextIsMenuOpen: next },
                      timestamp: Date.now(),
                    }),
                  },
                ).catch(() => {});
                // #endregion agent log - menu transparency debug
                setIsMenuOpen(next);
              }}
              className="p-2 rounded-md hover:bg-muted transition-colors pointer-events-auto"
            >
              <MoreVertical className="w-5 h-5 text-muted-foreground" />
            </button>
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // #region agent log - menu transparency debug
                    fetch(
                      'http://127.0.0.1:7242/ingest/bfc7f6db-53e6-40c2-9811-6a220af63ed2',
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          sessionId: 'debug-session',
                          runId: 'post-fix-3',
                          hypothesisId: 'H3',
                          location: 'LineCard.tsx:menu-overlay-click',
                          message: 'LineCard menu dismissed via overlay click',
                          data: { lineId: String(line.id) },
                          timestamp: Date.now(),
                        }),
                      },
                    ).catch(() => {});
                    // #endregion agent log - menu transparency debug
                    setIsMenuOpen(false);
                  }}
                />
                <div
                  ref={menuRef}
                  className="absolute right-0 mt-1 w-48 bg-muted rounded-lg shadow-xl border border-border/70 ring-1 ring-border/40 z-20 pointer-events-auto"
                >
                  <Link
                    href={`/dashboard/lines/${line.id}`}
                    className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors rounded-t-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View Details
                  </Link>
                  <Link
                    href={`/dashboard/lines/${line.id}/settings`}
                    className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Settings
                  </Link>
                  <div className="border-t border-border" />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete();
                    }}
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
