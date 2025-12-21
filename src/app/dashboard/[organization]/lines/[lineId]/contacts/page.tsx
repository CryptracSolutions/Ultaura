'use client';

import { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Phone, Trash2, Plus } from 'lucide-react';
import {
  getTrustedContacts,
  addTrustedContact,
  removeTrustedContact,
} from '~/lib/ultaura/actions';
import { toast } from 'sonner';

interface TrustedContact {
  id: string;
  name: string;
  relationship: string | null;
  phone_e164: string;
  notify_on: string[];
  enabled: boolean;
}

export default function TrustedContactsPage() {
  const params = useParams();
  const lineId = params.lineId as string;
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relationship: '',
  });

  const loadContacts = useCallback(async () => {
    const data = await getTrustedContacts(lineId);
    setContacts((data || []) as unknown as TrustedContact[]);
  }, [lineId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    try {
      const result = await addTrustedContact(lineId, {
        name: newContact.name,
        phoneE164: newContact.phone,
        relationship: newContact.relationship || undefined,
      });

      if (!result.success) {
        toast.error(result.error || 'Failed to add contact');
        return;
      }

      toast.success('Trusted contact added');
      setNewContact({ name: '', phone: '', relationship: '' });
      setIsAdding(false);
      loadContacts();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add contact');
    }
  }

  async function handleRemoveContact(contactId: string) {
    try {
      await removeTrustedContact(contactId);
      toast.success('Trusted contact removed');
      loadContacts();
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove contact');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Trusted Contacts</h1>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      <p className="text-muted-foreground">
        Trusted contacts can be notified if we detect signs of distress during calls
        (only with the caller&apos;s consent).
      </p>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Add Trusted Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddContact} className="space-y-4">
              <Input
                placeholder="Name"
                value={newContact.name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewContact({ ...newContact, name: e.target.value })}
                required
              />
              <Input
                placeholder="Phone Number"
                type="tel"
                value={newContact.phone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setNewContact({ ...newContact, phone: e.target.value })}
                required
              />
              <Input
                placeholder="Relationship (optional)"
                value={newContact.relationship}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setNewContact({ ...newContact, relationship: e.target.value })
                }
              />
              <div className="flex gap-2">
                <Button type="submit">Add</Button>
                <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
    </div>
  );
}
