'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ManualCallModal from '~/components/ultaura/ManualCallModal';

type ManualCallContextValue = {
  openManualCall: (options?: { preselectedLineId?: string }) => void;
};

const ManualCallContext = createContext<ManualCallContextValue | undefined>(undefined);

export function ManualCallProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [preselectedLineId, setPreselectedLineId] = useState<string | null>(null);

  const openManualCall = useCallback((options?: { preselectedLineId?: string }) => {
    setPreselectedLineId(options?.preselectedLineId ?? null);
    setIsOpen(true);
  }, []);

  const closeManualCall = useCallback(() => {
    setIsOpen(false);
    setPreselectedLineId(null);
  }, []);

  const value = useMemo(() => ({ openManualCall }), [openManualCall]);

  return (
    <ManualCallContext.Provider value={value}>
      {children}
      <ManualCallModal
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeManualCall();
          } else {
            setIsOpen(true);
          }
        }}
        preselectedLineId={preselectedLineId}
      />
    </ManualCallContext.Provider>
  );
}

export function useManualCall() {
  const context = useContext(ManualCallContext);
  if (!context) {
    throw new Error('useManualCall must be used within a ManualCallProvider');
  }
  return context;
}
