'use client';

import { useMemo, useState } from 'react';
import type { LineRow, WellnessAlert } from '~/lib/ultaura/types';
import { WellnessAlertsList } from './WellnessAlertsList';
import { AlertSettings } from './AlertSettings';
import { AlertsLineFilter } from './components/AlertsLineFilter';

interface AlertsPageClientProps {
  alerts: WellnessAlert[];
  lines: LineRow[];
  settings: Parameters<typeof AlertSettings>[0]['settings'];
  deliveryEmail: string;
  disabled?: boolean;
}

export function AlertsPageClient({ alerts, lines, settings, deliveryEmail, disabled }: AlertsPageClientProps) {
  const [selectedLineId, setSelectedLineId] = useState('all');

  const filteredAlerts = useMemo(() => {
    if (selectedLineId === 'all') return alerts;
    return alerts.filter((alert) => alert.lineId === selectedLineId);
  }, [alerts, selectedLineId]);

  const filteredSettings = useMemo(() => {
    if (selectedLineId === 'all') return settings;
    return settings.filter((s) => s.line.id === selectedLineId);
  }, [settings, selectedLineId]);

  const lineFilterData = lines.map((l) => ({
    id: l.id,
    display_name: l.display_name,
  }));

  return (
    <div className="space-y-6 pb-12">
      {lines.length > 1 && (
        <div className="w-full sm:w-[16rem] rounded-xl ring-2 ring-primary">
          <AlertsLineFilter
            lines={lineFilterData}
            value={selectedLineId}
            onValueChange={setSelectedLineId}
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <WellnessAlertsList alerts={filteredAlerts} disabled={disabled} />
        <AlertSettings settings={filteredSettings} deliveryEmail={deliveryEmail} disabled={disabled} />
      </div>
    </div>
  );
}
