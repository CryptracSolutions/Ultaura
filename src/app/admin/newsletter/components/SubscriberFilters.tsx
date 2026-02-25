'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '~/core/ui/Select';

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState(currentFilters.status ?? '');
  const [source, setSource] = useState(currentFilters.source ?? '');
  const [topic, setTopic] = useState(currentFilters.topic ?? '');

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-4">
      <div className="w-full sm:w-48">
        <Select
          value={status}
          onValueChange={(value) => {
            const next = value === '_all' ? '' : value;
            setStatus(next);
            navigate('status', next);
          }}
        >
          <SelectTrigger aria-label="Filter by subscription status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-48">
        <Select
          value={source}
          onValueChange={(value) => {
            const next = value === '_all' ? '' : value;
            setSource(next);
            navigate('source', next);
          }}
        >
          <SelectTrigger aria-label="Filter by source">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All sources</SelectItem>
            {SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-48">
        <Select
          value={topic}
          onValueChange={(value) => {
            const next = value === '_all' ? '' : value;
            setTopic(next);
            navigate('topic', next);
          }}
        >
          <SelectTrigger aria-label="Filter by topic">
            <SelectValue placeholder="All topics" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All topics</SelectItem>
            {TOPIC_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
