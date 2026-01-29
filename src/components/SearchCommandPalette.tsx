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
  LifebuoyIcon,
  PhoneArrowUpRightIcon,
  PhoneIcon,
  PlusCircleIcon,
  ShieldCheckIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent } from '~/core/ui/Dialog';
import { useSearch } from '~/lib/contexts/SearchContext';
import { getNavigationItems } from '~/lib/search/navigation-registry';
import type { SearchItem, SearchResponse } from '~/lib/search/types';
import { SEARCH_CATEGORIES } from '~/lib/search/types';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import { useAddLine } from '~/lib/contexts/AddLineContext';
import { useAddReminder } from '~/lib/contexts/AddReminderContext';
import { useAddSchedule } from '~/lib/contexts/AddScheduleContext';
import { useManualCall } from '~/lib/contexts/ManualCallContext';
import { useHelpPanel } from '~/lib/contexts/HelpPanelContext';

const DEBOUNCE_MS = 150;

type QuickAction = {
  id: string;
  label: string;
  subtitle?: string;
  keywords: string[];
  icon: React.ReactNode;
  action: () => void;
};

export const SearchPanel = ({
  isOpen,
  query: externalQuery,
  onQueryChange: externalOnQueryChange
}: {
  isOpen: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
}) => {
  const { docsIndex, close, prefillQuery, clearPrefillQuery } = useSearch();
  const { data: account } = useUltauraAccount();
  const { t } = useTranslation();
  const router = useRouter();
  const { openAddReminder } = useAddReminder();
  const { openAddSchedule } = useAddSchedule();
  const { openAddLine } = useAddLine();
  const { openManualCall } = useManualCall();
  const { open: openHelp } = useHelpPanel();

  // Use external query/onQueryChange if provided (desktop), otherwise use internal state (mobile)
  const [internalQuery, setInternalQuery] = useState('');
  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const onQueryChange = externalOnQueryChange || setInternalQuery;

  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResponse['results']>(
    buildEmptyResults,
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!isOpen) {
      if (!externalQuery) {
        onQueryChange('');
      }
      setDebouncedQuery('');
      setResults(buildEmptyResults());
      setIsLoading(false);
    }
  }, [isOpen, externalQuery, onQueryChange]);

  useEffect(() => {
    if (!isOpen || !prefillQuery || externalQuery !== undefined) return;
    onQueryChange(prefillQuery);
    clearPrefillQuery();
  }, [clearPrefillQuery, isOpen, prefillQuery, externalQuery, onQueryChange]);

  useEffect(() => {
    const term = debouncedQuery.trim();

    if (term.length === 0) {
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
  const hasQuery = normalizedQuery.length > 0;

  const filteredNavigation = useMemo(() => {
    if (!hasQuery) return [];
    return navigationItems.filter((item) => {
      const haystack = [item.label, ...item.keywords]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [hasQuery, navigationItems, normalizedQuery]);

  const filteredDocs = useMemo(() => {
    if (!hasQuery) return [];
    return docsIndex
      .filter((doc) => {
        const haystack = [doc.title, doc.label, doc.section, ...doc.keywords]
          .join(' ')
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 6);
  }, [docsIndex, hasQuery, normalizedQuery]);

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        id: 'add-reminder',
        label: 'Add reminder',
        subtitle: 'Create a new reminder',
        keywords: ['add reminder', 'new reminder', 'create reminder', 'reminder'],
        icon: <BellIcon className="h-4 w-4" />,
        action: () => openAddReminder(),
      },
      {
        id: 'add-schedule',
        label: 'Add schedule',
        subtitle: 'Schedule check-in calls',
        keywords: ['add schedule', 'create schedule', 'schedule call', 'call schedule'],
        icon: <CalendarDaysIcon className="h-4 w-4" />,
        action: () => openAddSchedule(),
      },
      {
        id: 'add-line',
        label: 'Add line',
        subtitle: 'Add a new loved one',
        keywords: ['add line', 'new line', 'add loved one', 'create line'],
        icon: <PlusCircleIcon className="h-4 w-4" />,
        action: () => openAddLine(),
      },
      {
        id: 'manual-call',
        label: 'Start manual call',
        subtitle: 'Place a call now',
        keywords: ['manual call', 'start call', 'call now', 'test call'],
        icon: <PhoneArrowUpRightIcon className="h-4 w-4" />,
        action: () => openManualCall(),
      },
      {
        id: 'help-panel',
        label: 'Help',
        subtitle: 'Get answers and guidance',
        keywords: ['help', 'support', 'faq', 'guide'],
        icon: <LifebuoyIcon className="h-4 w-4" />,
        action: () => openHelp(),
      },
    ],
    [openAddLine, openAddReminder, openAddSchedule, openHelp, openManualCall]
  );

  const filteredActions = useMemo(() => {
    if (!hasQuery) return quickActions;

    return quickActions.filter((action) => {
      const haystack = [action.label, ...action.keywords]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [hasQuery, normalizedQuery, quickActions]);

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
    filteredActions.length > 0 ||
    filteredNavigation.length > 0 ||
    filteredDocs.length > 0 ||
    hasDynamicResults;

  const handleSelect = (item: SearchItem | { href: string }) => {
    close();
    onQueryChange('');
    if ('href' in item) {
      router.push(item.href);
    }
  };

  const handleAction = (action: QuickAction) => {
    close();
    onQueryChange('');
    action.action();
  };

  return (
    <Command shouldFilter={false} className="flex h-full w-full flex-col">
      {externalQuery === undefined && (
        <Command.Input
          value={query}
          onValueChange={onQueryChange}
          className="flex h-11 w-full rounded-md bg-background px-3 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Search..."
          aria-label="Search"
          autoFocus
        />
      )}
      <Command.List className="max-h-[60vh] overflow-y-auto py-2">
        {isLoading ? (
          <div className="px-4 py-2 text-xs text-muted-foreground">Searching...</div>
        ) : null}

        {filteredActions.length > 0 ? (
          <Command.Group
            heading={
              <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </span>
            }
            className="px-2"
          >
            {filteredActions.map((action) => (
              <Command.Item
                key={action.id}
                value={`${action.label} ${action.subtitle ?? ''}`}
                onSelect={() => handleAction(action)}
                className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted data-[selected=true]:bg-muted"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  {action.icon}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {action.label}
                  </span>
                  {action.subtitle ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {action.subtitle}
                    </span>
                  ) : null}
                </div>
              </Command.Item>
            ))}
          </Command.Group>
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
                onSelect={() => handleSelect({ href: item.href })}
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
                onSelect={() => handleSelect({ href: `/docs/${doc.resolvedPath}` })}
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

        {hasQuery && !isLoading && !hasAnyResults ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            No results found. Try a different search.
          </div>
        ) : null}
      </Command.List>
    </Command>
  );
};

const SearchBottomSheet = () => {
  const { isMobileOpen, close } = useSearch();

  return (
    <Dialog open={isMobileOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="p-0 overflow-hidden z-[60]"
        overlayClassName="z-[60]"
      >
        <SearchPanel isOpen={isMobileOpen} />
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

export default SearchBottomSheet;
