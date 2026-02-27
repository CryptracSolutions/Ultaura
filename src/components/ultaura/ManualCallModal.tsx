'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Phone, AlertTriangle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import Modal from '~/core/ui/Modal';
import useSupabase from '~/core/hooks/use-supabase';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import { initiateManualCall } from '~/lib/ultaura/usage';
import {
  getMyLinkedContact,
  getTrustedContacts,
  linkUserToTrustedContact,
} from '~/lib/ultaura/contacts';
import type { LineRow } from '~/lib/ultaura/types';
import type { ActionError } from '@ultaura/schemas';
import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import Textarea from '~/core/ui/Textarea';
import { InfoTip } from '~/core/ui/InfoTip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/core/ui/Accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';

type ManualCallModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedLineId?: string | null;
};

type LineOption = Pick<
  LineRow,
  'id' | 'display_name' | 'phone_e164' | 'status' | 'phone_verified_at' | 'do_not_call'
>;

type TrustedContactOption = {
  id: string;
  name: string;
  relationship?: string | null;
};

type ContactLinkStatus = 'loading' | 'linked' | 'unlinked' | 'no_contacts';

const LIFE_NOTE_MAX_LENGTH = 200;
const GENERIC_LIFE_NOTE_REJECTION_MESSAGE =
  "This note couldn't be shared. Try rephrasing with general life updates rather than health questions or sensitive topics.";
