'use client';

import { useState } from 'react';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';

interface NewsletterFormProps {
  source: string;
  compact?: boolean;
  hideRequiredIndicator?: boolean;
}

export default function NewsletterForm({
  source,
  compact,
  hideRequiredIndicator = false,
}: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Something went wrong. Please try again.');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <p className="text-sm text-primary font-medium" aria-live="polite">
        You&apos;re subscribed! No email confirmation needed.
      </p>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <EnvelopeIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
            <TextField.Input
              type="email"
              required
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-9 bg-primary/10 border-primary/20 placeholder:text-zinc-400"
              aria-label="Email address"
            />
          </div>
          <Button type="submit" loading={loading}>
            Subscribe
          </Button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-destructive" aria-live="polite">{error}</p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField>
        <TextField.Label>
          Email {!hideRequiredIndicator && <span className="text-destructive">*</span>}
        </TextField.Label>
        <TextField.Input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Email address"
        />
      </TextField>

      {error && (
        <p className="text-sm text-destructive" aria-live="polite">{error}</p>
      )}

      <Button type="submit" loading={loading} block>
        Subscribe
      </Button>
    </form>
  );
}
