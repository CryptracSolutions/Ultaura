'use client';

import { useState } from 'react';
import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';

interface NewsletterFormProps {
  source: string;
  compact?: boolean;
}

export default function NewsletterForm({
  source,
  compact,
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
      <p className="text-sm text-primary font-medium">
        You're subscribed! No email confirmation needed.
      </p>
    );
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2">
          <TextField.Input
            type="email"
            required
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" loading={loading}>
            Subscribe
          </Button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-destructive">{error}</p>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField>
        <TextField.Label>
          Email <span className="text-destructive">*</span>
        </TextField.Label>
        <TextField.Input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </TextField>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" loading={loading} block>
        Subscribe
      </Button>
    </form>
  );
}
