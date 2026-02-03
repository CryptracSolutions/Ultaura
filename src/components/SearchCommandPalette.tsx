'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
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
import { buildLineNavigationItems } from '~/lib/search/line-navigation';
import type { SearchItem, SearchResponse } from '~/lib/search/types';
import { SEARCH_CATEGORIES } from '~/lib/search/types';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import { useAddLine } from '~/lib/contexts/AddLineContext';
import { useAddReminder } from '~/lib/contexts/AddReminderContext';
import { useAddSchedule } from '~/lib/contexts/AddScheduleContext';
import { useManualCall } from '~/lib/contexts/ManualCallContext';
import { useHelpPanel } from '~/lib/contexts/HelpPanelContext';
import { highlightText, normalizeText, scoreMatch, tokenizeText } from '~/lib/search/match';

const DEBOUNCE_MS = 150;

type QuickAction = {
  id: string;
  label: string;
  subtitle?: string;
  keywords: string[];
  icon: React.ReactNode;
  action: () => void;
};

type Scored<T> = { item: T; score: number };

type SearchRecent = {
  id: string;
  kind: 'action' | 'item';
  actionId?: string;
  href?: string;
  label: string;
  subtitle?: string;
  category?: string;
  lastUsedAt: number;
};

const RECENTS_KEY = 'ultaura.search.recents';
const RECENTS_LIMIT = 6;

