'use client';

import type { FormEvent, RefObject } from 'react';
import Link from 'next/link';
import { Plus, Users, X } from 'lucide-react';

import Button from '~/core/ui/Button';
import { Checkbox } from '~/core/ui/Checkbox';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  gateDialogAutoFocus,
} from '~/core/ui/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import TextField from '~/core/ui/TextField';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/core/ui/Tooltip';
import { CollapsibleInfoTip } from '~/core/ui/CollapsibleInfoTip';
import type { NotificationRecipient } from '~/lib/ultaura/types';
import { getUsPhoneValidationError } from '~/lib/ultaura/phone';
import PhoneInput from '~/components/ultaura/PhoneInput';
import { InvitedFamilyList } from '../InvitedFamilyList';
import type { RecipientDeliveryChannel } from '../../lib/recipient-delivery';

const MAX_RECIPIENTS = 5;

export interface FamilyRecipientsSectionProps {
  activeRecipientCount: number;
  recipients: NotificationRecipient[];
  isInviting: boolean;
  onRemoveRecipient: (recipientId: string) => Promise<void>;
  onGrantDashboardAccess: (recipient: NotificationRecipient) => void;
  onRevokeDashboardAccess: (recipientId: string) => Promise<void>;
  isDashboardSharingLoading: boolean;
  isGrantConfirmOpen: boolean;
  pendingGrantRecipient: NotificationRecipient | null;
  onCancelGrant: () => void;
  onConfirmGrant: () => Promise<void>;
  showInviteModal: boolean;
  setShowInviteModal: (open: boolean) => void;
  inviteError: string | null;
  setInviteError: (value: string | null) => void;
  attemptCloseInvite: () => void;
  hasInviteChanges: boolean;
  firstInputRef: RefObject<HTMLInputElement>;
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
  invitePhoneError?: string;
  setInvitePhoneError: (value?: string) => void;
  inviteRelationship: string;
  setInviteRelationship: (value: string) => void;
  getRecipientDeliveryChannel: (recipientId: string) => RecipientDeliveryChannel;
  resendRecipientSmsInvite: (recipientId: string) => Promise<{ success: boolean; error?: string }>;
  updateRecipientDeliveryChannel: (
    recipientId: string,
    deliveryChannel: RecipientDeliveryChannel,
    smsConsentAcknowledgedAt?: string | null,
  ) => Promise<{ success: boolean; error?: string }>;
  onInviteSubmit: (event: FormEvent<HTMLFormElement>) => void;
  showDiscardConfirm: boolean;
  setShowDiscardConfirm: (open: boolean) => void;
  closeInviteModal: () => void;
}

