'use client';

import { useMemo, useState } from 'react';
import { Mail, Trash2, Pencil, Monitor, Users, Bell } from 'lucide-react';

import Button from '~/core/ui/Button';
import { Checkbox } from '~/core/ui/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '~/core/ui/Dialog';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import type { LineRow, NotificationRecipient } from '~/lib/ultaura/types';
import { formatUsPhoneForDisplay } from '~/lib/ultaura/phone';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';
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
  lines: LineRow[];
  onUpdateLineAssignments: (recipientId: string, lineIds: string[]) => Promise<{ success: boolean; error?: string }>;
}

function getStatusBadge(recipient: NotificationRecipient): {
  label: string;
  className: string;
} {
  if (recipient.unsubscribedAt) {
    return {
      label: 'Unsubscribed',
      className: 'bg-muted text-muted-foreground',
    };
  }
  if (recipient.confirmedAt) {
    return {
      label: 'Confirmed',
      className: 'bg-success/10 text-success',
    };
  }
  return {
    label: 'Pending',
    className: 'bg-warning/10 text-warning',
  };
}

function EditLinesDialog({
  recipient,
  lines,
  isOpen,
  onClose,
  onSave,
}: {
  recipient: NotificationRecipient;
  lines: LineRow[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipientId: string, lineIds: string[]) => Promise<{ success: boolean; error?: string }>;
}) {
  const [pendingIds, setPendingIds] = useState<string[]>(recipient.assignedLineIds);
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges =
    pendingIds.length !== recipient.assignedLineIds.length ||
    pendingIds.some((id) => !recipient.assignedLineIds.includes(id));

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
        else setPendingIds(recipient.assignedLineIds);
      }}
    >
      <DialogContent
        className="sm:max-w-[400px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <DialogTitle>Edit Lines</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Choose which lines {recipient.name} receives updates for.
            </DialogDescription>
          </div>

          <div className="space-y-2">
            {lines.map((line) => (
              <label key={line.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={pendingIds.includes(line.id)}
                  disabled={isSaving}
                  onCheckedChange={(checked) => {
                    setPendingIds((prev) => {
                      if (checked) return [...prev, line.id];
                      const next = prev.filter((id) => id !== line.id);
                      return next.length > 0 ? next : prev;
                    });
                  }}
                />
                <span>{line.display_name || 'Unnamed line'}</span>
              </label>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
            <Button variant="outline" className="w-full" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="w-full"
              disabled={!hasChanges || isSaving || pendingIds.length === 0}
              loading={isSaving}
              onClick={async () => {
                setIsSaving(true);
                const result = await onSave(recipient.id, pendingIds);
                setIsSaving(false);
                if (result.success) onClose();
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
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
  lines,
  onUpdateLineAssignments,
}: InvitedFamilyListProps) {
  const [pendingRemove, setPendingRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pendingLineEdit, setPendingLineEdit] = useState<NotificationRecipient | null>(null);
  const [pendingSmsConsent, setPendingSmsConsent] = useState<{
    id: string;
    name: string;
    deliveryChannel: RecipientDeliveryChannel;
  } | null>(null);
  const [smsConsentChecked, setSmsConsentChecked] = useState(false);
  const sorted = useMemo(
    () =>
      [...recipients].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
    [recipients],
  );

  const closeSmsConsentDialog = () => {
    setPendingSmsConsent(null);
    setSmsConsentChecked(false);
  };

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 px-4 text-center">
        <Users className="w-10 h-10 text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          No invited family members yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {sorted.map((recipient) => {
          const status = getStatusBadge(recipient);
          const deliveryChannel = getRecipientDeliveryChannel(recipient.id);
          const smsState = getRecipientSmsState({
            ...recipient,
            deliveryChannel,
          });
          const assignedLines = lines.filter((l) =>
            recipient.assignedLineIds.includes(l.id),
          );
          const hasDashboard = Boolean(recipient.dashboardAccessGrantedAt);

          return (
            <div
              key={recipient.id}
              className="bg-card rounded-xl border border-border shadow-sm p-4"
            >
              {/* Header: Name + Status + Actions */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground min-w-0 break-words">
                  {recipient.name}
                </h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
                  <ResponsiveActionMenu
                    title={recipient.name}
                    actions={[
                      {
                        label: 'Edit Lines',
                        icon: <Pencil className="w-5 h-5" />,
                        onClick: () => setPendingLineEdit(recipient),
                      },
                      {
                        label: `Delivery: ${getRecipientDeliveryLabel(deliveryChannel)}`,
                        icon: <Bell className="w-5 h-5" />,
                        disabled: disabled || recipient.unsubscribedAt !== null,
                        subItems: [
                          {
                            label: 'Email',
                            checked: deliveryChannel === 'email',
                            onClick: () => {
                              if (deliveryChannel === 'email') return;
                              void onUpdateRecipientDeliveryChannel(recipient.id, 'email');
                            },
                          },
                          ...(recipient.phoneE164
                            ? [
                                {
                                  label: 'SMS',
                                  checked: deliveryChannel === 'sms',
                                  onClick: () => {
                                    if (deliveryChannel === 'sms') return;
                                    if (!recipient.smsConsentAcknowledgedAt) {
                                      setPendingSmsConsent({
                                        id: recipient.id,
                                        name: recipient.name,
                                        deliveryChannel: 'sms' as RecipientDeliveryChannel,
                                      });
                                      setSmsConsentChecked(false);
                                      return;
                                    }
                                    void onUpdateRecipientDeliveryChannel(recipient.id, 'sms');
                                  },
                                },
                                {
                                  label: 'Both',
                                  checked: deliveryChannel === 'both',
                                  onClick: () => {
                                    if (deliveryChannel === 'both') return;
                                    if (!recipient.smsConsentAcknowledgedAt) {
                                      setPendingSmsConsent({
                                        id: recipient.id,
                                        name: recipient.name,
                                        deliveryChannel: 'both' as RecipientDeliveryChannel,
                                      });
                                      setSmsConsentChecked(false);
                                      return;
                                    }
                                    void onUpdateRecipientDeliveryChannel(recipient.id, 'both');
                                  },
                                },
                              ]
                            : []),
                        ],
                      },
                      {
                        label: hasDashboard
                          ? 'Revoke Dashboard Access'
                          : 'Grant Dashboard Access',
                        icon: <Monitor className="w-5 h-5" />,
                        onClick: () => {
                          if (hasDashboard) {
                            void onRevokeDashboardAccess(recipient.id);
                          } else {
                            onGrantDashboardAccess(recipient);
                          }
                        },
                        disabled:
                          !recipient.confirmedAt ||
                          disabled ||
                          dashboardAccessLoading,
                        separator: true,
                      },
                      ...(smsState.canResendSmsInvite
                        ? [
                            {
                              label: 'Resend verification link',
                              icon: <Mail className="w-5 h-5" />,
                              onClick: () =>
                                void onResendSmsVerificationLink(
                                  recipient.id,
                                ),
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
                        variant: 'destructive' as const,
                        separator: true,
                      },
                    ]}
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Contact info */}
              <p className="text-sm text-muted-foreground mt-0.5">
                {recipient.email}
              </p>
              {recipient.phoneE164 && (
                <p className="text-sm text-muted-foreground">
                  {formatUsPhoneForDisplay(recipient.phoneE164)}
                </p>
              )}

              {/* Status indicators */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Delivery:{' '}
                  <span className="text-primary font-medium">
                    {getRecipientDeliveryLabel(deliveryChannel)}
                  </span>
                </span>
                {smsState.label !== 'Email only' && (
                  <span className={`font-medium ${smsState.className}`}>
                    {smsState.label}
                  </span>
                )}
                <span>
                  Dashboard access:{' '}
                  <span className={!recipient.confirmedAt ? 'text-warning font-medium' : hasDashboard ? 'text-primary font-medium' : ''}>
                    {!recipient.confirmedAt
                      ? 'Confirm email'
                      : hasDashboard
                        ? 'Active'
                        : 'Off'}
                  </span>
                </span>
              </div>

              {/* Lines chips */}
              <div className="mt-3 flex flex-wrap items-center gap-1">
                {assignedLines.length === 0 ? (
                  <span className="text-xs text-muted-foreground italic">
                    No lines assigned
                  </span>
                ) : (
                  assignedLines.map((line) => (
                    <span
                      key={line.id}
                      className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
                    >
                      {line.display_name}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Lines Dialog */}
      {pendingLineEdit && (
        <EditLinesDialog
          recipient={pendingLineEdit}
          lines={lines}
          isOpen
          onClose={() => setPendingLineEdit(null)}
          onSave={onUpdateLineAssignments}
        />
      )}

      {/* Remove Confirmation Dialog */}
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

      {/* SMS Consent Dialog */}
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
    </>
  );
}
