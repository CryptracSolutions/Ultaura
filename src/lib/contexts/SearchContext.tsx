'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { DocsIndexItem } from '~/lib/search/types';

type OpenMode = 'desktop' | 'mobile' | null;

interface SearchContextValue {
  openMode: OpenMode;
  isOpen: boolean;
  isDesktopOpen: boolean;
  isMobileOpen: boolean;
  openDesktop: () => void;
  openDesktopWithQuery: (query: string) => void;
  openMobile: () => void;
  close: () => void;
  toggleDesktop: () => void;
  docsIndex: DocsIndexItem[];
  prefillQuery: string;
  clearPrefillQuery: () => void;
}

const SearchContext = createContext<SearchContextValue | undefined>(undefined);

export function SearchProvider({
  children,
  docsIndex,
}: {
  children: React.ReactNode;
  docsIndex: DocsIndexItem[];
}) {
  const [openMode, setOpenMode] = useState<OpenMode>(null);
  const [prefillQuery, setPrefillQuery] = useState('');

  const openDesktop = useCallback(() => {
    setPrefillQuery('');
    setOpenMode('desktop');
  }, []);
  const openDesktopWithQuery = useCallback((query: string) => {
    setPrefillQuery(query);
    setOpenMode('desktop');
  }, []);
  const openMobile = useCallback(() => setOpenMode('mobile'), []);
  const close = useCallback(() => setOpenMode(null), []);
  const toggleDesktop = useCallback(() => {
    setOpenMode((current) => (current === 'desktop' ? null : 'desktop'));
  }, []);
  const clearPrefillQuery = useCallback(() => setPrefillQuery(''), []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isEditable) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        toggleDesktop();
        return;
      }

      const isTypingShortcut =
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        event.key.length === 1;

      if (isTypingShortcut) {
        event.preventDefault();
        openDesktopWithQuery(event.key);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [openDesktopWithQuery, toggleDesktop]);

  const value = useMemo(
    () => ({
      openMode,
      isOpen: openMode !== null,
      isDesktopOpen: openMode === 'desktop',
      isMobileOpen: openMode === 'mobile',
      openDesktop,
      openDesktopWithQuery,
      openMobile,
      close,
      toggleDesktop,
      docsIndex,
      prefillQuery,
      clearPrefillQuery,
    }),
    [
      clearPrefillQuery,
      close,
      docsIndex,
      openDesktop,
      openDesktopWithQuery,
      openMode,
      openMobile,
      prefillQuery,
      toggleDesktop,
    ]
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
