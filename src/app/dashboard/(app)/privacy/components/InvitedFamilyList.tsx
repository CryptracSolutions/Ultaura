'use client';

import { useMemo, useState } from 'react';
import { Mail, Trash2 } from 'lucide-react';

import Button from '~/core/ui/Button';
import { Checkbox } from '~/core/ui/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '~/core/ui/Dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/core/ui/Table';
import TableContainer from '~/core/ui/TableContainer';
import TableEmptyState from '~/core/ui/TableEmptyState';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import type { NotificationRecipient } from '~/lib/ultaura/types';
import { formatUsPhoneForDisplay } from '~/lib/ultaura/phone';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';
import { Switch } from '~/core/ui/Switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import {
  getRecipientDeliveryLabel,
  getRecipientSmsState,
  type RecipientDeliveryChannel,
} from '../lib/recipient-delivery';

interface InvitedFamilyListProps {
  recipients: NotificationRecipient[];
  onRemove: (recipientId: string) => Promise<void>;
  onGrantDashboardAccess: (recipient: NotificationRecipient) => void;
  onRevokeDashboardAccess: (recipientId: string) => Promise<void>;
  getRecipientDeliveryChannel: (recipientId: string) => RecipientDeliveryChannel;
  onResendSmsVerificationLink: (
    recipientId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  onUpdateRecipientDeliveryChannel: (
    recipientId: string,
    deliveryChannel: RecipientDeliveryChannel,
    smsConsentAcknowledgedAt?: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  dashboardAccessLoading?: boolean;
  disabled?: boolean;
}

function getStatus(recipient: NotificationRecipient): {
  label: string;
  className: string;
} {
  if (recipient.unsubscribedAt) {
    return { label: 'Unsubscribed', className: 'text-muted-foreground' };
  }
  if (recipient.confirmedAt) {
    return { label: 'Confirmed', className: 'text-success' };
  }
  return { label: 'Pending', className: 'text-warning' };
}

export function InvitedFamilyList({
  recipients,
  onRemove,
  onGrantDashboardAccess,
  onRevokeDashboardAccess,
  getRecipientDeliveryChannel,
  onResendSmsVerificationLink,
  onUpdateRecipientDeliveryChannel,
  dashboardAccessLoading = false,
  disabled = false,
}: InvitedFamilyListProps) {
  const [pendingRemove, setPendingRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pendingSmsConsent, setPendingSmsConsent] = useState<{
    id: string;
    name: string;
    deliveryChannel: RecipientDeliveryChannel;
  } | null>(null);
  const [smsConsentChecked, setSmsConsentChecked] = useState(false);
  const sorted = useMemo(
    () =>
      [...recipients].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [recipients],
  );

  const closeSmsConsentDialog = () => {
    setPendingSmsConsent(null);
    setSmsConsentChecked(false);
  };

  if (sorted.length === 0) {
    return (
      <TableContainer>
        <TableEmptyState message="No invited family members yet." />
      </TableContainer>
    );
  }

  return (
    <TableContainer>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Alert Delivery</TableHead>
            <TableHead>SMS Status</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Dashboard Access</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((recipient) => {
            const status = getStatus(recipient);
            const deliveryChannel = getRecipientDeliveryChannel(recipient.id);
            const smsState = getRecipientSmsState({
              ...recipient,
              deliveryChannel,
            });
            return (
              <TableRow key={recipient.id}>
                <TableCell>{recipient.name}</TableCell>
                <TableCell>{recipient.email}</TableCell>
                <TableCell>
                  {recipient.phoneE164 ? (
                    <span className="text-sm">
                      {formatUsPhoneForDisplay(recipient.phoneE164)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="min-w-[150px]">
                  <Select
                    value={deliveryChannel}
                    onValueChange={(value) => {
                      const nextChannel = value as RecipientDeliveryChannel;
                      if (nextChannel === deliveryChannel) {
                        return;
                      }

                      if (
                        nextChannel !== 'email' &&
                        !recipient.smsConsentAcknowledgedAt
                      ) {
                        setPendingSmsConsent({
                          id: recipient.id,
                          name: recipient.name,
                          deliveryChannel: nextChannel,
                        });
                        setSmsConsentChecked(false);
                        return;
                      }

                      void onUpdateRecipientDeliveryChannel(
                        recipient.id,
                        nextChannel,
                      );
                    }}
                    disabled={disabled || recipient.unsubscribedAt !== null}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {getRecipientDeliveryLabel(deliveryChannel)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms" disabled={!recipient.phoneE164}>
                        SMS
                      </SelectItem>
                      <SelectItem value="both" disabled={!recipient.phoneE164}>
                        Both
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium ${smsState.className}`}>
                    {smsState.label}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium ${status.className}`}>
                    {status.label}
                  </span>
                </TableCell>
                <TableCell>
                  {!recipient.confirmedAt ? (
                    <span className="text-xs text-muted-foreground">Confirm email first</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={Boolean(recipient.dashboardAccessGrantedAt)}
                        disabled={disabled || dashboardAccessLoading}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onGrantDashboardAccess(recipient);
                            return;
                          }

                          void onRevokeDashboardAccess(recipient.id);
                        }}
                        aria-label={`Dashboard access for ${recipient.name}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        {recipient.dashboardAccessGrantedAt ? 'Active' : 'Off'}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <ResponsiveActionMenu
                    actions={[
                      ...(smsState.canResendSmsInvite
                        ? [
                            {
                              label: 'Resend verification link',
                              icon: <Mail className="w-5 h-5" />,
                              onClick: () =>
                                void onResendSmsVerificationLink(recipient.id),
                            },
                          ]
                        : []),
                      {
                        label: 'Remove',
                        icon: <Trash2 className="w-5 h-5" />,
                        onClick: () =>
                          setPendingRemove({
                            id: recipient.id,
                            name: recipient.name,
                          }),
                        variant: 'destructive',
                      },
                    ]}
                    disabled={disabled}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <ConfirmationDialog
        open={pendingRemove !== null}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title="Remove recipient?"
        description={
          pendingRemove
            ? `Remove ${pendingRemove.name} from family notifications?`
            : 'Remove this recipient from family notifications?'
        }
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={async () => {
          if (!pendingRemove) return;
          await onRemove(pendingRemove.id);
          setPendingRemove(null);
        }}
      />
      <Dialog
        open={pendingSmsConsent !== null}
        onOpenChange={(open) => !open && closeSmsConsentDialog()}
      >
        <DialogContent
          className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <DialogTitle>Enable SMS alerts?</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {pendingSmsConsent
                  ? `${pendingSmsConsent.name} will receive text alerts from Ultaura at their saved phone number.`
                  : 'This recipient will receive text alerts from Ultaura at their saved phone number.'}
              </DialogDescription>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
              <Checkbox
                checked={smsConsentChecked}
                onCheckedChange={(checked) =>
                  setSmsConsentChecked(Boolean(checked))
                }
              />
              <span>
                I agree to receive Ultaura alert texts at this phone number.
                SMS alerts can be stopped with STOP and restarted with START.
              </span>
            </label>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
              <Button
                variant="outline"
                className="w-full"
                onClick={closeSmsConsentDialog}
              >
                Cancel
              </Button>
              <Button
                className="w-full"
                disabled={!smsConsentChecked || !pendingSmsConsent}
                onClick={async () => {
                  if (!pendingSmsConsent || !smsConsentChecked) {
                    return;
                  }

                  const result = await onUpdateRecipientDeliveryChannel(
                    pendingSmsConsent.id,
                    pendingSmsConsent.deliveryChannel,
                    new Date().toISOString(),
                  );

                  if (result.success) {
                    closeSmsConsentDialog();
                  }
                }}
              >
                Save delivery
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TableContainer>
  );
}