export function FamilyRecipientsSection({
  activeRecipientCount,
  recipients,
  isInviting,
  onRemoveRecipient,
  onGrantDashboardAccess,
  onRevokeDashboardAccess,
  isDashboardSharingLoading,
  isGrantConfirmOpen,
  pendingGrantRecipient,
  onCancelGrant,
  onConfirmGrant,
  showInviteModal,
  setShowInviteModal,
  inviteError,
  setInviteError,
  attemptCloseInvite,
  hasInviteChanges,
  firstInputRef,
  inviteName,
  setInviteName,
  inviteEmail,
  setInviteEmail,
  invitePhone,
  setInvitePhone,
  inviteDeliveryChannel,
  setInviteDeliveryChannel,
  inviteSmsConsentAcknowledged,
  setInviteSmsConsentAcknowledged,
  invitePhoneError,
  setInvitePhoneError,
  inviteRelationship,
  setInviteRelationship,
  getRecipientDeliveryChannel,
  resendRecipientSmsInvite,
  updateRecipientDeliveryChannel,
  onInviteSubmit,
  showDiscardConfirm,
  setShowDiscardConfirm,
  closeInviteModal,
}: FamilyRecipientsSectionProps) {
  const hasReachedRecipientLimit = activeRecipientCount >= MAX_RECIPIENTS;

  return (
    <Section>
      <SectionHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Family Recipients</span>
            <CollapsibleInfoTip
              storageKey="privacy_recipients_info_collapsed"
              collapsedLabel="Privacy info"
            >
              Family recipients receive weekly summaries and alert updates. Trusted
              contacts are managed separately for urgent safety outreach by SMS. What
              is shared follows your loved one&apos;s sharing preferences during
              calls.{' '}
              <Link
                href="/docs/insights-and-reports/sharing-with-family"
                className="font-medium text-primary underline underline-offset-2 hover:no-underline"
                onClick={(e) => e.stopPropagation()}
              >
                Learn more →
              </Link>
            </CollapsibleInfoTip>
          </span>
        }
        description="Invite up to 5 family members for ongoing updates. Weekly summaries stay on email, and alerts can be sent by email, SMS, or both."
      />
      <SectionBody className="gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {activeRecipientCount}/{MAX_RECIPIENTS} active recipients
            </p>

            {hasReachedRecipientLimit ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="default"
                      size="small"
                      className="w-full"
                      disabled
                    >
                      <Plus className="w-4 h-4" />
                      Invite Recipient
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Maximum 5 recipients reached</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                type="button"
                variant="default"
                size="small"
                className="w-full sm:w-auto"
                onClick={() => {
                  setInviteError(null);
                  setShowInviteModal(true);
                }}
                disabled={isInviting}
              >
                <Plus className="w-4 h-4" />
                Invite Recipient
              </Button>
            )}
          </div>

          <InvitedFamilyList
            recipients={recipients}
            onRemove={onRemoveRecipient}
            onGrantDashboardAccess={onGrantDashboardAccess}
            onRevokeDashboardAccess={onRevokeDashboardAccess}
            getRecipientDeliveryChannel={getRecipientDeliveryChannel}
            onResendSmsVerificationLink={resendRecipientSmsInvite}
            onUpdateRecipientDeliveryChannel={updateRecipientDeliveryChannel}
            dashboardAccessLoading={isDashboardSharingLoading}
            disabled={isInviting}
          />

          <Dialog
            open={showInviteModal}
            onOpenChange={(open) => {
              if (open || isInviting) return;
              attemptCloseInvite();
            }}
          >
            <DialogContent
              className="mobile-form-sheet sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
              overlayClassName="bg-black/50 backdrop-blur-none"
              onInteractOutside={(event) => {
                if (isInviting || hasInviteChanges) {
                  event.preventDefault();
                  attemptCloseInvite();
                }
              }}
              onEscapeKeyDown={(event) => {
                if (isInviting || hasInviteChanges) {
                  event.preventDefault();
                  attemptCloseInvite();
                }
              }}
              onOpenAutoFocus={(event) => {
                gateDialogAutoFocus(event, () => {
                  event.preventDefault();
                  firstInputRef.current?.focus();
                });
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle className="truncate">
                    Invite family recipient
                  </DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Weekly summaries stay on email in v1. Choose whether alerts
                    are delivered by email, SMS, or both. For urgent safety-only
                    outreach, add trusted contacts in the line&apos;s Contacts
                    section.
                  </DialogDescription>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={attemptCloseInvite}
                  disabled={isInviting}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {inviteError && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {inviteError}
                </div>
              )}

              <form onSubmit={onInviteSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField>
                    <TextField.Label>
                      Name <span className="text-destructive">*</span>
                      <TextField.Input
                        ref={firstInputRef}
                        value={inviteName}
                        onChange={(event) => setInviteName(event.target.value)}
                        placeholder="e.g., Sarah Johnson"
                        required
                      />
                    </TextField.Label>
                  </TextField>
                  <TextField>
                    <TextField.Label>
                      Email <span className="text-destructive">*</span>
                      <TextField.Input
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="sarah@example.com"
                        required
                      />
                    </TextField.Label>
                  </TextField>
                  <TextField>
                    <TextField.Label>
                      Phone{' '}
                      {inviteDeliveryChannel === 'email' ? '(optional)' : (
                        <span className="text-destructive">*</span>
                      )}
                      <PhoneInput
                        value={invitePhone}
                        onValueChange={(value) => {
                          setInvitePhone(value);
                          if (invitePhoneError) {
                            setInvitePhoneError(undefined);
                          }
                        }}
                        onBlur={(event) => {
                          setInvitePhoneError(
                            getUsPhoneValidationError(event.target.value, {
                              required: inviteDeliveryChannel !== 'email',
                            }) ?? undefined,
                          );
                        }}
                        placeholder="(555) 123-4567"
                        required={inviteDeliveryChannel !== 'email'}
                        error={invitePhoneError}
                      />
                      <TextField.Error error={invitePhoneError} />
                    </TextField.Label>
                  </TextField>
                  <TextField>
                    <TextField.Label>
                      Delivery
                      <Select
                        value={inviteDeliveryChannel}
                        onValueChange={(value) =>
                          setInviteDeliveryChannel(value as RecipientDeliveryChannel)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="both">Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </TextField.Label>
                  </TextField>
                  <TextField>
                    <TextField.Label>
                      Relationship (optional)
                      <TextField.Input
                        value={inviteRelationship}
                        onChange={(event) =>
                          setInviteRelationship(event.target.value)
                        }
                        placeholder="e.g., Daughter"
                      />
                    </TextField.Label>
                  </TextField>
                </div>

                {inviteDeliveryChannel !== 'email' ? (
                  <label className="flex items-start gap-3 rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground">
                    <Checkbox
                      checked={inviteSmsConsentAcknowledged}
                      onCheckedChange={(checked) =>
                        setInviteSmsConsentAcknowledged(Boolean(checked))
                      }
                    />
                    <span>
                      I confirm this recipient agreed to receive SMS alerts from
                      Ultaura at this phone number. They can reply STOP to stop
                      texts and START to resume.
                    </span>
                  </label>
                ) : null}

                <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={attemptCloseInvite}
                    disabled={isInviting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="default"
                    className="w-full"
                    disabled={isInviting}
                    loading={isInviting}
                  >
                    {isInviting ? 'Sending' : 'Send invite'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <ConfirmationDialog
            open={showDiscardConfirm}
            onOpenChange={(open) => {
              if (!open) setShowDiscardConfirm(false);
            }}
            title="Unsaved changes"
            description="You have unsaved changes. Leave without saving?"
            confirmLabel="Discard & leave"
            cancelLabel="Stay here"
            variant="default"
            onConfirm={closeInviteModal}
          />

          <ConfirmationDialog
            open={isGrantConfirmOpen}
            onOpenChange={(open) => {
              if (!open) onCancelGrant();
            }}
            title="Grant dashboard access?"
            description={
              pendingGrantRecipient
                ? `This gives ${pendingGrantRecipient.name} read-only access to your dashboard, including call history, insights, wellness data, schedules, and reminders for all lines.`
                : 'This gives read-only dashboard access for all lines.'
            }
            confirmLabel="Grant access"
            cancelLabel="Cancel"
            variant="default"
            onConfirm={onConfirmGrant}
            onCancel={onCancelGrant}
          />
        </SectionBody>
      </Section>
  );
}
