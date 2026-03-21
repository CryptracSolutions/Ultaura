'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { toast } from 'sonner';

import { TELEPHONY } from '~/lib/ultaura/constants';
import {
  inviteNotificationRecipient,
  removeNotificationRecipient,
  resendRecipientSmsVerificationLink,
  updateNotificationRecipientDelivery,
  updateRecipientLineAssignments,
} from '~/lib/ultaura/notification-recipients';
import { formatToE164, getUsPhoneValidationError } from '~/lib/ultaura/phone';
import type { LineRow, NotificationRecipient } from '~/lib/ultaura/types';
import {
  getRecipientDeliveryChannel as getRecipientPersistedDeliveryChannel,
  getRecipientSmsConsentTimestamp,
  recipientRequiresSms,
  type RecipientDeliveryChannel,
} from '../lib/recipient-delivery';

const REMOVE_RECIPIENT_ERROR = 'Failed to remove recipient';

type InvitePayload = {
  name: string;
  email: string;
  phoneE164?: string;
  relationship?: string;
  deliveryChannel: RecipientDeliveryChannel;
  smsConsentAcknowledged: boolean;
  smsConsentedAt?: string;
  lineIds: string[];
};

type InvitePayloadOverride = Partial<InvitePayload>;

export interface UseInviteFlowOptions {
  accountId: string;
  initialRecipients: NotificationRecipient[];
  lines: LineRow[];
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
  inviteDeliveryChannel: RecipientDeliveryChannel;
  setInviteDeliveryChannel: (value: RecipientDeliveryChannel) => void;
  inviteSmsConsentAcknowledged: boolean;
  setInviteSmsConsentAcknowledged: (value: boolean) => void;
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
  getRecipientDeliveryChannel: (recipientId: string) => RecipientDeliveryChannel;
  getRecipientSmsConsentAcknowledged: (recipientId: string) => boolean;
  getRecipientSmsConsentTimestamp: (recipientId: string) => string | null;
  resendRecipientSmsInvite: (
    recipientId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  updateRecipientDeliveryChannel: (
    recipientId: string,
    deliveryChannel: RecipientDeliveryChannel,
    smsConsentAcknowledgedAt?: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  inviteLineIds: string[];
  setInviteLineIds: (ids: string[]) => void;
  updateRecipientLineAssignments: (recipientId: string, lineIds: string[]) => Promise<{ success: boolean; error?: string }>;
}

export function useInviteFlow({
  accountId,
  initialRecipients,
  lines,
}: UseInviteFlowOptions): UseInviteFlowResult {
  const [recipients, setRecipients] = useState<NotificationRecipient[]>(
    initialRecipients,
  );

  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteDeliveryChannel, setInviteDeliveryChannel] =
    useState<RecipientDeliveryChannel>('email');
  const [inviteSmsConsentAcknowledged, setInviteSmsConsentAcknowledged] =
    useState(false);
  const [inviteRelationship, setInviteRelationship] = useState('');
  const [invitePhoneError, setInvitePhoneError] = useState<string | undefined>();
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const [reinviteDialogOpen, setReinviteDialogOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<InvitePayload | null>(null);

  const [inviteLineIds, setInviteLineIds] = useState<string[]>(() =>
    lines.length === 1 ? [lines[0].id] : []
  );

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
    inviteRelationship.trim() !== '' ||
    inviteDeliveryChannel !== 'email' ||
    inviteSmsConsentAcknowledged ||
    (lines.length > 1 && inviteLineIds.length > 0);

  const resetInviteForm = useCallback(() => {
    setInviteName('');
    setInviteEmail('');
    setInvitePhone('');
    setInviteDeliveryChannel('email');
    setInviteSmsConsentAcknowledged(false);
    setInviteRelationship('');
    setInvitePhoneError(undefined);
    setInviteError(null);
    setInviteLineIds(lines.length === 1 ? [lines[0].id] : []);
  }, [lines]);

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
        deliveryChannel: override?.deliveryChannel ?? inviteDeliveryChannel,
        smsConsentAcknowledged:
          override?.smsConsentAcknowledged ?? inviteSmsConsentAcknowledged,
        smsConsentedAt:
          override?.smsConsentAcknowledged ?? inviteSmsConsentAcknowledged
            ? new Date().toISOString()
            : undefined,
        lineIds: override?.lineIds ?? inviteLineIds,
      };
    },
    [
      inviteDeliveryChannel,
      inviteEmail,
      inviteLineIds,
      inviteName,
      invitePhone,
      inviteRelationship,
      inviteSmsConsentAcknowledged,
    ],
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

      const requiresSmsChannel = recipientRequiresSms(payload.deliveryChannel);
      const phoneValidationError = getUsPhoneValidationError(invitePhone, {
        required: requiresSmsChannel,
      });
      if (phoneValidationError) {
        setInvitePhoneError(phoneValidationError);
        return;
      }

