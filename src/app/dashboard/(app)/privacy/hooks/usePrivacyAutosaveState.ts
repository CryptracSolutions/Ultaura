'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAutoSave } from '~/core/hooks/use-auto-save';
import { updatePrivacySettings } from '~/lib/ultaura/privacy';
import type { AccountPrivacySettings, RetentionPeriod } from '~/lib/ultaura/types';

const DEFAULT_RETENTION: RetentionPeriod = '90_days';

type PrivacyAutosavePayload = {
  recordingEnabled: boolean;
  aiSummarizationEnabled: boolean;
  retentionPeriod: RetentionPeriod;
};

export function buildPrivacyAutosavePayload({
  recordingEnabled,
  aiSummarizationEnabled,
  retentionPeriod,
}: PrivacyAutosavePayload): PrivacyAutosavePayload {
  return {
    recordingEnabled,
    aiSummarizationEnabled,
    retentionPeriod,
  };
}

export function getRetentionChangeDecision({
  currentRetention,
  nextRetention,
  isPrivacySettingsUnavailable,
}: {
  currentRetention: RetentionPeriod;
  nextRetention: RetentionPeriod;
  isPrivacySettingsUnavailable: boolean;
}): { shouldPrompt: boolean; pendingRetentionPeriod: RetentionPeriod | null } {
  if (isPrivacySettingsUnavailable || nextRetention === currentRetention) {
    return { shouldPrompt: false, pendingRetentionPeriod: null };
  }

  return {
    shouldPrompt: true,
    pendingRetentionPeriod: nextRetention,
  };
}

export interface UsePrivacyAutosaveStateOptions {
  accountId: string;
  privacySettings: AccountPrivacySettings | null;
  onSaveSuccess?: () => void;
  /**
   * Optional external save state (for example a sibling autosave hook) that
   * should pause props-to-state synchronization to avoid clobbering in-flight edits.
   */
  externalSaving?: boolean;
}

export interface UsePrivacyAutosaveStateResult {
  isPrivacySettingsUnavailable: boolean;
  recordingEnabled: boolean;
  aiSummarizationEnabled: boolean;
  retentionPeriod: RetentionPeriod;
  pendingRetentionPeriod: RetentionPeriod | null;
  retentionConfirmOpen: boolean;
  setRetentionConfirmOpen: (open: boolean) => void;
  privacyAutoSave: ReturnType<typeof useAutoSave<PrivacyAutosavePayload>>;
  onRecordingToggle: (checked: boolean) => void;
  onSummarizationToggle: (checked: boolean) => void;
  onRetentionSelect: (value: RetentionPeriod) => void;
  confirmRetentionChange: () => void;
  cancelRetentionChange: () => void;
  getCurrentPayload: () => PrivacyAutosavePayload;
}