const LIFE_NOTE_UNVERIFIED_TOAST_MESSAGE = "Your note couldn't be verified - call placed without it.";

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
  const [isScreeningNote, setIsScreeningNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lifeNote, setLifeNote] = useState('');
  const [lifeNoteRejectedMessage, setLifeNoteRejectedMessage] = useState<string | null>(null);
  const [trustedContacts, setTrustedContacts] = useState<TrustedContactOption[]>([]);
  const [isLoadingLifeNoteContext, setIsLoadingLifeNoteContext] = useState(false);
  const [contactLinkStatus, setContactLinkStatus] = useState<ContactLinkStatus>('loading');
  const [linkedContactId, setLinkedContactId] = useState<string | null>(null);
  const [selfLinkContactId, setSelfLinkContactId] = useState<string>('');
  const [isLinkingSelfContact, setIsLinkingSelfContact] = useState(false);

  const selectedLine = useMemo(
    () => lines.find((line) => line.id === selectedLineId) || null,
    [lines, selectedLineId],
  );

  const resetLifeNoteState = useCallback(() => {
    setLifeNote('');
    setLifeNoteRejectedMessage(null);
    setTrustedContacts([]);
    setIsLoadingLifeNoteContext(false);
    setContactLinkStatus('loading');
    setLinkedContactId(null);
    setSelfLinkContactId('');
    setIsLinkingSelfContact(false);
    setIsScreeningNote(false);
  }, []);

  const resetState = useCallback(() => {
    setSelectedLineId(preselectedLineId ?? null);
    setStep(preselectedLineId ? 2 : 1);
    setIsCalling(false);
    setError(null);
    resetLifeNoteState();
  }, [preselectedLineId, resetLifeNoteState]);

  useEffect(() => {
    if (!isOpen) return;
    resetState();
  }, [isOpen, resetState]);

  useEffect(() => {
    if (isOpen) return;
    resetLifeNoteState();
  }, [isOpen, resetLifeNoteState]);

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
      resetLifeNoteState();
      setSelectedLineId(preselectedLineId);
      setStep(2);
    }
  }, [isOpen, preselectedLineId, resetLifeNoteState]);

  useEffect(() => {
    if (!isOpen || step !== 2 || !selectedLineId) {
      return;
    }

    let isActive = true;
    setIsLoadingLifeNoteContext(true);
    setLifeNoteRejectedMessage(null);
    setTrustedContacts([]);
    setLinkedContactId(null);
    setSelfLinkContactId('');
    setContactLinkStatus('loading');

    const fetchLifeNoteContext = async () => {
      try {
        const [trustedContactsResult, linkedContactResult] = await Promise.all([
          getTrustedContacts(selectedLineId),
          getMyLinkedContact(selectedLineId),
        ]);

        if (!isActive) return;

        const enabledContacts = (Array.isArray(trustedContactsResult) ? trustedContactsResult : [])
          .filter((contact) => contact && contact.enabled !== false)
          .map((contact) => ({
            id: String(contact.id),
            name: String(contact.name ?? 'Trusted contact'),
            relationship:
              typeof contact.relationship === 'string' ? contact.relationship : null,
          }));

        setTrustedContacts(enabledContacts);

        if (enabledContacts.length === 0) {
          setContactLinkStatus('no_contacts');
          return;
        }

        const resolvedLinkedContactId = linkedContactResult?.id ?? null;

        const linkedContactStillExists = resolvedLinkedContactId
          ? enabledContacts.some((contact) => contact.id === resolvedLinkedContactId)
          : false;

        if (linkedContactStillExists && resolvedLinkedContactId) {
          setLinkedContactId(resolvedLinkedContactId);
          setSelfLinkContactId(resolvedLinkedContactId);
          setContactLinkStatus('linked');
          return;
        }

        setSelfLinkContactId(enabledContacts[0]?.id ?? '');
        setContactLinkStatus('unlinked');
      } catch {
        if (!isActive) return;
        setTrustedContacts([]);
        setLinkedContactId(null);
        setSelfLinkContactId('');
        setContactLinkStatus('no_contacts');
      } finally {
        if (!isActive) return;
        setIsLoadingLifeNoteContext(false);
      }
    };

    void fetchLifeNoteContext();

    return () => {
      isActive = false;
    };
  }, [isOpen, selectedLineId, step]);

  const handleSelectLine = (lineId: string) => {
    resetLifeNoteState();
    setSelectedLineId(lineId);
    setStep(2);
    setError(null);
  };

  const handleStartCall = async () => {
    if (!selectedLineId) return;
    setError(null);
    setLifeNoteRejectedMessage(null);

    let includeLifeNotePayload:
      | { note: string; authorName: string; authorRelationship: string | null }
      | undefined;
    const trimmedLifeNote = lifeNote.trim();

    if (trimmedLifeNote) {
      if (contactLinkStatus !== 'linked' || !linkedContact) {
        setError('Link yourself to a trusted contact to include a Life Note.');
        return;
      }

      includeLifeNotePayload = {
        note: trimmedLifeNote,
        authorName: linkedContact.name,
        authorRelationship: linkedContact.relationship ?? null,
      };
    }

    setIsScreeningNote(Boolean(includeLifeNotePayload));
    setIsCalling(true);
    try {
      const result = await initiateManualCall(selectedLineId, {
        overrideQuietHours: true,
        ...(includeLifeNotePayload ? { lifeNote: includeLifeNotePayload } : {}),
      });
      if (!result.success) {
        if (result.error.details?.lifeNoteRejected) {
          setLifeNoteRejectedMessage(GENERIC_LIFE_NOTE_REJECTION_MESSAGE);
          return;
        }
        const message = resolveManualCallError(result.error);
        setError(message);
        toast.error(message);
        return;
      }
      if (result.data.lifeNoteStatus === 'dropped_unverified') {
        toast(LIFE_NOTE_UNVERIFIED_TOAST_MESSAGE);
      }
      toast.success('Manual call started.');
      onOpenChange(false);
    } catch {
      const message = 'Failed to initiate manual call.';
      setError(message);
      toast.error(message);
    } finally {
      setIsScreeningNote(false);
      setIsCalling(false);
    }
  };

  const handleLinkSelfContact = async () => {
    if (!selectedLineId || !selfLinkContactId) return;

    setIsLinkingSelfContact(true);
    setLifeNoteRejectedMessage(null);
    setError(null);

    try {
      const result = await linkUserToTrustedContact(selfLinkContactId);
      if (!result?.success) {
        toast.error(result?.error?.message || 'Unable to link your contact right now.');
        return;
      }

      setLinkedContactId(selfLinkContactId);
      setContactLinkStatus('linked');
      toast.success('You are now linked to this Life Note');
    } catch {
      toast.error('Unable to link your contact right now.');
    } finally {
      setIsLinkingSelfContact(false);
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

  const linkedContact = useMemo(
    () => trustedContacts.find((contact) => contact.id === linkedContactId) || null,
    [trustedContacts, linkedContactId],
  );

  const lifeNoteCharactersRemaining = LIFE_NOTE_MAX_LENGTH - lifeNote.length;
  const isBusy = isCalling || isScreeningNote;

  return (
    <Modal
      heading="Place a call"
      description="Start a one-time call now."
      isOpen={isOpen}
      setIsOpen={onOpenChange}
    >
      <div className="space-y-4 text-sm">
        {step === 1 && (
          <>
            <p className="text-muted-foreground">
              Select a line to call. Quiet hours are bypassed, but DNC settings are still respected.
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
              Ultaura will place this call immediately. Quiet hours are bypassed.
            </p>

            <Accordion className="space-y-0">
              <AccordionItem value="life-note">
                <AccordionTrigger className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <div className="text-sm font-medium text-foreground">Life Note</div>
                        <InfoTip content="Life Notes are screened before the call starts." />
                      </div>
                      <div className="text-xs font-normal text-muted-foreground">
                        Add a short note for this call
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-0 text-sm">
                  <div className="space-y-3">
                    {isLoadingLifeNoteContext ? (
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        Loading contact options…
                      </div>
                    ) : contactLinkStatus === 'no_contacts' ? (
                      <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">
                          Add a trusted contact first, then link yourself to use a Life Note.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="small"
                          className="w-full"
                          href={`/dashboard/lines/${selectedLine.id}/contacts`}
                        >
                          Add trusted contact
                        </Button>
                      </div>
                    ) : contactLinkStatus === 'unlinked' ? (
                      <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">
                          Who is this Life Note coming from?
                        </p>
                        <TextField className="space-y-2">
                          <TextField.Label>Choose your contact</TextField.Label>
                          <Select value={selfLinkContactId} onValueChange={setSelfLinkContactId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a trusted contact" />
                            </SelectTrigger>
                            <SelectContent>
                              {trustedContacts.map((contact) => (
                                <SelectItem key={contact.id} value={contact.id}>
                                  {contact.name}
                                  {contact.relationship ? ` (${contact.relationship})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TextField>
                        <Button
                          type="button"
                          variant="outline"
                          size="small"
                          className="w-full"
                          onClick={handleLinkSelfContact}
                          disabled={!selfLinkContactId || isLinkingSelfContact || isBusy}
                        >
                          {isLinkingSelfContact ? 'Linking...' : 'Link myself'}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
                        <div className="text-xs text-muted-foreground">
                          Linked to{' '}
                          <span className="font-medium text-foreground">
                            {linkedContact?.name || 'trusted contact'}
                          </span>
                          .
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="small"
                          className="w-full"
                          onClick={() => {
                            setLinkedContactId(null);
                            setSelfLinkContactId(linkedContact?.id || trustedContacts[0]?.id || '');
                            setContactLinkStatus('unlinked');
                          }}
                          disabled={isBusy || isLinkingSelfContact}
                        >
                          Change linked contact
                        </Button>
                      </div>
                    )}

                    <TextField className="space-y-2">
                      <TextField.Label>Note, message, or topic</TextField.Label>
                      <Textarea
                        value={lifeNote}
                        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                          setLifeNote(event.target.value.slice(0, LIFE_NOTE_MAX_LENGTH));
                          if (lifeNoteRejectedMessage) {
                            setLifeNoteRejectedMessage(null);
                          }
                        }}
                        rows={4}
                        maxLength={LIFE_NOTE_MAX_LENGTH}
                        disabled={isBusy || isLoadingLifeNoteContext || contactLinkStatus !== 'linked'}
                        placeholder={
                          contactLinkStatus === 'linked'
                            ? 'Example: Please mention the grandkids are visiting this weekend.'
                            : ''
                        }
                      />
                      <div className="flex items-center justify-between px-1 text-xs">
                        <span className="text-muted-foreground">
                          {contactLinkStatus === 'linked'
                            ? 'Keep it brief and specific.'
                            : 'Life Notes are available after you link yourself.'}
                        </span>
                        <span
                          className={
                            lifeNoteCharactersRemaining <= 20
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          }
                        >
                          {lifeNote.length}/{LIFE_NOTE_MAX_LENGTH}
                        </span>
                      </div>
                    </TextField>

                    {lifeNoteRejectedMessage && (
                      <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                        <span>{lifeNoteRejectedMessage}</span>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            size="small"
            className="w-full"
            onClick={() => {
              resetState();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          {step === 2 && (
            <Button
              type="button"
              variant="outline"
              size="small"
              className="w-full"
              onClick={() => {
                resetLifeNoteState();
                setStep(1);
              }}
            >
              Change line
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            size="small"
            className="w-full"
            onClick={handleStartCall}
            disabled={!selectedLineId || isBusy || isLoading || isLinkingSelfContact}
          >
            {isScreeningNote ? 'Screening note...' : isCalling ? 'Calling...' : 'Start call'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