export const SearchPanel = ({
  isOpen,
  query: externalQuery,
  onQueryChange: externalOnQueryChange,
  listId: externalListId,
}: {
  isOpen: boolean;
  query?: string;
  onQueryChange?: (query: string) => void;
  listId?: string;
}) => {
  const { docsIndex, close, prefillQuery, clearPrefillQuery, openMode } = useSearch();
  const { data: account } = useUltauraAccount();
  const { t } = useTranslation();
  const router = useRouter();
  const { openAddReminder } = useAddReminder();
  const { openAddSchedule } = useAddSchedule();
  const { openAddLine } = useAddLine();
  const { openManualCall } = useManualCall();
  const { open: openHelp } = useHelpPanel();
  const { recents, addRecent } = useSearchRecents(isOpen);

  const generatedListId = useId();
  const listId = externalListId ?? generatedListId;

  // Use external query/onQueryChange if provided (desktop), otherwise use internal state (mobile)
  const [internalQuery, setInternalQuery] = useState('');
  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const onQueryChange = externalOnQueryChange || setInternalQuery;
  const { cleanQuery, typeFilter } = useMemo(() => parseSearchQuery(query), [query]);

  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResponse['results']>(
    buildEmptyResults,
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(cleanQuery.trim());
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [cleanQuery]);

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

    const shouldFetch =
      !typeFilter || !['actions', 'documentation'].includes(typeFilter);

    if (!shouldFetch) {
      setResults(buildEmptyResults());
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    const url = new URL('/api/search', window.location.origin);
    url.searchParams.set('q', term);
    if (typeFilter) {
      url.searchParams.set('type', typeFilter);
    }

    fetch(url.toString(), {
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
  }, [debouncedQuery, typeFilter]);

  const userType =
    account?.user_type === 'self' || account?.user_type === 'family_managed'
      ? account.user_type
      : undefined;

  const lineNavigationItems = useMemo(
    () => buildLineNavigationItems(results.lines),
    [results.lines]
  );

  const navigationItems = useMemo(() => {
    const items = getNavigationItems(
      account ? { userType, accountId: account.id } : undefined,
    );

    const translated = items.map((item) => ({
      ...item,
      label: t(item.label, { defaultValue: item.label }),
    }));

    return [...translated, ...lineNavigationItems];
  }, [account, t, userType, lineNavigationItems]);

  const normalizedQuery = normalizeText(cleanQuery);
  const queryTokens = useMemo(() => tokenizeText(normalizedQuery), [normalizedQuery]);
  const hasQuery = normalizedQuery.length > 0;

  const scoredNavigation = useMemo<Scored<ReturnType<typeof getNavigationItems>[number]>[]>(() => {
    if (!hasQuery) return [];
    return navigationItems
      .map((item) => ({
        item,
        score: scoreMatch(normalizedQuery, [item.label, ...item.keywords].join(' ')),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, navigationItems, normalizedQuery]);

  const scoredDocs = useMemo<Scored<(typeof docsIndex)[number]>[]>(() => {
    if (!hasQuery) return [];
    return docsIndex
      .map((doc) => ({
        item: doc,
        score: scoreMatch(
          normalizedQuery,
          [doc.title, doc.label, doc.section, ...doc.keywords].join(' ')
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [docsIndex, hasQuery, normalizedQuery]);

  const quickActions = useMemo<QuickAction[]>(
    () => [
      {
        id: 'add-reminder',
        label: 'Add reminder',
        subtitle: 'Create a new reminder',
        keywords: [
          'add reminder',
          'new reminder',
          'create reminder',
          'set reminder',
          'reminder',
          'remind',
        ],
        icon: <BellIcon className="h-4 w-4" />,
        action: () => openAddReminder(),
      },
      {
        id: 'add-schedule',
        label: 'Add schedule',
        subtitle: 'Schedule check-in calls',
        keywords: [
          'add schedule',
          'create schedule',
          'schedule call',
          'call schedule',
          'check-in',
          'check in',
        ],
        icon: <CalendarDaysIcon className="h-4 w-4" />,
        action: () => openAddSchedule(),
      },
      {
        id: 'add-line',
        label: 'Add line',
        subtitle: 'Add a new loved one',
        keywords: ['add line', 'new line', 'add loved one', 'create line', 'add senior'],
        icon: <PlusCircleIcon className="h-4 w-4" />,
        action: () => openAddLine(),
      },
      {
        id: 'manual-call',
        label: 'Start manual call',
        subtitle: 'Place a call now',
        keywords: ['manual call', 'start call', 'call now', 'test call', 'place call'],
        icon: <PhoneArrowUpRightIcon className="h-4 w-4" />,
        action: () => openManualCall(),
      },
      {
        id: 'help-panel',
        label: 'Help',
        subtitle: 'Get answers and guidance',
        keywords: ['help', 'support', 'faq', 'guide', 'docs', 'documentation'],
        icon: <LifebuoyIcon className="h-4 w-4" />,
        action: () => openHelp(),
      },
    ],
    [openAddLine, openAddReminder, openAddSchedule, openHelp, openManualCall]
  );

  const actionById = useMemo(() => {
    return new Map(quickActions.map((action) => [action.id, action]));
  }, [quickActions]);

  const scoredActions = useMemo<Scored<QuickAction>[]>(() => {
    if (!hasQuery) {
      return quickActions.map((action) => ({ item: action, score: 1 }));
    }

    return quickActions
      .map((action) => ({
        item: action,
        score: scoreMatch(
          normalizedQuery,
          [action.label, action.subtitle ?? '', ...action.keywords].join(' ')
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, normalizedQuery, quickActions]);

  const scoredLines = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    return results.lines
      .map((item) => ({
        item,
        score: scoreMatch(normalizedQuery, `${item.label} ${item.subtitle ?? ''}`),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, normalizedQuery, results.lines]);

  const scoredReminders = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    return results.reminders
      .map((item) => ({
        item,
        score: scoreMatch(normalizedQuery, `${item.label} ${item.subtitle ?? ''}`),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, normalizedQuery, results.reminders]);

  const scoredSchedules = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    return results.schedules
      .map((item) => ({
        item,
        score: scoreMatch(normalizedQuery, `${item.label} ${item.subtitle ?? ''}`),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, normalizedQuery, results.schedules]);

  const scoredContacts = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    return results.contacts
      .map((item) => ({
        item,
        score: scoreMatch(normalizedQuery, `${item.label} ${item.subtitle ?? ''}`),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, normalizedQuery, results.contacts]);

  const scoredCalls = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    return results.calls
      .map((item) => ({
        item,
        score: scoreMatch(normalizedQuery, `${item.label} ${item.subtitle ?? ''}`),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, normalizedQuery, results.calls]);

  const scoredSafetyEvents = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    return results.safety_events
      .map((item) => ({
        item,
        score: scoreMatch(normalizedQuery, `${item.label} ${item.subtitle ?? ''}`),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, normalizedQuery, results.safety_events]);

  const isCategoryAllowed = useCallback(
    (category: string) => !typeFilter || typeFilter === category,
    [typeFilter]
  );

  const hasAnyResults =
    (isCategoryAllowed('actions') && scoredActions.length > 0) ||
    (isCategoryAllowed('navigation') && scoredNavigation.length > 0) ||
    (isCategoryAllowed('documentation') && scoredDocs.length > 0) ||
    (isCategoryAllowed('lines') && scoredLines.length > 0) ||
    (isCategoryAllowed('reminders') && scoredReminders.length > 0) ||
    (isCategoryAllowed('schedules') && scoredSchedules.length > 0) ||
    (isCategoryAllowed('contacts') && scoredContacts.length > 0) ||
    (isCategoryAllowed('calls') && scoredCalls.length > 0) ||
    (isCategoryAllowed('safety_events') && scoredSafetyEvents.length > 0) ||
    (!typeFilter && recents.length > 0);

  const scoredNavigationItems = useMemo<Scored<SearchItem>[]>(() => {
    return scoredNavigation.map((entry) => ({
      item: {
        id: entry.item.id,
        label: entry.item.label,
        href: entry.item.href,
        category: 'navigation',
      },
      score: entry.score,
    }));
  }, [scoredNavigation]);

  const scoredDocItems = useMemo<Scored<SearchItem>[]>(() => {
    return scoredDocs.map((entry) => ({
      item: {
        id: entry.item.id,
        label: entry.item.label,
        subtitle: entry.item.section,
        href: `/docs/${entry.item.resolvedPath}`,
        category: 'documentation',
      },
      score: entry.score,
    }));
  }, [scoredDocs]);

  const isMobileSearch = externalQuery === undefined;
  const shouldShowResults =
    !isMobileSearch || hasQuery || isLoading || recents.length > 0 || Boolean(typeFilter);
  const filterLabel = typeFilter ? getFilterLabel(typeFilter) : null;

  const handleSelect = (
    item: SearchItem | { href: string; label?: string; subtitle?: string; category?: string; id?: string }
  ) => {
    const href = 'href' in item ? item.href : undefined;
    const category = 'category' in item ? item.category : undefined;
    const label = 'label' in item ? item.label : undefined;
    const subtitle = 'subtitle' in item ? item.subtitle : undefined;
    const id = 'id' in item ? item.id : undefined;

    if (href && label) {
      addRecent({
        id: id ?? href,
        kind: 'item',
        href,
        label,
        subtitle,
        category,
        lastUsedAt: Date.now(),
      });
    }

    trackSearchEvent({
      event: 'select_result',
      query: query.trim(),
      source: openMode ?? 'desktop',
      category: category ?? 'unknown',
      itemId: id,
      href,
    });

    close();
    onQueryChange('');
    if (openMode === 'desktop') {
      (document.activeElement as HTMLElement | null)?.blur();
    }
    if (href) {
      router.push(href);
    }
  };

  const handleAction = (action: QuickAction) => {
    addRecent({
      id: action.id,
      kind: 'action',
      actionId: action.id,
      label: action.label,
      subtitle: action.subtitle,
      category: 'action',
      lastUsedAt: Date.now(),
    });

    trackSearchEvent({
      event: 'select_action',
      query: query.trim(),
      source: openMode ?? 'desktop',
      actionId: action.id,
    });

    close();
    onQueryChange('');
    if (openMode === 'desktop') {
      (document.activeElement as HTMLElement | null)?.blur();
    }
    action.action();
  };

  return (
    <Command shouldFilter={false} className="flex h-full w-full flex-col">
      {externalQuery === undefined && (
        <Command.Input
          value={query}
          onValueChange={onQueryChange}
          className="mx-3 mt-3 flex h-11 w-[calc(100%-1.5rem)] rounded-md border border-input bg-background px-3 py-3 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:!outline-none focus-visible:!border-primary disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Search..."
          aria-label="Search"
          role="combobox"
          aria-controls={listId}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          autoFocus
        />
      )}
      {shouldShowResults ? (
        <Command.List
          id={listId}
          role="listbox"
          className="max-h-[60vh] overflow-y-auto py-2"
        >
          {isLoading ? (
            <div className="px-4 py-2 text-xs text-muted-foreground">Searching...</div>
          ) : null}
          {!hasQuery && filterLabel ? (
            <div className="px-4 py-3 text-xs text-muted-foreground">
              Type to search {filterLabel}.
            </div>
          ) : null}

          {!hasQuery && !typeFilter && recents.length > 0 ? (
            <Command.Group
              heading={
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent
                </span>
              }
              className="px-2"
            >
              {recents.map((recent) => {
                if (recent.kind === 'action' && recent.actionId) {
                  const action = actionById.get(recent.actionId);
                  if (!action) return null;
                  return (
                    <ActionItem
                      key={`recent-action-${recent.actionId}`}
                      action={action}
                      onSelect={() => handleAction(action)}
                      tokens={queryTokens}
                    />
                  );
                }

                if (recent.kind === 'item' && recent.href) {
                  return (
                    <SearchResultItem
                      key={`recent-item-${recent.id}`}
                      item={{
                        id: recent.id,
                        label: recent.label,
                        subtitle: recent.subtitle,
                        href: recent.href,
                        category: (recent.category as SearchItem['category']) ?? 'navigation',
                      }}
                      icon={getCategoryIcon(recent.category)}
                      onSelect={handleSelect}
                      highlightTokens={queryTokens}
                    />
                  );
                }

                return null;
              })}
            </Command.Group>
          ) : null}

          {isCategoryAllowed('actions') && scoredActions.length > 0 ? (
            <Command.Group
              heading={
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Actions
                </span>
              }
              className="px-2"
            >
              {scoredActions.map((entry) => (
                <ActionItem
                  key={entry.item.id}
                  action={entry.item}
                  onSelect={() => handleAction(entry.item)}
                  tokens={queryTokens}
                />
              ))}
            </Command.Group>
          ) : null}

          {isCategoryAllowed('navigation') && scoredNavigation.length > 0 ? (
            <Command.Group
              heading={
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Navigation
                </span>
              }
              className="px-2"
            >
              {scoredNavigation.map((entry) => (
                <Command.Item
                  key={entry.item.id}
                  value={entry.item.label}
                  onSelect={() =>
                    handleSelect({
                      id: entry.item.id,
                      label: entry.item.label,
                      href: entry.item.href,
                      category: 'navigation',
                    })
                  }
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted data-[selected=true]:bg-muted"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {entry.item.Icon ? (
                      <entry.item.Icon className="h-4 w-4" />
                    ) : (
                      getCategoryIcon('navigation')
                    )}
                  </span>
                  <HighlightedText
                    text={entry.item.label}
                    tokens={queryTokens}
                    className="truncate text-sm font-medium text-foreground"
                  />
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}

          {isCategoryAllowed('documentation') && scoredDocItems.length > 0 ? (
            <Command.Group
              heading={
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Documentation
                </span>
              }
              className="px-2"
            >
              {scoredDocItems.map((entry) => (
                <Command.Item
                  key={entry.item.id}
                  value={entry.item.label}
                  onSelect={() => handleSelect(entry.item)}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted data-[selected=true]:bg-muted"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {getCategoryIcon('documentation')}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <HighlightedText
                      text={entry.item.label}
                      tokens={queryTokens}
                      className="truncate text-sm font-medium text-foreground"
                    />
                    {entry.item.subtitle ? (
                      <HighlightedText
                        text={entry.item.subtitle}
                        tokens={queryTokens}
                        className="truncate text-xs text-muted-foreground"
                      />
                    ) : null}
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}

          {isCategoryAllowed('lines') && scoredLines.length > 0 ? (
            <Command.Group
              heading={
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Lines
                </span>
              }
              className="px-2"
            >
              {scoredLines.map((entry) => (
                <SearchResultItem
                  key={entry.item.id}
                  item={entry.item}
                  icon={<PhoneIcon className="h-4 w-4" />}
                  onSelect={handleSelect}
                  highlightTokens={queryTokens}
                />
              ))}
            </Command.Group>
          ) : null}

          {isCategoryAllowed('reminders') && scoredReminders.length > 0 ? (
            <Command.Group
              heading={
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Reminders
                </span>
              }
              className="px-2"
            >
              {scoredReminders.map((entry) => (
                <SearchResultItem
                  key={entry.item.id}
                  item={entry.item}
                  icon={<BellIcon className="h-4 w-4" />}
                  onSelect={handleSelect}
                  highlightTokens={queryTokens}
                />
              ))}
            </Command.Group>
          ) : null}

          {isCategoryAllowed('schedules') && scoredSchedules.length > 0 ? (
            <Command.Group
              heading={
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Schedules
                </span>
              }
              className="px-2"
            >
              {scoredSchedules.map((entry) => (
                <SearchResultItem
                  key={entry.item.id}
                  item={entry.item}
                  icon={<CalendarDaysIcon className="h-4 w-4" />}
                  onSelect={handleSelect}
                  highlightTokens={queryTokens}
                />
              ))}
            </Command.Group>
          ) : null}

          {isCategoryAllowed('contacts') && scoredContacts.length > 0 ? (
            <Command.Group
              heading={
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Contacts
                </span>
              }
              className="px-2"
            >
              {scoredContacts.map((entry) => (
                <SearchResultItem
                  key={entry.item.id}
                  item={entry.item}
                  icon={<UserIcon className="h-4 w-4" />}
                  onSelect={handleSelect}
                  highlightTokens={queryTokens}
                />
              ))}
            </Command.Group>
          ) : null}

          {isCategoryAllowed('calls') && scoredCalls.length > 0 ? (
            <Command.Group
              heading={
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Calls
                </span>
              }
              className="px-2"
            >
              {scoredCalls.map((entry) => (
                <SearchResultItem
                  key={entry.item.id}
                  item={entry.item}
                  icon={<PhoneArrowUpRightIcon className="h-4 w-4" />}
                  onSelect={handleSelect}
                  highlightTokens={queryTokens}
                />
              ))}
            </Command.Group>
          ) : null}

          {isCategoryAllowed('safety_events') && scoredSafetyEvents.length > 0 ? (
            <Command.Group
              heading={
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Safety Events
                </span>
              }
              className="px-2"
            >
              {scoredSafetyEvents.map((entry) => (
                <SearchResultItem
                  key={entry.item.id}
                  item={entry.item}
                  icon={<ExclamationTriangleIcon className="h-4 w-4" />}
                  onSelect={handleSelect}
                  highlightTokens={queryTokens}
                />
              ))}
            </Command.Group>
          ) : null}

          {hasQuery && !isLoading && !hasAnyResults ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              No results found. Try a different search or use a quick action like &quot;Add reminder&quot;.
            </div>
          ) : null}
        </Command.List>
      ) : null}
    </Command>
  );
};

const SearchBottomSheet = () => {
  const { isMobileOpen, close } = useSearch();

  return (
    <Dialog open={isMobileOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="p-0 overflow-y-auto z-[60] h-[50vh] max-h-[50vh] border-t border-x border-b-0"
        overlayClassName="z-[60]"
      >
        <SearchPanel isOpen={isMobileOpen} />
      </DialogContent>
    </Dialog>
  );
};

function ActionItem({
  action,
  onSelect,
  tokens,
}: {
  action: QuickAction;
  onSelect: () => void;
  tokens: string[];
}) {
  return (
    <Command.Item
      value={`${action.label} ${action.subtitle ?? ''}`}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted data-[selected=true]:bg-muted"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {action.icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <HighlightedText
          text={action.label}
          tokens={tokens}
          className="truncate text-sm font-medium text-foreground"
        />
        {action.subtitle ? (
          <HighlightedText
            text={action.subtitle}
            tokens={tokens}
            className="truncate text-xs text-muted-foreground"
          />
        ) : null}
      </div>
    </Command.Item>
  );
}

function HighlightedText({
  text,
  tokens,
  className,
}: {
  text: string;
  tokens: string[];
  className?: string;
}) {
  const parts = highlightText(text, tokens);
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.match ? (
          <span
            key={`${part.text}-${index}`}
            className="text-primary font-semibold"
          >
            {part.text}
          </span>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        )
      )}
    </span>
  );
}

function getCategoryIcon(category?: string) {
  switch (category) {
    case 'lines':
      return <PhoneIcon className="h-4 w-4" />;
    case 'reminders':
      return <BellIcon className="h-4 w-4" />;
    case 'schedules':
      return <CalendarDaysIcon className="h-4 w-4" />;
    case 'contacts':
      return <UserIcon className="h-4 w-4" />;
    case 'calls':
      return <PhoneArrowUpRightIcon className="h-4 w-4" />;
    case 'safety_events':
      return <ExclamationTriangleIcon className="h-4 w-4" />;
    case 'documentation':
      return <DocumentTextIcon className="h-4 w-4" />;
    case 'navigation':
    default:
      return <ShieldCheckIcon className="h-4 w-4" />;
  }
}

function SearchResultItem({
  item,
  icon,
  onSelect,
  highlightTokens,
}: {
  item: SearchItem;
  icon: React.ReactNode;
  onSelect: (item: SearchItem) => void;
  highlightTokens: string[];
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
        <HighlightedText
          text={item.label}
          tokens={highlightTokens}
          className="truncate text-sm font-medium text-foreground"
        />
        {item.subtitle ? (
          <HighlightedText
            text={item.subtitle}
            tokens={highlightTokens}
            className="truncate text-xs text-muted-foreground"
          />
        ) : null}
      </div>
    </Command.Item>
  );
}

function useSearchRecents(isOpen: boolean) {
  const [recents, setRecents] = useState<SearchRecent[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem(RECENTS_KEY);
    if (!stored) {
      setRecents([]);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as SearchRecent[];
      if (Array.isArray(parsed)) {
        setRecents(parsed);
      }
    } catch {
      setRecents([]);
    }
  }, [isOpen]);

  const addRecent = (entry: SearchRecent) => {
    if (typeof window === 'undefined') return;
    setRecents((prev) => {
      const next = [
        entry,
        ...prev.filter((existing) => {
          if (entry.kind !== existing.kind) return true;
          if (entry.kind === 'action') {
            return entry.actionId !== existing.actionId;
          }
          return entry.href !== existing.href;
        }),
      ].slice(0, RECENTS_LIMIT);
      sessionStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { recents, addRecent };
}

function trackSearchEvent(payload: {
  event: 'select_action' | 'select_result';
  query: string;
  source: string;
  actionId?: string;
  itemId?: string;
  href?: string;
  category?: string;
}) {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon('/api/search/track', blob);
    return;
  }

  fetch('/api/search/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

const TYPE_FILTER_ALIASES: Record<string, string> = {
  action: 'actions',
  actions: 'actions',
  nav: 'navigation',
  navigation: 'navigation',
  doc: 'documentation',
  docs: 'documentation',
  documentation: 'documentation',
  line: 'lines',
  lines: 'lines',
  reminder: 'reminders',
  reminders: 'reminders',
  schedule: 'schedules',
  schedules: 'schedules',
  contact: 'contacts',
  contacts: 'contacts',
  call: 'calls',
  calls: 'calls',
  safety: 'safety_events',
  safety_event: 'safety_events',
  safety_events: 'safety_events',
};

const FILTER_LABELS: Record<string, string> = {
  actions: 'actions',
  navigation: 'navigation',
  documentation: 'documentation',
  lines: 'lines',
  reminders: 'reminders',
  schedules: 'schedules',
  contacts: 'contacts',
  calls: 'calls',
  safety_events: 'safety events',
};

function parseSearchQuery(raw: string): { cleanQuery: string; typeFilter: string | null } {
  const tokens = raw.split(/\\s+/).filter(Boolean);
  let typeFilter: string | null = null;
  const remaining: string[] = [];

  tokens.forEach((token) => {
    const match = token.match(/^(type|category):(.+)$/i);
    if (match) {
      const candidate = match[2]?.toLowerCase() ?? '';
      const mapped = TYPE_FILTER_ALIASES[candidate];
      if (mapped) {
        typeFilter = mapped;
        return;
      }
    }
    remaining.push(token);
  });

  return { cleanQuery: remaining.join(' '), typeFilter };
}

function getFilterLabel(typeFilter: string) {
  return FILTER_LABELS[typeFilter] ?? typeFilter;
}

function buildEmptyResults(): SearchResponse['results'] {
  return SEARCH_CATEGORIES.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as SearchResponse['results']);
}

export default SearchBottomSheet;
