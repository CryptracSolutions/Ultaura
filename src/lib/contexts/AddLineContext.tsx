'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AddLineModal } from '~/app/dashboard/(app)/lines/components/AddLineModal';
import useSupabase from '~/core/hooks/use-supabase';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import type { UserType } from '~/lib/ultaura/types';

type AddLineContextValue = {
  openAddLine: () => void;
};

const AddLineContext = createContext<AddLineContextValue | undefined>(undefined);

export function AddLineProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase();
  const { data: account } = useUltauraAccount();
  const [isOpen, setIsOpen] = useState(false);
  const [vendorAlreadyAcknowledged, setVendorAlreadyAcknowledged] = useState(false);

  const openAddLine = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeAddLine = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Fetch privacy settings when modal opens
  useEffect(() => {
    if (!isOpen || !account?.id) return;

    let isActive = true;

    supabase
      .from('ultaura_account_privacy_settings')
      .select('vendor_disclosure_acknowledged_at')
      .eq('account_id', account.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!isActive) return;
        setVendorAlreadyAcknowledged(!!data?.vendor_disclosure_acknowledged_at);
      });

    return () => {
      isActive = false;
    };
  }, [account?.id, isOpen, supabase]);

  const value = useMemo(() => ({ openAddLine }), [openAddLine]);

  // Don't render modal if account data isn't ready
  const canRenderModal = account?.id;

  // Cast user_type to UserType if it's a valid value
  const userType: UserType | undefined =
    account?.user_type === 'self' || account?.user_type === 'family_managed'
      ? account.user_type
      : undefined;

  return (
    <AddLineContext.Provider value={value}>
      {children}
      {canRenderModal && (
        <AddLineModal
          isOpen={isOpen}
          onClose={closeAddLine}
          accountId={account.id}
          userType={userType}
          vendorAlreadyAcknowledged={vendorAlreadyAcknowledged}
        />
      )}
    </AddLineContext.Provider>
  );
}

export function useAddLine() {
  const context = useContext(AddLineContext);
  if (!context) {
    throw new Error('useAddLine must be used within an AddLineProvider');
  }
  return context;
}