      if (requiresSmsChannel && !payload.smsConsentAcknowledged) {
        setInviteError('Please confirm SMS consent before sending this invite');
        return;
      }

      if (inviteLineIds.length === 0) {
        setInviteError('Please select at least one line.');
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
          smsConsentAcknowledgedAt: payload.smsConsentedAt ?? null,
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
    [accountId, buildInvitePayload, closeInviteModal, inviteLineIds, invitePhone],
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
          required: recipientRequiresSms(inviteDeliveryChannel),
        }) ?? undefined,
      );
    },
    [inviteDeliveryChannel],
  );

  const handleSetInvitePhone = useCallback((value: string) => {
    setInvitePhone(value);
    setInvitePhoneError(undefined);
  }, []);

  const handleSetInviteDeliveryChannel = useCallback(
    (value: RecipientDeliveryChannel) => {
      setInviteDeliveryChannel(value);
      setInviteError(null);
      if (value === 'email') {
        setInviteSmsConsentAcknowledged(false);
      }
    },
    [],
  );

  const getRecipientDeliveryChannel = useCallback(
    (recipientId: string): RecipientDeliveryChannel => {
      const recipient = recipients.find((item) => item.id === recipientId);
      return recipient ? getRecipientPersistedDeliveryChannel(recipient) : 'email';
    },
    [recipients],
  );

  const getRecipientSmsConsentAcknowledged = useCallback(
    (recipientId: string): boolean => {
      const recipient = recipients.find((item) => item.id === recipientId);
      if (!recipient) return false;
      return Boolean(getRecipientSmsConsentTimestamp(recipient));
    },
    [recipients],
  );

  const getRecipientSmsConsentTimestampValue = useCallback(
    (recipientId: string): string | null => {
      const recipient = recipients.find((item) => item.id === recipientId);
      if (!recipient) return null;
      return getRecipientSmsConsentTimestamp(recipient);
    },
    [recipients],
  );

  const resendRecipientSmsInvite = useCallback(
    async (recipientId: string) => {
      const recipient = recipients.find((item) => item.id === recipientId);
      const result = await resendRecipientSmsVerificationLink(recipientId);
      if (!result.success) {
        const error = result.error.message || 'Failed to resend verification link';
        toast.error(error);
        return { success: false, error };
      }

      toast.success(
        recipient
          ? `Verification link resent to ${recipient.name}.`
          : 'Verification link resent.',
      );
      return { success: true };
    },
    [recipients],
  );

  const updateRecipientDeliveryChannel = useCallback(
    async (
      recipientId: string,
      deliveryChannel: RecipientDeliveryChannel,
      smsConsentAcknowledgedAt?: string | null,
    ) => {
      const recipient = recipients.find((item) => item.id === recipientId);
      const result = await updateNotificationRecipientDelivery(recipientId, {
        deliveryChannel,
        smsConsentAcknowledgedAt:
          deliveryChannel === 'email'
            ? null
            : smsConsentAcknowledgedAt ?? recipient?.smsConsentAcknowledgedAt ?? null,
      });

      if (!result.success) {
        const error = result.error.message || 'Failed to update recipient delivery';
        toast.error(error);
        return { success: false, error };
      }

      setRecipients((prev) =>
        prev.map((item) => (item.id === recipientId ? result.data : item)),
      );
      toast.success('Recipient delivery updated');
      return { success: true };
    },
    [recipients],
  );

  const handleUpdateLineAssignments = useCallback(
    async (recipientId: string, lineIds: string[]) => {
      const result = await updateRecipientLineAssignments(recipientId, lineIds);
      if (result.success) {
        setRecipients((prev) =>
          prev.map((r) => r.id === recipientId ? { ...r, assignedLineIds: result.data.assignedLineIds } : r)
        );
        toast.success('Line assignments updated');
        return { success: true as const };
      }
      const errorMsg = result.error?.message || 'Failed to update line assignments';
      toast.error(errorMsg);
      return { success: false as const, error: errorMsg };
    },
    []
  );

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
    inviteDeliveryChannel,
    setInviteDeliveryChannel: handleSetInviteDeliveryChannel,
    inviteSmsConsentAcknowledged,
    setInviteSmsConsentAcknowledged,
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
    getRecipientDeliveryChannel,
    getRecipientSmsConsentAcknowledged,
    getRecipientSmsConsentTimestamp: getRecipientSmsConsentTimestampValue,
    resendRecipientSmsInvite,
    updateRecipientDeliveryChannel,
    inviteLineIds,
    setInviteLineIds,
    updateRecipientLineAssignments: handleUpdateLineAssignments,
  };
}
