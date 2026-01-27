'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import Button from '~/core/ui/Button';
import { Input } from '~/components/ui/input';
import PhoneInput from '~/components/ultaura/PhoneInput';
import { Card, CardContent } from '~/components/ui/card';
import { Checkbox } from '~/core/ui/Checkbox';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { useLeavePageGuard } from '~/core/hooks/use-leave-page-guard';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import {
  modalIconButtonClass,
  modalPrimaryButtonClass,
  modalSecondaryButtonClass,
} from '~/core/ui/modal-button-classes';
import { Phone, Trash2, Plus, X } from 'lucide-react';
import {
  getTrustedContacts,
  addTrustedContact,
  removeTrustedContact,
} from '~/lib/ultaura/contacts';
import { formatToE164, getUsPhoneValidationError } from '~/lib/ultaura/phone';
import { toast } from 'sonner';

interface TrustedContact {
  id: string;
  name: string;
  relationship: string | null;
  phone_e164: string;
  notify_on: string[];
  enabled: boolean;
}

interface ContactsClientProps {
  line: {
    id: string;
    shortId: string;
  };
  disabled?: boolean;
}

export function ContactsClient({ line, disabled = false }: ContactsClientProps) {
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relationship: '',
  });

  const loadContacts = useCallback(async () => {
    const data = await getTrustedContacts(line.id);
    setContacts((data || []) as unknown as TrustedContact[]);
  }, [line.id]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!isAdding) {
      setConsentAcknowledged(false);
    }
  }, [isAdding]);

  const resetAddForm = () => {
    setNewContact({ name: '', phone: '', relationship: '' });
    setConsentAcknowledged(false);
    setPhoneError(null);
    setIsAdding(false);
  };

  const hasChanges =
    isAdding &&
    (newContact.name.trim() !== '' ||
      newContact.phone.trim() !== '' ||
      newContact.relationship.trim() !== '' ||
      consentAcknowledged);
  const { dialogProps } = useLeavePageGuard({
    isDirty: hasChanges,
    onDiscard: resetAddForm,
  });

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;

    const validationError = getUsPhoneValidationError(newContact.phone, { required: true });
    if (validationError) {
      setPhoneError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      const phoneE164 = formatToE164(newContact.phone);
      const result = await addTrustedContact(line.id, {
        name: newContact.name,
        phoneE164,
        relationship: newContact.relationship || undefined,
      });

      if (!result.success) {
        toast.error(result.error.message || 'Failed to add contact');
        return;
      }

      toast.success('Trusted contact added');
      resetAddForm();
      loadContacts();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add contact');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveContact(contactId: string) {
    if (disabled) return;

    try {
      const result = await removeTrustedContact(contactId, line.shortId);
      if (!result.success) {
        toast.error(result.error.message || 'Failed to remove contact');
        return;
      }
      toast.success('Trusted contact removed');
      loadContacts();
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove contact');
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Trusted contacts receive SMS alerts when Ultaura detects signs of distress during calls.{' '}
          <a
            href="/docs/safety-and-contacts/trusted-contacts"
            className="text-primary hover:underline"
          >
            Learn more →
          </a>
        </p>
        <Button onClick={() => setIsAdding(true)} disabled={disabled} size="small">
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      <Dialog
        open={isAdding && !disabled}
        onOpenChange={(open) => {
          if (!open) {
            resetAddForm();
          }
        }}
      >
        <DialogContent
          className="max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">Add trusted contact</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Trusted contacts receive SMS alerts when Ultaura detects distress.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={resetAddForm}
              className={modalIconButtonClass}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddContact} className="space-y-4">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-medium text-foreground mb-1">
                Name
              </label>
              <Input
                id="contact-name"
                placeholder="e.g., John Smith"
                value={newContact.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewContact({ ...newContact, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="contact-phone" className="block text-sm font-medium text-foreground mb-1">
                Phone Number
              </label>
              <PhoneInput
                id="contact-phone"
                placeholder="e.g., (555) 123-4567"
                value={newContact.phone}
                onValueChange={(value) => {
                  setNewContact({ ...newContact, phone: value });
                  if (phoneError) {
                    setPhoneError(null);
                  }
                }}
                onBlur={(event) => {
                  setPhoneError(getUsPhoneValidationError(event.target.value, { required: true }));
                }}
                required
              />
              {phoneError ? (
                <p className="text-xs text-destructive">{phoneError}</p>
              ) : null}
            </div>
            <div>
              <label htmlFor="contact-relationship" className="block text-sm font-medium text-foreground mb-1">
                Relationship <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                id="contact-relationship"
                placeholder="e.g., Son, Daughter, Caregiver"
                value={newContact.relationship}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setNewContact({ ...newContact, relationship: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="consent-acknowledgment"
                  checked={consentAcknowledged}
                  onCheckedChange={(checked) => setConsentAcknowledged(checked === true)}
                />
                <label htmlFor="consent-acknowledgment" className="text-sm leading-tight">
                  I understand that this contact will receive SMS notifications when Ultaura detects
                  signs of distress during calls (such as expressions of hopelessness or self-harm).
                </label>
              </div>
              <a
                href="/docs/safety-and-contacts/trusted-contacts"
                className="text-xs text-primary hover:underline"
              >
                Learn more about trusted contact notifications →
              </a>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={resetAddForm}
                className={modalSecondaryButtonClass}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!consentAcknowledged || isSubmitting}
                className={modalPrimaryButtonClass}
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving
                  </>
                ) : (
                  'Add Contact'
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        {contacts.map((contact) => (
          <Card key={contact.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {contact.phone_e164}
                    {contact.relationship && ` · ${contact.relationship}`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveContact(contact.id)}
                disabled={disabled}
                aria-label={`Remove ${contact.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}

        {contacts.length === 0 && !isAdding && (
          <p className="text-center py-8 text-muted-foreground">
            No trusted contacts added yet.
          </p>
        )}
      </div>

      <ConfirmationDialog
        open={dialogProps.open}
        onOpenChange={dialogProps.onOpenChange}
        title="Unsaved changes"
        description="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard & leave"
        cancelLabel="Stay here"
        variant="default"
        onConfirm={dialogProps.onConfirm}
      />
    </div>
  );
}
