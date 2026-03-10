'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { toast } from 'sonner';

import { TELEPHONY } from '~/lib/ultaura/constants';
import { inviteNotificationRecipient, removeNotificationRecipient } from '~/lib/ultaura/notification-recipients';
import { formatToE164, getUsPhoneValidationError } from '~/lib/ultaura/phone';
import type { NotificationRecipient } from '~/lib/ultaura/types';

const REMOVE_RECIPIENT_ERROR = 'Failed to remove recipient';

type InvitePayload = {
  name: string;
  email: string;
  phoneE164?: string;
  relationship?: string;
};

type InvitePayloadOverride = Partial<InvitePayload>;

export interface UseInviteFlowOptions {
  accountId: string;
  initialRecipients: NotificationRecipient[];
}

export interface UseInviteFlowResult {
  recipients: NotificationRecipient[];
  setRecipients: Dispatch<SetStateAction<NotificationRecipient[]>>;
  activeRecipientCount: number;
  confirmedRecipients: number;
  inviteName: string;
  setInviteName: (value: string) => void;
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  invitePhone: string;
  setInvitePhone: (value: string) => void;
  inviteRelationship: string;
  setInviteRelationship: (value: string) => void;
  invitePhoneError?: string;
  setInvitePhoneError: (value?: string) => void;
  inviteError: string | null;
  setInviteError: (value: string | null) => void;
  isInviting: boolean;
  showInviteModal: boolean;
  setShowInviteModal: (open: boolean) => void;
  showDiscardConfirm: boolean;
  setShowDiscardConfirm: (open: boolean) => void;
  reinviteDialogOpen: boolean;
  setReinviteDialogOpen: (open: boolean) => void;
  pendingInvite: InvitePayload | null;
  firstInputRef: RefObject<HTMLInputElement>;
  hasInviteChanges: boolean;
  resetInviteForm: () => void;
  closeInviteModal: () => void;
  attemptCloseInvite: () => void;
  submitInvite: () => Promise<void>;
  confirmReinvite: () => Promise<void>;
  removeRecipient: (recipientId: string) => Promise<void>;
  validatePhoneOnBlur: (value: string) => void;
}

