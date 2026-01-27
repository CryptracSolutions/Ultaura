'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AddReminderModal, type LineForReminderModal } from '~/components/ultaura/AddReminderModal';
import useSupabase from '~/core/hooks/use-supabase';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';

type AddReminderContextValue = {
  openAddReminder: (options?: { preselectedLineId?: string }) => void;
};

const AddReminderContext = createContext<AddReminderContextValue | undefined>(undefined);

export function AddReminderProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase();
  const { data: account } = useUltauraAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [preselectedLineId, setPreselectedLineId] = useState<string | null>(null);
  const [lines, setLines] = useState<LineForReminderModal[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const openAddReminder = useCallback((options?: { preselectedLineId?: string }) => {
    setPreselectedLineId(options?.preselectedLineId ?? null);
    setIsOpen(true);
  }, []);

  const closeAddReminder = useCallback(() => {
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
          .select('id, display_name, timezone, phone_e164')
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
            displayName: line.display_name,
            timezone: line.timezone,
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

  const value = useMemo(() => ({ openAddReminder }), [openAddReminder]);

  return (
    <AddReminderContext.Provider value={value}>
      {children}
      {!isLoading && (
        <AddReminderModal
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeAddReminder();
            } else {
              setIsOpen(true);
            }
          }}
          lines={lines}
          preselectedLineId={preselectedLineId}
        />
      )}
    </AddReminderContext.Provider>
  );
}

export function useAddReminder() {
  const context = useContext(AddReminderContext);
  if (!context) {
    throw new Error('useAddReminder must be used within an AddReminderProvider');
  }
  return context;
}
