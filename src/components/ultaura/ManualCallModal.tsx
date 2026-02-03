'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Phone, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '~/core/ui/Modal';
import useSupabase from '~/core/hooks/use-supabase';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import { initiateManualCall } from '~/lib/ultaura/usage';
import type { LineRow } from '~/lib/ultaura/types';
import type { ActionError } from '@ultaura/schemas';
import {
  COMPACT_OUTLINE_BUTTON_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';

type ManualCallModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedLineId?: string | null;
};

type LineOption = Pick<
  LineRow,
  'id' | 'display_name' | 'phone_e164' | 'status' | 'phone_verified_at' | 'do_not_call'
>;

function formatPhone(e164: string) {
  const match = e164.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : e164;
}

function resolveManualCallError(error: ActionError): string {
  const telephonyCode = error.details?.telephonyCode as string | undefined;
  const normalizedCode = (telephonyCode || '').toLowerCase();

  if (normalizedCode === 'do_not_call' || normalizedCode === 'line_opted_out') {
    return 'This line is opted out of calls. Update DNC settings to continue.';
  }

  if (normalizedCode === 'not_verified') {
    return 'This line is not verified yet. Verify the line to place a manual call.';
  }

  if (normalizedCode === 'trial_expired') {
    return 'Your trial has ended. Subscribe to continue.';
  }

  if (normalizedCode === 'minutes_cap') {
    return 'Minutes cap reached. Update your plan to continue.';
  }

  if (normalizedCode === 'quiet_hours') {
    return 'Quiet hours are active. Please try again later.';
  }

  return error.message || 'Failed to initiate manual call.';
}

export default function ManualCallModal({
  isOpen,
  onOpenChange,
  preselectedLineId,
}: ManualCallModalProps) {
  const supabase = useSupabase();
  const { data: account } = useUltauraAccount();
  const [lines, setLines] = useState<LineOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [isCalling, setIsCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLine = useMemo(
    () => lines.find((line) => line.id === selectedLineId) || null,
    [lines, selectedLineId],
  );

  const resetState = useCallback(() => {
    setSelectedLineId(preselectedLineId ?? null);
    setStep(preselectedLineId ? 2 : 1);
    setIsCalling(false);
    setError(null);
  }, [preselectedLineId]);

  useEffect(() => {
    if (!isOpen) return;
    resetState();
  }, [isOpen, resetState]);

  useEffect(() => {
    if (!isOpen || !account?.id) return;

    let isActive = true;
    setIsLoading(true);
    setError(null);

    const fetchLines = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('ultaura_lines')
          .select('id, display_name, phone_e164, status, phone_verified_at, do_not_call')
          .eq('account_id', account.id)
          .order('display_name', { ascending: true });

        if (!isActive) return;
        if (fetchError) {
          setError('Unable to load lines. Please try again.');
          setLines([]);
          return;
        }
        setLines((data || []) as LineOption[]);
      } catch {
        if (!isActive) return;
        setError('Unable to load lines. Please try again.');
        setLines([]);
      } finally {
        if (!isActive) return;
        setIsLoading(false);
      }
    };

    void fetchLines();

    return () => {
      isActive = false;
    };
  }, [account?.id, isOpen, supabase]);

  useEffect(() => {
    if (!isOpen) return;
    if (preselectedLineId) {
      setSelectedLineId(preselectedLineId);
      setStep(2);
    }
  }, [isOpen, preselectedLineId]);

  const handleSelectLine = (lineId: string) => {
    setSelectedLineId(lineId);
    setStep(2);
    setError(null);
  };

  const handleStartCall = async () => {
    if (!selectedLineId) return;
    setIsCalling(true);
    setError(null);
    try {
      const result = await initiateManualCall(selectedLineId, { overrideQuietHours: true });
      if (!result.success) {
        const message = resolveManualCallError(result.error);
        setError(message);
        toast.error(message);
        return;
      }
      toast.success('Manual call started.');
      onOpenChange(false);
    } catch {
      const message = 'Failed to initiate manual call.';
      setError(message);
      toast.error(message);
    } finally {
      setIsCalling(false);
    }
  };

  const getLineStatusLabel = (line: LineOption) => {
    if (line.status === 'disabled') return 'Disabled';
    if (!line.phone_verified_at) return 'Not verified';
    if (line.do_not_call) return 'DNC enabled';
    return null;
  };

  const isLineSelectable = (line: LineOption) => {
    if (line.status === 'disabled') return false;
    if (!line.phone_verified_at) return false;
    if (line.do_not_call) return false;
    return true;
  };

  return (
    <Modal
      heading="Place a call"
      description="Start a one-time check-in call right now."
      isOpen={isOpen}
      setIsOpen={onOpenChange}
    >
      <div className="space-y-4 text-sm">
        {step === 1 && (
          <>
            <p className="text-muted-foreground">
              Choose which line to call. Manual calls bypass quiet hours but still respect DNC settings.
            </p>
            {isLoading ? (
              <div className="rounded-lg border border-border p-4 text-muted-foreground">
                Loading lines…
              </div>
            ) : lines.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-muted-foreground">
                No lines available.
              </div>
            ) : (
              <div className="space-y-2">
                {lines.map((line) => {
                  const disabled = !isLineSelectable(line);
                  const statusLabel = getLineStatusLabel(line);
                  return (
                    <button
                      key={line.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => handleSelectLine(line.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-input bg-card px-4 py-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium text-foreground">
                            {line.display_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatPhone(line.phone_e164)}
                          </div>
                        </div>
                      </div>
                      {statusLabel && (
                        <span className="text-xs text-muted-foreground">{statusLabel}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {step === 2 && selectedLine && (
          <>
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div className="text-xs font-medium text-muted-foreground">Calling</div>
              <div className="text-sm font-semibold text-foreground">{selectedLine.display_name}</div>
              <div className="text-xs text-muted-foreground">{formatPhone(selectedLine.phone_e164)}</div>
            </div>
            <p className="text-muted-foreground">
              Ultaura will place a check-in call now. Quiet hours are bypassed for this manual call.
            </p>
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className={COMPACT_OUTLINE_BUTTON_CLASS}
            >
              Change line
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={COMPACT_OUTLINE_BUTTON_CLASS}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartCall}
            disabled={!selectedLineId || isCalling || isLoading}
            className={COMPACT_PRIMARY_BUTTON_CLASS}
          >
            {isCalling ? 'Calling…' : 'Start call'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
