'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type PendingNavigation = {
  href: string;
  scroll?: boolean;
} | null;

export function useLeavePageGuard({
  isDirty,
  onDiscard,
}: {
  isDirty: boolean;
  onDiscard?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null);

  const handleConfirmLeave = useCallback(() => {
    if (onDiscard) {
      onDiscard();
    }

    if (pendingNavigation) {
      router.push(pendingNavigation.href, {
        scroll: pendingNavigation.scroll ?? false,
      });
    }

    setPendingNavigation(null);
    setIsOpen(false);
  }, [onDiscard, pendingNavigation, router]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setPendingNavigation(null);
    }
  }, []);

  useEffect(() => {
    if (!isDirty) {
      setIsOpen(false);
      setPendingNavigation(null);
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const handleDocumentClick = (event: MouseEvent) => {
      if (isOpen) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;

      const hrefAttr = anchor.getAttribute('href');
      if (!hrefAttr || hrefAttr.startsWith('#')) return;

      const targetAttr = anchor.getAttribute('target');
      if (targetAttr && targetAttr !== '_self') return;

      const url = new URL(hrefAttr, window.location.origin);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === pathname) return;

      event.preventDefault();
      setPendingNavigation({
        href: `${url.pathname}${url.search}${url.hash}`,
        scroll: false,
      });
      setIsOpen(true);
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [isDirty, isOpen, pathname]);

  return {
    dialogProps: {
      open: isOpen,
      onOpenChange: handleOpenChange,
      onConfirm: handleConfirmLeave,
    },
  };
}
