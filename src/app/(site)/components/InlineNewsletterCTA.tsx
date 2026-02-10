'use client';

import NewsletterForm from './NewsletterForm';

interface InlineNewsletterCTAProps {
  source: string;
}

export default function InlineNewsletterCTA({
  source,
}: InlineNewsletterCTAProps) {
  return (
    <div className="rounded-xl border border-border bg-surface-subtle p-6 my-8">
      <p className="text-lg font-semibold text-foreground">
        Get elder care tips in your inbox
      </p>
      <p className="text-sm text-muted-foreground mt-1">
        Weekly tips and updates, no spam.
      </p>
      <div className="mt-4">
        <NewsletterForm source={source} compact />
      </div>
    </div>
  );
}
