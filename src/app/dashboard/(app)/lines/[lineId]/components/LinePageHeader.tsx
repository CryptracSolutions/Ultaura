'use client';

import Link from 'next/link';
import { ArrowLeft, Phone, CheckCircle, Clock, MapPin } from 'lucide-react';
import { LineTabNav } from './LineTabNav';

interface LinePageHeaderProps {
  lineName: string;
  lineShortId: string;
  phoneE164: string;
  timezone: string;
  status: string;
  isVerified: boolean;
}

function formatPhone(e164: string) {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164;
}

function getStatusBadgeClass(status: string): string {
  if (status === 'active') return 'bg-success/10 text-success';
  if (status === 'paused') return 'bg-warning/10 text-warning';
  return 'bg-muted text-muted-foreground';
}

export function LinePageHeader({
  lineName,
  lineShortId,
  phoneE164,
  timezone,
  status,
  isVerified,
}: LinePageHeaderProps) {
  return (
    <div className="mb-6">
      {/* Back link */}
      <Link
        href="/dashboard/lines"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Lines
      </Link>

      {/* Line info row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{lineName}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-muted-foreground">
            {/* Phone */}
            <div className="flex items-center gap-1.5">
              <Phone className="w-4 h-4" />
              <span>{formatPhone(phoneE164)}</span>
              {isVerified && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span className="text-xs">Verified</span>
                </span>
              )}
            </div>
            {/* Timezone */}
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              <span>{timezone}</span>
            </div>
            {/* Status */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(status)}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <LineTabNav lineShortId={lineShortId} />
    </div>
  );
}
