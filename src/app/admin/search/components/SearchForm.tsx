'use client';

import { useState } from 'react';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

import Button from '~/core/ui/Button';
import { TextFieldInput } from '~/core/ui/TextField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import Heading from '~/core/ui/Heading';

type SearchType = 'email' | 'phone' | 'uid' | 'line_phone';

const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  email: 'Email',
  phone: 'Phone',
  uid: 'User ID',
  line_phone: 'Line Phone',
};

const SEARCH_TYPE_PLACEHOLDERS: Record<SearchType, string> = {
  email: 'user@example.com',
  phone: '+15551234567',
  uid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  line_phone: '+15559876543',
};

interface SearchFormProps {
  searchQuery: string;
  searchType: SearchType;
}

export function SearchForm({ searchQuery, searchType }: SearchFormProps) {
  const [selectedType, setSelectedType] = useState<SearchType>(searchType);

  return (
    <div className="rounded-xl bg-card p-5 card-border-accent space-y-4">
      <Heading type={5}>Find Users, Accounts, and Lines</Heading>

      <form method="GET" className="flex flex-col space-y-4">
        <input type="hidden" name="type" value={selectedType} />

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <TextFieldInput
              name="q"
              defaultValue={searchQuery}
              placeholder={SEARCH_TYPE_PLACEHOLDERS[selectedType]}
              autoFocus
            />
          </div>

          <div className="w-full sm:w-48">
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as SearchType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Search by..." />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SEARCH_TYPE_LABELS) as [SearchType, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Button type="submit" variant="default">
              <MagnifyingGlassIcon className="h-4 w-4" />
              <span>Search</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
