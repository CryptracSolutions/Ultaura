import type { NotificationRecipient } from '~/lib/ultaura/types';

export type RecipientDeliveryChannel = 'email' | 'sms' | 'both';

type RecipientWithSmsConsentFields = NotificationRecipient & {
  smsConsentAcknowledgedAt?: string | null;
};

export function normalizeDeliveryChannel(
  value: unknown,
): RecipientDeliveryChannel {
  if (value === 'sms' || value === 'both') {
    return value;
  }
  return 'email';
}

export function recipientRequiresSms(
  deliveryChannel: RecipientDeliveryChannel,
): boolean {
  return deliveryChannel === 'sms' || deliveryChannel === 'both';
}

export function getRecipientDeliveryChannel(
  recipient: NotificationRecipient,
): RecipientDeliveryChannel {
  return normalizeDeliveryChannel(
    (recipient as NotificationRecipient & { deliveryChannel?: unknown })
      .deliveryChannel,
  );
}

export function getRecipientSmsConsentTimestamp(
  recipient: NotificationRecipient,
): string | null {
  const recipientWithConsentFields = recipient as RecipientWithSmsConsentFields;
  return recipientWithConsentFields.smsConsentAcknowledgedAt ?? null;
}

export function getRecipientDeliveryLabel(
  deliveryChannel: RecipientDeliveryChannel,
): string {
  switch (deliveryChannel) {
    case 'sms':
      return 'SMS';
    case 'both':
      return 'Email + SMS';
    default:
      return 'Email';
  }
}

export function getRecipientSmsState(
  recipient: NotificationRecipient,
): {
  label: string;
  className: string;
  canResendSmsInvite: boolean;
} {
  const deliveryChannel = getRecipientDeliveryChannel(recipient);
  const isSmsEnabled = recipientRequiresSms(deliveryChannel);

  if (!isSmsEnabled) {
    return {
      label: 'Email only',
      className: 'text-muted-foreground',
      canResendSmsInvite: false,
    };
  }

  if (recipient.unsubscribedAt) {
    return {
      label: 'Unsubscribed',
      className: 'text-muted-foreground',
      canResendSmsInvite: false,
    };
  }

  if (recipient.smsOptedOut) {
    return {
      label: 'SMS opted out',
      className: 'text-destructive',
      canResendSmsInvite: false,
    };
  }

  if (!recipient.phoneE164) {
    return {
      label: 'Phone needed',
      className: 'text-destructive',
      canResendSmsInvite: false,
    };
  }

  if (recipient.smsVerifiedAt) {
    return {
      label: deliveryChannel === 'both' ? 'Both active' : 'SMS active',
      className: 'text-success',
      canResendSmsInvite: false,
    };
  }

  return {
    label: recipient.confirmedAt ? 'SMS pending verification' : 'Confirm email first',
    className: 'text-warning',
    canResendSmsInvite: Boolean(recipient.confirmedAt),
  };
}
