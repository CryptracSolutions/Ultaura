'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { Input } from '~/components/ui/input';
import PhoneInput from '~/components/ultaura/PhoneInput';
import { Card, CardContent } from '~/components/ui/card';
import { Checkbox } from '~/core/ui/Checkbox';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { useLeavePageGuard } from '~/core/hooks/use-leave-page-guard';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import Button from '~/core/ui/Button';
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
        <Button
          onClick={() => setIsAdding(true)}
          disabled={disabled}
          variant="default"
          size="sm"
          className="sm:w-auto"
        >
          <Plus className="h-3 w-3" />
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
          className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">Add trusted contact</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Trusted contacts receive SMS alerts when Ultaura detects distress.
              </DialogDescription>
            </div>
            <Button
              type="button"
              onClick={resetAddForm}
              variant="ghost"
              size="icon"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </Button>
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
            </div>
            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
              <Button
                type="button"
                onClick={resetAddForm}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!consentAcknowledged || isSubmitting}
                variant="default"
                size="sm"
                className="w-full"
                loading={isSubmitting}
              >
                {isSubmitting ? 'Saving' : 'Add Contact'}
              </Button>
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
                type="button"
                onClick={() => handleRemoveContact(contact.id)}
                disabled={disabled}
                aria-label={`Remove ${contact.name}`}
                variant="destructive"
                size="icon"
              >
                <Trash2 className="h-5 w-5" />
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
