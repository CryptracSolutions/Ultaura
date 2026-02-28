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
  hasPending: boolean;
}

const DEFAULT_DELAY_MS = 1300;
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_SAVE_ERROR = 'Failed to save';

export function useAutoSave<T>(
  options: UseAutoSaveOptions<T>,
): UseAutoSaveReturn<T> {
  const [isSaving, setIsSaving] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const pendingValueRef = useRef<{ value: T } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const retryRef = useRef<{ value: T } | null>(null);
  const retryCountRef = useRef(0);
  const unmountedRef = useRef(false);
  const savePromiseRef = useRef<Promise<void> | null>(null);

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
          toast.error(result.error || DEFAULT_SAVE_ERROR);
        }
      }
    } catch {
      if (!unmountedRef.current) {
        toast.error(DEFAULT_SAVE_ERROR);
      }
    } finally {
      savingRef.current = false;
      if (!unmountedRef.current) setIsSaving(false);

      // If a new value arrived while saving, retry with the latest
      if (retryRef.current) {
        if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) {
          retryRef.current = null;
          if (!unmountedRef.current) {
            setHasPending(false);
            toast.error('Failed to save after multiple attempts');
          }
          return;
        }
        retryCountRef.current += 1;
        const next = retryRef.current;
        retryRef.current = null;
        await doSave(next.value);
      } else if (!unmountedRef.current) {
        retryCountRef.current = 0;
        setHasPending(false);
      }
    }
  }, []);

  const runSave = useCallback(
    (value: T) => {
      const savePromise = doSave(value).finally(() => {
        if (savePromiseRef.current === savePromise) {
          savePromiseRef.current = null;
        }
      });
      savePromiseRef.current = savePromise;
      return savePromise;
    },
    [doSave],
  );

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (pendingValueRef.current) {
      const pending = pendingValueRef.current;
      pendingValueRef.current = null;
      await runSave(pending.value);
    } else if (savePromiseRef.current) {
      await savePromiseRef.current;
    } else {
      setHasPending(false);
    }
  }, [runSave]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingValueRef.current = null;
    retryRef.current = null;
    retryCountRef.current = 0;
    setHasPending(false);
  }, []);

  const triggerSave = useCallback(
    (value: T) => {
      if (optionsRef.current.disabled) return;

      pendingValueRef.current = { value };
      setHasPending(true);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // If a save is in-flight, queue for retry instead of debouncing
      if (savingRef.current) {
        retryRef.current = { value };
        return;
      }

      const delay = optionsRef.current.delay ?? DEFAULT_DELAY_MS;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingValueRef.current;
        pendingValueRef.current = null;
        if (pending) {
          void runSave(pending.value);
        }
      }, delay);
    },
    [runSave],
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

  return { triggerSave, flush, cancel, isSaving, hasPending };
}
