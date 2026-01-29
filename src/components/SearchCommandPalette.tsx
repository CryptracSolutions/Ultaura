'use client';

import { useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  BellIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  PhoneArrowUpRightIcon,
  PhoneIcon,
  ShieldCheckIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent } from '~/core/ui/Dialog';
import { useSearch } from '~/lib/contexts/SearchContext';
import { getNavigationItems } from '~/lib/search/navigation-registry';
import type { DocsIndexItem, SearchItem, SearchResponse } from '~/lib/search/types';
import { SEARCH_CATEGORIES } from '~/lib/search/types';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';

const SearchCommandPalette = ({ docsIndex }: { docsIndex: DocsIndexItem[] }) => {
  const router = useRouter();
  const { isOpen, toggle, setOpen } = useSearch();
  const { data: account } = useUltauraAccount();
  const { t } = useTranslation();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResponse['results']>(
    buildEmptyResults,
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isEditable) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        toggle();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setResults(buildEmptyResults());
      setIsLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const term = debouncedQuery.trim();

    if (term.length < 2) {
      setResults(buildEmptyResults());
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(term)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Search failed');
        }
        return (await response.json()) as SearchResponse;
      })
      .then((payload) => {
        setResults(payload.results ?? buildEmptyResults());
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        toast.error('Search failed. Please try again.');
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  const userType =
    account?.user_type === 'self' || account?.user_type === 'family_managed'
      ? account.user_type
      : undefined;

  const navigationItems = useMemo(() => {
    const items = getNavigationItems(
      account ? { userType, accountId: account.id } : undefined,
    );

    return items.map((item) => ({
      ...item,
      label: t(item.label, { defaultValue: item.label }),
    }));
  }, [account, t, userType]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredNavigation = useMemo(() => {
    if (!normalizedQuery) return navigationItems;
    return navigationItems.filter((item) => {
      const haystack = [item.label, ...item.keywords]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [navigationItems, normalizedQuery]);

  const filteredDocs = useMemo(() => {
    if (!normalizedQuery) return [];
    return docsIndex
      .filter((doc) => {
        const haystack = [doc.title, doc.label, doc.section, ...doc.keywords]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [docsIndex, normalizedQuery]);

  const hasDynamicResults = useMemo(() => {
    return (
      results.lines.length > 0 ||
      results.reminders.length > 0 ||
      results.schedules.length > 0 ||
      results.contacts.length > 0 ||
      results.calls.length > 0 ||
      results.safety_events.length > 0
    );
  }, [results]);

  const hasAnyResults =
    filteredNavigation.length > 0 || filteredDocs.length > 0 || hasDynamicResults;

  const handleSelect = (item: SearchItem | { href: string }) => {
    setOpen(false);
    setQuery('');
    router.push(item.href);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="p-0 overflow-hidden sm:max-w-[640px]">
        <Command shouldFilter={false} className="flex h-full w-full flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search lines, reminders, schedules, docs..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          <Command.List className="max-h-[60vh] overflow-y-auto py-2">
            {isLoading ? (
              <div className="px-4 py-2 text-xs text-muted-foreground">
                Searching...
              </div>
            ) : null}

            {filteredNavigation.length > 0 ? (
              <Command.Group
                heading={
                  <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Navigation
                  </span>
                }
                className="px-2"
              >
                {filteredNavigation.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={item.label}
                    onSelect={() => handleSelect(item)}
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted data-[selected=true]:bg-muted"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      {item.Icon ? (
                        <item.Icon className="h-4 w-4" />
                      ) : (
                        <ShieldCheckIcon className="h-4 w-4" />
                      )}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {filteredDocs.length > 0 ? (
              <Command.Group
                heading={
                  <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Documentation
                  </span>
                }
                className="px-2"
              >
                {filteredDocs.map((doc) => (
                  <Command.Item
                    key={doc.id}
                    value={doc.label}
                    onSelect={() =>
                      handleSelect({ href: `/docs/${doc.resolvedPath}` })
                    }
                    className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted data-[selected=true]:bg-muted"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <DocumentTextIcon className="h-4 w-4" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">
                        {doc.label}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {doc.section}
                      </span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}

            {results.lines.length > 0 ? (
              <Command.Group
                heading={
                  <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Lines
                  </span>
                }
                className="px-2"
              >
                {results.lines.map((item) => (
                  <SearchResultItem
                    key={item.id}
                    item={item}
                    icon={<PhoneIcon className="h-4 w-4" />}
                    onSelect={handleSelect}
                  />
                ))}
              </Command.Group>
            ) : null}

            {results.reminders.length > 0 ? (
              <Command.Group
                heading={
                  <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Reminders
                  </span>
                }
                className="px-2"
              >
                {results.reminders.map((item) => (
                  <SearchResultItem
                    key={item.id}
                    item={item}
                    icon={<BellIcon className="h-4 w-4" />}
                    onSelect={handleSelect}
                  />
                ))}
              </Command.Group>
            ) : null}

            {results.schedules.length > 0 ? (
              <Command.Group
                heading={
                  <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Schedules
                  </span>
                }
                className="px-2"
              >
                {results.schedules.map((item) => (
                  <SearchResultItem
                    key={item.id}
                    item={item}
                    icon={<CalendarDaysIcon className="h-4 w-4" />}
                    onSelect={handleSelect}
                  />
                ))}
              </Command.Group>
            ) : null}

            {results.contacts.length > 0 ? (
              <Command.Group
                heading={
                  <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Contacts
                  </span>
                }
                className="px-2"
              >
                {results.contacts.map((item) => (
                  <SearchResultItem
                    key={item.id}
                    item={item}
                    icon={<UserIcon className="h-4 w-4" />}
                    onSelect={handleSelect}
                  />
                ))}
              </Command.Group>
            ) : null}

            {results.calls.length > 0 ? (
              <Command.Group
                heading={
                  <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Calls
                  </span>
                }
                className="px-2"
              >
                {results.calls.map((item) => (
                  <SearchResultItem
                    key={item.id}
                    item={item}
                    icon={<PhoneArrowUpRightIcon className="h-4 w-4" />}
                    onSelect={handleSelect}
                  />
                ))}
              </Command.Group>
            ) : null}

            {results.safety_events.length > 0 ? (
              <Command.Group
                heading={
                  <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Safety Events
                  </span>
                }
                className="px-2"
              >
                {results.safety_events.map((item) => (
                  <SearchResultItem
                    key={item.id}
                    item={item}
                    icon={<ExclamationTriangleIcon className="h-4 w-4" />}
                    onSelect={handleSelect}
                  />
                ))}
              </Command.Group>
            ) : null}

            {normalizedQuery && !isLoading && !hasAnyResults ? (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                No results found. Try a different search.
              </div>
            ) : null}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

function SearchResultItem({
  item,
  icon,
  onSelect,
}: {
  item: SearchItem;
  icon: React.ReactNode;
  onSelect: (item: SearchItem) => void;
}) {
  return (
    <Command.Item
      value={`${item.label} ${item.subtitle ?? ''}`}
      onSelect={() => onSelect(item)}
      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted data-[selected=true]:bg-muted"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {item.label}
        </span>
        {item.subtitle ? (
          <span className="truncate text-xs text-muted-foreground">
            {item.subtitle}
          </span>
        ) : null}
      </div>
    </Command.Item>
  );
}

function buildEmptyResults(): SearchResponse['results'] {
  return SEARCH_CATEGORIES.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as SearchResponse['results']);
}

export default SearchCommandPalette;