export function useInviteFlow({
  accountId,
  initialRecipients,
}: UseInviteFlowOptions): UseInviteFlowResult {
  const [recipients, setRecipients] = useState<NotificationRecipient[]>(
    initialRecipients,
  );

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRelationship, setInviteRelationship] = useState('');
  const [invitePhoneError, setInvitePhoneError] = useState<string | undefined>();
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const [reinviteDialogOpen, setReinviteDialogOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<InvitePayload | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  const confirmedRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.confirmedAt).length,
    [recipients],
  );

  const activeRecipientCount = useMemo(
    () => recipients.filter((recipient) => !recipient.unsubscribedAt).length,
    [recipients],
  );

  const hasInviteChanges =
    inviteName.trim() !== '' ||
    inviteEmail.trim() !== '' ||
    invitePhone.trim() !== '' ||
    inviteRelationship.trim() !== '';

  const resetInviteForm = useCallback(() => {
    setInviteName('');
    setInviteEmail('');
    setInvitePhone('');
    setInviteRelationship('');
    setInvitePhoneError(undefined);
    setInviteError(null);
  }, []);

  const closeInviteModal = useCallback(() => {
    resetInviteForm();
    setShowInviteModal(false);
    setShowDiscardConfirm(false);
  }, [resetInviteForm]);

  const attemptCloseInvite = useCallback(() => {
    if (isInviting) return;

    if (hasInviteChanges) {
      setShowDiscardConfirm(true);
    } else {
      closeInviteModal();
    }
  }, [closeInviteModal, hasInviteChanges, isInviting]);

  const buildInvitePayload = useCallback(
    (override?: InvitePayloadOverride): InvitePayload => {
      const trimmedName = (override?.name ?? inviteName).trim();
      const trimmedEmail = (override?.email ?? inviteEmail).trim().toLowerCase();
      const trimmedPhone = invitePhone.trim();
      const trimmedRelationship =
        (override?.relationship ?? inviteRelationship).trim();
      const phoneE164 =
        override?.phoneE164 ??
        (trimmedPhone ? formatToE164(trimmedPhone) : undefined);

      return {
        name: trimmedName,
        email: trimmedEmail,
        phoneE164,
        relationship: trimmedRelationship || undefined,
      };
    },
    [inviteEmail, inviteName, invitePhone, inviteRelationship],
  );

  const handleInvite = useCallback(
    async (
      allowReinvite = false,
      override?: InvitePayloadOverride,
    ) => {
      setInviteError(null);
      setInvitePhoneError(undefined);

      const payload = buildInvitePayload(override);

      if (!payload.name || !payload.email) {
        setInviteError('Name and email are required');
        return;
      }

      const phoneValidationError = getUsPhoneValidationError(invitePhone, {
        required: false,
      });
      if (phoneValidationError) {
        setInvitePhoneError(phoneValidationError);
        return;
      }

      if (payload.phoneE164 && !TELEPHONY.PHONE_REGEX.test(payload.phoneE164)) {
        setInviteError('Enter a valid US phone number');
        return;
      }

      setIsInviting(true);
      try {
        const result = await inviteNotificationRecipient(accountId, {
          ...payload,
          allowReinvite,
        });

        if (!result.success) {
          const reason = result.error.details?.reason;
          if (reason === 'unsubscribed') {
            setPendingInvite(payload);
            setReinviteDialogOpen(true);
            return;
          }

          setInviteError(result.error.message || 'Failed to send invite');
          return;
        }

        setRecipients((prev) => {
          const nextRecipients = prev.filter((item) => item.id !== result.data.id);
          return [result.data, ...nextRecipients];
        });

        closeInviteModal();
        toast.success('Invite sent');
      } catch {
        setInviteError('Failed to send invite');
      } finally {
        setIsInviting(false);
      }
    },
    [accountId, buildInvitePayload, closeInviteModal, invitePhone],
  );

  const submitInvite = useCallback(async () => {
    await handleInvite(false);
  }, [handleInvite]);

  const confirmReinvite = useCallback(async () => {
    if (!pendingInvite) return;

    setReinviteDialogOpen(false);
    await handleInvite(true, pendingInvite);
    setPendingInvite(null);
  }, [handleInvite, pendingInvite]);

  const removeRecipient = useCallback(async (recipientId: string) => {
    let didShowErrorToast = false;
    try {
      const result = await removeNotificationRecipient(recipientId);
      if (!result.success) {
        const errorMessage = result.error.message || REMOVE_RECIPIENT_ERROR;
        toast.error(errorMessage);
        didShowErrorToast = true;
        throw new Error(errorMessage);
      }

      setRecipients((prev) =>
        prev.filter((recipient) => recipient.id !== recipientId),
      );
      toast.success('Recipient removed');
    } catch (error) {
      if (!didShowErrorToast) {
        toast.error(REMOVE_RECIPIENT_ERROR);
      }
      if (error instanceof Error && error.message) {
        throw error;
      }
      throw new Error(REMOVE_RECIPIENT_ERROR);
    }
  }, []);

  const validatePhoneOnBlur = useCallback(
    (value: string) => {
      setInvitePhoneError(
        getUsPhoneValidationError(value, {
          required: false,
        }) ?? undefined,
      );
    },
    [],
  );

  const handleSetInvitePhone = useCallback((value: string) => {
    setInvitePhone(value);
    setInvitePhoneError(undefined);
  }, []);

  useEffect(() => {
    setRecipients(initialRecipients);
  }, [initialRecipients]);

  return {
    recipients,
    setRecipients,
    activeRecipientCount,
    confirmedRecipients,
    inviteName,
    setInviteName,
    inviteEmail,
    setInviteEmail,
    invitePhone,
    setInvitePhone: handleSetInvitePhone,
    inviteRelationship,
    setInviteRelationship,
    invitePhoneError,
    setInvitePhoneError,
    inviteError,
    setInviteError,
    isInviting,
    showInviteModal,
    setShowInviteModal,
    showDiscardConfirm,
    setShowDiscardConfirm,
    reinviteDialogOpen,
    setReinviteDialogOpen,
    pendingInvite,
    firstInputRef,
    hasInviteChanges,
    resetInviteForm,
    closeInviteModal,
    attemptCloseInvite,
    submitInvite,
    confirmReinvite,
    removeRecipient,
    validatePhoneOnBlur,
  };
}
