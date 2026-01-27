'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AddScheduleModal, type LineForScheduleModal } from '~/components/ultaura/AddScheduleModal';
import useSupabase from '~/core/hooks/use-supabase';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';

type AddScheduleContextValue = {
  openAddSchedule: (options?: { preselectedLineId?: string }) => void;
};

const AddScheduleContext = createContext<AddScheduleContextValue | undefined>(undefined);

export function AddScheduleProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase();
  const { data: account } = useUltauraAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [preselectedLineId, setPreselectedLineId] = useState<string | null>(null);
  const [lines, setLines] = useState<LineForScheduleModal[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const openAddSchedule = useCallback((options?: { preselectedLineId?: string }) => {
    setPreselectedLineId(options?.preselectedLineId ?? null);
    setIsOpen(true);
  }, []);

  const closeAddSchedule = useCallback(() => {
    setIsOpen(false);
    setPreselectedLineId(null);
  }, []);

  // Fetch lines when modal opens
  useEffect(() => {
    if (!isOpen || !account?.id) return;

    let isActive = true;
    setIsLoading(true);

    const fetchLines = async () => {
      try {
        const { data, error } = await supabase
          .from('ultaura_lines')
          .select('id, account_id, display_name, timezone, quiet_hours_start, quiet_hours_end, phone_e164')
          .eq('account_id', account.id)
          .eq('status', 'active')
          .not('phone_verified_at', 'is', null)
          .order('display_name', { ascending: true });

        if (!isActive) return;

        if (error) {
          setLines([]);
          return;
        }

        setLines(
          (data || []).map((line) => ({
            id: line.id,
            accountId: line.account_id,
            displayName: line.display_name,
            timezone: line.timezone,
            quietHoursStart: line.quiet_hours_start,
            quietHoursEnd: line.quiet_hours_end,
            phoneE164: line.phone_e164,
          }))
        );
      } catch {
        if (!isActive) return;
        setLines([]);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchLines();

    return () => {
      isActive = false;
    };
  }, [account?.id, isOpen, supabase]);

  const value = useMemo(() => ({ openAddSchedule }), [openAddSchedule]);

  return (
    <AddScheduleContext.Provider value={value}>
      {children}
      {!isLoading && (
        <AddScheduleModal
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeAddSchedule();
            } else {
              setIsOpen(true);
            }
          }}
          lines={lines}
          preselectedLineId={preselectedLineId}
        />
      )}
    </AddScheduleContext.Provider>
  );
}

export function useAddSchedule() {
  const context = useContext(AddScheduleContext);
  if (!context) {
    throw new Error('useAddSchedule must be used within an AddScheduleProvider');
  }
  return context;
}