export function usePrivacyAutosaveState({
  accountId,
  privacySettings,
  onSaveSuccess,
  externalSaving = false,
}: UsePrivacyAutosaveStateOptions): UsePrivacyAutosaveStateResult {
  const initialRecordingEnabled = privacySettings?.recordingEnabled ?? false;
  const initialAiSummarizationEnabled =
    privacySettings?.aiSummarizationEnabled ?? true;
  const initialRetentionPeriod =
    privacySettings?.retentionPeriod ?? DEFAULT_RETENTION;

  const isPrivacySettingsUnavailable = privacySettings === null;

  const [recordingEnabled, setRecordingEnabled] = useState(
    initialRecordingEnabled,
  );
  const [aiSummarizationEnabled, setAiSummarizationEnabled] = useState(
    initialAiSummarizationEnabled,
  );
  const [retentionPeriod, setRetentionPeriod] =
    useState<RetentionPeriod>(initialRetentionPeriod);
  const [retentionConfirmOpen, setRetentionConfirmOpen] = useState(false);
  const [pendingRetentionPeriod, setPendingRetentionPeriod] =
    useState<RetentionPeriod | null>(null);

  const recordingEnabledRef = useRef(initialRecordingEnabled);
  const aiSummarizationEnabledRef = useRef(initialAiSummarizationEnabled);
  const retentionPeriodRef = useRef<RetentionPeriod>(initialRetentionPeriod);

  const privacyAutoSave = useAutoSave<PrivacyAutosavePayload>({
    saveFn: async (value) => {
      if (isPrivacySettingsUnavailable) {
        return {
          success: false,
          error: 'Privacy settings are temporarily unavailable',
        };
      }
      const result = await updatePrivacySettings(accountId, value);
      if (result.success) {
        return { success: true };
      }
      return { success: false, error: result.error || 'Failed to save' };
    },
    toastSuccess: 'Privacy settings saved',
    onSuccess: onSaveSuccess,
  });
  const {
    triggerSave: triggerPrivacyAutoSave,
    flush: flushPrivacyAutoSave,
    cancel: cancelPrivacyAutoSave,
    isSaving: privacyAutoSaveIsSaving,
    hasPending: privacyAutoSaveHasPending,
  } = privacyAutoSave;

  useEffect(() => {
    if (privacyAutoSaveIsSaving || externalSaving) return;

    setRecordingEnabled(initialRecordingEnabled);
    setAiSummarizationEnabled(initialAiSummarizationEnabled);
    setRetentionPeriod(initialRetentionPeriod);

    recordingEnabledRef.current = initialRecordingEnabled;
    aiSummarizationEnabledRef.current = initialAiSummarizationEnabled;
    retentionPeriodRef.current = initialRetentionPeriod;
  }, [
    externalSaving,
    initialAiSummarizationEnabled,
    initialRecordingEnabled,
    initialRetentionPeriod,
    privacyAutoSaveIsSaving,
  ]);

  const getCurrentPayload = useCallback((): PrivacyAutosavePayload => {
    return buildPrivacyAutosavePayload({
      recordingEnabled: recordingEnabledRef.current,
      aiSummarizationEnabled: aiSummarizationEnabledRef.current,
      retentionPeriod: retentionPeriodRef.current,
    });
  }, []);

  const triggerPrivacySave = useCallback(
    (payload: PrivacyAutosavePayload) => {
      triggerPrivacyAutoSave(buildPrivacyAutosavePayload(payload));
    },
    [triggerPrivacyAutoSave],
  );

  const onRecordingToggle = useCallback(
    (checked: boolean) => {
      if (isPrivacySettingsUnavailable) return;

      recordingEnabledRef.current = checked;
      setRecordingEnabled(checked);
      triggerPrivacySave({
        recordingEnabled: checked,
        aiSummarizationEnabled: aiSummarizationEnabledRef.current,
        retentionPeriod: retentionPeriodRef.current,
      });
    },
    [isPrivacySettingsUnavailable, triggerPrivacySave],
  );

  const onSummarizationToggle = useCallback(
    (checked: boolean) => {
      if (isPrivacySettingsUnavailable) return;

      aiSummarizationEnabledRef.current = checked;
      setAiSummarizationEnabled(checked);
      triggerPrivacySave({
        recordingEnabled: recordingEnabledRef.current,
        aiSummarizationEnabled: checked,
        retentionPeriod: retentionPeriodRef.current,
      });
    },
    [isPrivacySettingsUnavailable, triggerPrivacySave],
  );

  const onRetentionSelect = useCallback(
    (value: RetentionPeriod) => {
      const decision = getRetentionChangeDecision({
        currentRetention: retentionPeriod,
        nextRetention: value,
        isPrivacySettingsUnavailable,
      });
      if (!decision.shouldPrompt || !decision.pendingRetentionPeriod) return;
      setPendingRetentionPeriod(decision.pendingRetentionPeriod);
      setRetentionConfirmOpen(true);
    },
    [isPrivacySettingsUnavailable, retentionPeriod],
  );

  const cancelRetentionChange = useCallback(() => {
    setRetentionConfirmOpen(false);
    setPendingRetentionPeriod(null);
  }, []);

  const confirmRetentionChange = useCallback(() => {
    if (!pendingRetentionPeriod) return;

    retentionPeriodRef.current = pendingRetentionPeriod;
    setRetentionPeriod(pendingRetentionPeriod);

    triggerPrivacySave({
      recordingEnabled: recordingEnabledRef.current,
      aiSummarizationEnabled: aiSummarizationEnabledRef.current,
      retentionPeriod: pendingRetentionPeriod,
    });

    setRetentionConfirmOpen(false);
    setPendingRetentionPeriod(null);
  }, [pendingRetentionPeriod, triggerPrivacySave]);

  const handleSetRetentionConfirmOpen = useCallback((open: boolean) => {
    setRetentionConfirmOpen(open);
    if (!open) {
      setPendingRetentionPeriod(null);
    }
  }, []);

  return useMemo(
    () => ({
      isPrivacySettingsUnavailable,
      recordingEnabled,
      aiSummarizationEnabled,
      retentionPeriod,
      pendingRetentionPeriod,
      retentionConfirmOpen,
      setRetentionConfirmOpen: handleSetRetentionConfirmOpen,
      privacyAutoSave: {
        triggerSave: triggerPrivacyAutoSave,
        flush: flushPrivacyAutoSave,
        cancel: cancelPrivacyAutoSave,
        isSaving: privacyAutoSaveIsSaving,
        hasPending: privacyAutoSaveHasPending,
      },
      onRecordingToggle,
      onSummarizationToggle,
      onRetentionSelect,
      confirmRetentionChange,
      cancelRetentionChange,
      getCurrentPayload,
    }),
    [
      aiSummarizationEnabled,
      cancelRetentionChange,
      confirmRetentionChange,
      getCurrentPayload,
      handleSetRetentionConfirmOpen,
      isPrivacySettingsUnavailable,
      onRecordingToggle,
      onRetentionSelect,
      onSummarizationToggle,
      pendingRetentionPeriod,
      triggerPrivacyAutoSave,
      flushPrivacyAutoSave,
      cancelPrivacyAutoSave,
      privacyAutoSaveIsSaving,
      privacyAutoSaveHasPending,
      recordingEnabled,
      retentionConfirmOpen,
      retentionPeriod,
    ],
  );
}
