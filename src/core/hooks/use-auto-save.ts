'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface UseAutoSaveOptions<T> {
  saveFn: (value: T) => Promise<{ success: boolean; error?: string }>;
  delay?: number;
  toastSuccess?: string;
  onSuccess?: () => void;
  disabled?: boolean;
}

interface UseAutoSaveReturn<T> {
  triggerSave: (value: T) => void;
  flush: () => Promise<void>;
  cancel: () => void;
  isSaving: boolean;
}

export function useAutoSave<T>(
  options: UseAutoSaveOptions<T>,
): UseAutoSaveReturn<T> {
  const [isSaving, setIsSaving] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const pendingValueRef = useRef<{ value: T } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const retryRef = useRef<{ value: T } | null>(null);
  const unmountedRef = useRef(false);

  const doSave = useCallback(async (value: T) => {
    const { saveFn, toastSuccess, onSuccess, disabled } = optionsRef.current;
    if (disabled) return;

    savingRef.current = true;
    if (!unmountedRef.current) setIsSaving(true);

    try {
      const result = await saveFn(value);

      if (!unmountedRef.current) {
        if (result.success) {
          if (toastSuccess) toast.success(toastSuccess);
          onSuccess?.();
        } else {
          toast.error(result.error || 'Failed to save');
        }
      }
    } catch {
      if (!unmountedRef.current) {
        toast.error('Failed to save');
      }
    } finally {
      savingRef.current = false;
      if (!unmountedRef.current) setIsSaving(false);

      // If a new value arrived while saving, retry with the latest
      if (retryRef.current) {
        const next = retryRef.current;
        retryRef.current = null;
        doSave(next.value);
      }
    }
  }, []);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (pendingValueRef.current) {
      const pending = pendingValueRef.current;
      pendingValueRef.current = null;
      await doSave(pending.value);
    }
  }, [doSave]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingValueRef.current = null;
    retryRef.current = null;
  }, []);

  const triggerSave = useCallback(
    (value: T) => {
      if (optionsRef.current.disabled) return;

      pendingValueRef.current = { value };

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // If a save is in-flight, queue for retry instead of debouncing
      if (savingRef.current) {
        retryRef.current = { value };
        return;
      }

      const delay = optionsRef.current.delay ?? 1300;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingValueRef.current;
        pendingValueRef.current = null;
        if (pending) {
          doSave(pending.value);
        }
      }, delay);
    },
    [doSave],
  );

  // Flush on unmount
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Best-effort flush — fire-and-forget
      if (pendingValueRef.current) {
        const pending = pendingValueRef.current;
        pendingValueRef.current = null;
        const { saveFn, disabled } = optionsRef.current;
        if (!disabled) {
          saveFn(pending.value).catch(() => {});
        }
      }
    };
  }, []);

  return { triggerSave, flush, cancel, isSaving };
}
