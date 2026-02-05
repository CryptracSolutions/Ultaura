'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';

import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import Textarea from '~/core/ui/Textarea';
import { submitFeedbackAction } from '~/plugins/feedback-popup/lib/feedback-actions';

const SUPPORT_EMAIL = 'support@ultaura.com';
const DEFAULT_SUBJECT = 'Ultaura support request';

type ContactFields = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
};

const EMPTY_FIELDS: ContactFields = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
};

function buildSubmissionText(fields: ContactFields) {
  const lines = [
    `Name: ${fields.name || 'Not provided'}`,
    `Email: ${fields.email || 'Not provided'}`,
    `Phone: ${fields.phone || 'Not provided'}`,
    `Subject: ${fields.subject || DEFAULT_SUBJECT}`,
  ];

  return `${lines.join('\n')}\n\nMessage:\n${fields.message || ''}`.trim();
}

export default function ContactForm() {
  const [status, formAction] = useFormState(submitFeedbackAction, {
    success: undefined,
  });
  const hasError = status.success !== undefined && !status.success;
  const [fields, setFields] = useState<ContactFields>(EMPTY_FIELDS);

  const submissionText = useMemo(
    () => buildSubmissionText(fields),
    [fields],
  );

  if (status.success) {
    return (
      <div className="rounded-2xl border border-border/60 bg-sidebar p-6 md:p-8 space-y-4 shadow-xl">
        <h3 className="text-xl font-semibold text-foreground">
          Thanks, we got your message.
        </h3>
        <p className="text-muted-foreground">
          We typically respond in under 2 hours. If you need immediate help,
          email{' '}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 md:p-8 space-y-4">
        <h3 className="text-xl font-semibold text-foreground">
          Something went wrong.
        </h3>
        <p className="text-muted-foreground">
          Please try again later, or email{' '}
          <a className="underline" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="type" value="question" />
      <input type="hidden" name="text" value={submissionText} />
      <input type="hidden" name="metadata[source]" value="public-contact" />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField>
          <TextField.Label htmlFor="contact-name">Full name</TextField.Label>
          <TextField.Input
            id="contact-name"
            name="metadata[name]"
            autoComplete="name"
            required
            placeholder="Margaret Johnson"
            value={fields.name}
            onChange={(event) =>
              setFields((prev) => ({ ...prev, name: event.target.value }))
            }
          />
        </TextField>

        <TextField>
          <TextField.Label htmlFor="contact-email">Email</TextField.Label>
          <TextField.Input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={fields.email}
            onChange={(event) =>
              setFields((prev) => ({ ...prev, email: event.target.value }))
            }
          />
        </TextField>
      </div>

      <TextField>
        <TextField.Label htmlFor="contact-phone">Phone (optional)</TextField.Label>
        <TextField.Input
          id="contact-phone"
          name="metadata[phone]"
          type="tel"
          autoComplete="tel"
          placeholder="(555) 555-5555"
          value={fields.phone}
          onChange={(event) =>
            setFields((prev) => ({ ...prev, phone: event.target.value }))
          }
        />
      </TextField>

      <TextField>
        <TextField.Label htmlFor="contact-subject">Subject</TextField.Label>
        <TextField.Input
          id="contact-subject"
          name="metadata[subject]"
          placeholder="Scheduling, billing, voice options..."
          value={fields.subject}
          onChange={(event) =>
            setFields((prev) => ({ ...prev, subject: event.target.value }))
          }
        />
      </TextField>

      <TextField>
        <TextField.Label htmlFor="contact-message">How can we help?</TextField.Label>
        <Textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          placeholder="Share a few details so we can help quickly."
          value={fields.message}
          onChange={(event) =>
            setFields((prev) => ({
              ...prev,
              message: (event.target as HTMLTextAreaElement).value,
            }))
          }
        />
      </TextField>

      <DeviceInfoFields />

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" loading={pending} className="whitespace-nowrap">
      {pending ? 'Sending...' : 'Send message'}
    </Button>
  );
}

function DeviceInfoFields() {
  if (typeof window === 'undefined') {
    return null;
  }

  const { userAgent, language } = navigator;
  const width = window.innerWidth.toString();
  const height = window.innerHeight.toString();
  const screenName = document.title;

  return (
    <>
      <input type="hidden" name="screen_name" value={screenName} />
      <input type="hidden" name="device_info[user_agent]" value={userAgent} />
      <input type="hidden" name="device_info[language]" value={language} />
      <input
        type="hidden"
        name="device_info[screen_size][width]"
        value={width}
      />
      <input
        type="hidden"
        name="device_info[screen_size][height]"
        value={height}
      />
    </>
  );
}
