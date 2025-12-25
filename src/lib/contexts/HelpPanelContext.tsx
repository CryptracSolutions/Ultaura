'use client';

import { createContext, useContext, useState, useCallback } from 'react';

interface HelpPanelContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const HelpPanelContext = createContext<HelpPanelContextType | undefined>(undefined);

export function HelpPanelProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <HelpPanelContext.Provider value={{ isOpen, open, close }}>
      {children}
    </HelpPanelContext.Provider>
  );
}

export function useHelpPanel() {
  const context = useContext(HelpPanelContext);
  if (context === undefined) {
    throw new Error('useHelpPanel must be used within a HelpPanelProvider');
  }
  return context;
}
