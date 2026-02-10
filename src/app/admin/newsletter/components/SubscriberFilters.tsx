'use client';

import { useRef } from 'react';

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

const STATUS_OPTIONS = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Pending' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'expired_pending', label: 'Expired' },
];
const SOURCE_OPTIONS = [
  { value: 'homepage', label: 'Homepage' },
  { value: 'footer', label: 'Footer' },
  { value: 'blog_listing', label: 'Blog Listing' },
  { value: 'blog_post', label: 'Blog Post' },
];
const TOPIC_OPTIONS = [
  { value: 'blog_digest', label: 'Blog Digest' },
  { value: 'elder_care_tips', label: 'Elder Care Tips' },
  { value: 'product_updates', label: 'Product Updates' },
];

export function SubscriberFilters({
  currentFilters,
}: {
  currentFilters: Record<string, string | undefined>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  function handleChange() {
    formRef.current?.submit();
  }

  return (
    <form ref={formRef} method="GET" className="flex flex-wrap gap-4">
      <div className="w-48">
        <select
          name="status"
          className={selectClassName}
          defaultValue={currentFilters.status ?? ''}
          onChange={handleChange}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="w-48">
        <select
          name="source"
          className={selectClassName}
          defaultValue={currentFilters.source ?? ''}
          onChange={handleChange}
        >
          <option value="">All sources</option>
          {SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="w-48">
        <select
          name="topic"
          className={selectClassName}
          defaultValue={currentFilters.topic ?? ''}
          onChange={handleChange}
        >
          <option value="">All topics</option>
          {TOPIC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
