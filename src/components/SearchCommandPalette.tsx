'use client';

import { type ComponentType, type SVGProps, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Bell,
  CalendarDays,
  FileText,
  Phone,
  PhoneOutgoing,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import { useSearch } from '~/lib/contexts/SearchContext';
import { getNavigationItems } from '~/lib/search/navigation-registry';
import { buildLineNavigationItems } from '~/lib/search/line-navigation';
import type { SearchItem, SearchResponse } from '~/lib/search/types';
import { SEARCH_CATEGORIES } from '~/lib/search/types';
import { buildIntentBoostMap, getIntentBoost } from '~/lib/search/intent';
import useUltauraAccount from '~/lib/ultaura/hooks/use-ultaura-account';
import { highlightText, normalizeText, scoreMatch, tokenizeText } from '~/lib/search/match';

const DEBOUNCE_MS = 150;

type Scored<T> = { item: T; score: number };

type SearchRecent = {
  id: string;
  kind: 'item';
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
  const { recents, addRecent } = useSearchRecents(isOpen);

  const generatedListId = useId();
  const listId = externalListId ?? generatedListId;

  // Use external query/onQueryChange if provided (desktop), otherwise use internal state (mobile)
  const [internalQuery, setInternalQuery] = useState('');
  const query = externalQuery !== undefined ? externalQuery : internalQuery;
  const onQueryChange = externalOnQueryChange || setInternalQuery;
  const cleanQuery = query;

  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<SearchResponse['results']>(
    buildEmptyResults,
  );
  const [isLoading, setIsLoading] = useState(false);
  const lastSearchSessionRef = useRef<{
    searchId: string | null;
    query: string;
    startedAtMs: number;
    completedAtMs: number;
    resultCount: number;
  } | null>(null);

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
      lastSearchSessionRef.current = null;
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

    const url = new URL('/api/search', window.location.origin);
    url.searchParams.set('q', term);
    const startedAt = performance.now();

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
        const completedAt = performance.now();
        const latencyMs = Math.max(0, Math.round(completedAt - startedAt));
        const totalResults = countTotalResultItems(payload.results ?? buildEmptyResults());

        lastSearchSessionRef.current = {
          searchId: payload.searchId ?? null,
          query: term,
          startedAtMs: startedAt,
          completedAtMs: completedAt,
          resultCount: totalResults,
        };

        trackSearchEvent({
          event: 'query_executed',
          query: term,
          source: openMode ?? 'desktop',
          searchId: payload.searchId,
          latencyMs,
          resultCount: totalResults,
          zeroResults: totalResults === 0,
          categoryCounts: summarizeCategoryCounts(payload.results ?? buildEmptyResults()),
        });
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return;
        toast.error('Search failed. Please try again.');
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, openMode]);

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
  const intentBoosts = useMemo(() => buildIntentBoostMap(normalizedQuery), [normalizedQuery]);
  const hasQuery = normalizedQuery.length > 0;

  const scoredNavigation = useMemo<Scored<ReturnType<typeof getNavigationItems>[number]>[]>(() => {
    if (!hasQuery) return [];
    const intentBoost = getIntentBoost(intentBoosts, 'navigation');
    return navigationItems
      .map((item) => ({
        item,
        score: scoreMatch(normalizedQuery, [item.label, ...item.keywords].join(' ')) + intentBoost,
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, intentBoosts, navigationItems, normalizedQuery]);

  const scoredDocs = useMemo<Scored<(typeof docsIndex)[number]>[]>(() => {
    if (!hasQuery) return [];
    const intentBoost = getIntentBoost(intentBoosts, 'documentation');
    return docsIndex
      .map((doc) => ({
        item: doc,
        score: scoreMatch(
          normalizedQuery,
          [doc.title, doc.label, doc.section, ...doc.keywords].join(' ')
        ) + intentBoost,
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [docsIndex, hasQuery, intentBoosts, normalizedQuery]);

  const scoredLines = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    const intentBoost = getIntentBoost(intentBoosts, 'lines');
    return results.lines
      .map((item) => ({
        item,
        score: getSearchItemScore(item, normalizedQuery) + intentBoost,
      }))
      .filter((entry) => isStrongSearchMatch(entry.score, normalizedQuery))
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, intentBoosts, normalizedQuery, results.lines]);

  const scoredReminders = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    const intentBoost = getIntentBoost(intentBoosts, 'reminders');
    return results.reminders
      .map((item) => ({
        item,
        score: getSearchItemScore(item, normalizedQuery) + intentBoost,
      }))
      .filter((entry) => isStrongSearchMatch(entry.score, normalizedQuery))
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, intentBoosts, normalizedQuery, results.reminders]);

  const scoredSchedules = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    const intentBoost = getIntentBoost(intentBoosts, 'schedules');
    return results.schedules
      .map((item) => ({
        item,
        score: getSearchItemScore(item, normalizedQuery) + intentBoost,
      }))
      .filter((entry) => isStrongSearchMatch(entry.score, normalizedQuery))
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, intentBoosts, normalizedQuery, results.schedules]);

  const scoredContacts = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    const intentBoost = getIntentBoost(intentBoosts, 'contacts');
    return results.contacts
      .map((item) => ({
        item,
        score: getSearchItemScore(item, normalizedQuery) + intentBoost,
      }))
      .filter((entry) => isStrongSearchMatch(entry.score, normalizedQuery))
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, intentBoosts, normalizedQuery, results.contacts]);

  const scoredCalls = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    const intentBoost = getIntentBoost(intentBoosts, 'calls');
    return results.calls
      .map((item) => ({
        item,
        score: getSearchItemScore(item, normalizedQuery) + intentBoost,
      }))
      .filter((entry) => isStrongSearchMatch(entry.score, normalizedQuery))
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, intentBoosts, normalizedQuery, results.calls]);

  const scoredSafetyEvents = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];
    const intentBoost = getIntentBoost(intentBoosts, 'safety_events');
    return results.safety_events
      .map((item) => ({
        item,
        score: getSearchItemScore(item, normalizedQuery) + intentBoost,
      }))
      .filter((entry) => isStrongSearchMatch(entry.score, normalizedQuery))
      .sort((a, b) => b.score - a.score);
  }, [hasQuery, intentBoosts, normalizedQuery, results.safety_events]);

  const scoredNavigationItems = useMemo<Scored<SearchItem>[]>(() => {
    return scoredNavigation.map((entry) => ({
      item: {
        id: entry.item.id,
        label: entry.item.label,
        href: entry.item.href,
        category: 'navigation',
      },
      score: entry.score - 2,
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
      score: entry.score - 3.5,
    }));
  }, [scoredDocs]);

  const unifiedResults = useMemo<Scored<SearchItem>[]>(() => {
    if (!hasQuery) return [];

    const ranked = [
      ...scoredLines,
      ...scoredReminders,
      ...scoredSchedules,
      ...scoredContacts,
      ...scoredCalls,
      ...scoredSafetyEvents,
      ...scoredNavigationItems,
      ...scoredDocItems,
    ];

    return ranked
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [
    hasQuery,
    scoredCalls,
    scoredContacts,
    scoredDocItems,
    scoredLines,
    scoredNavigationItems,
    scoredReminders,
    scoredSafetyEvents,
    scoredSchedules,
  ]);

  const isMobileSearch = externalQuery === undefined;
  const shouldShowResults = !isMobileSearch || isOpen;

  const handleSelect = (
    item: SearchItem | { href: string; label?: string; subtitle?: string; category?: string; id?: string }
  ) => {
    const nowMs = performance.now();
    const activeSession = lastSearchSessionRef.current;
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
      query: cleanQuery.trim(),
      source: openMode ?? 'desktop',
      category: category ?? 'unknown',
      itemId: id,
      href,
      searchId: activeSession?.searchId ?? undefined,
      resultCount: activeSession?.resultCount,
      timeToClickMs: activeSession ? Math.max(0, Math.round(nowMs - activeSession.startedAtMs)) : undefined,
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

  const totalVisibleResults = useMemo(() => {
    return unifiedResults.length;
  }, [unifiedResults.length]);

  return (
    <Command shouldFilter={false} className="flex h-full w-full flex-col">
      {externalQuery === undefined && (
        <Command.Input
          value={query}
          onValueChange={onQueryChange}
          className="mx-3 mt-3 flex h-11 w-[calc(100%-1.5rem)] rounded-md border border-input bg-background px-3 py-3 text-base sm:text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:!outline-none focus-visible:!border-primary disabled:cursor-not-allowed disabled:opacity-50"
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
          className="max-h-[60vh] overflow-y-auto overscroll-contain touch-pan-y py-2"
        >
          {hasQuery ? (
            <div className="px-3 pb-1 pt-1 text-left text-[11px] text-muted-foreground">
              {isLoading
                ? 'Searching...'
                : `${totalVisibleResults} result${totalVisibleResults === 1 ? '' : 's'}`}
            </div>
          ) : null}

          {!hasQuery ? (
            <div className="px-3 pb-1 pt-1 text-[11px] text-muted-foreground">
              {recents.length > 0
                ? 'Recent'
                : 'Search by name, phone, call, safety, or reminder.'}
            </div>
          ) : null}

          {!hasQuery && recents.length > 0 ? (
            <Command.Group
              heading={
                <span className="px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Recent
                </span>
              }
              className="px-2 pt-1"
            >
              {recents.map((recent) => (
                <SearchResultItem
                  key={`recent-item-${recent.id}`}
                  item={{
                    id: recent.id,
                    label: recent.label,
                    subtitle: recent.subtitle,
                    href: recent.href ?? '/dashboard',
                    category: (recent.category as SearchItem['category']) ?? 'navigation',
                  }}
                  Icon={getCategoryIcon(recent.category)}
                  onSelect={handleSelect}
                  highlightTokens={queryTokens}
                />
              ))}
            </Command.Group>
          ) : null}

          {hasQuery && unifiedResults.length > 0 ? (
            <div className="px-2 pt-1">
              {unifiedResults.map((entry) => (
                <SearchResultItem
                  key={`result-${entry.item.category}-${entry.item.id}`}
                  item={entry.item}
                  Icon={getCategoryIcon(entry.item.category)}
                  onSelect={handleSelect}
                  highlightTokens={queryTokens}
                />
              ))}
            </div>
          ) : null}

          {hasQuery && !isLoading && unifiedResults.length === 0 ? (
            <div className="space-y-2 px-4 py-6 text-sm text-muted-foreground">
              <p>No exact matches yet for &quot;{cleanQuery.trim()}&quot;.</p>
              <p>Try a person name, phone number, or words like “call”, “safety”, “reminder”, or “contact”.</p>
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
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search across navigation, reminders, schedules, contacts, calls, and documentation.
        </DialogDescription>
        <SearchPanel isOpen={isMobileOpen} />
      </DialogContent>
    </Dialog>
  );
};

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

function getCategoryIcon(category?: string): ComponentType<SVGProps<SVGSVGElement>> {
  switch (category) {
    case 'lines':
      return Phone;
    case 'reminders':
      return Bell;
    case 'schedules':
      return CalendarDays;
    case 'contacts':
      return UserRound;
    case 'calls':
      return PhoneOutgoing;
    case 'safety_events':
      return TriangleAlert;
    case 'documentation':
      return FileText;
    case 'navigation':
    default:
      return ShieldCheck;
  }
}

function SearchResultItem({
  item,
  Icon,
  onSelect,
  highlightTokens,
}: {
  item: SearchItem;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  onSelect: (item: SearchItem) => void;
  highlightTokens: string[];
}) {
  return (
    <Command.Item
      value={`${item.label} ${item.subtitle ?? ''}`}
      onSelect={() => onSelect(item)}
      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm aria-selected:bg-muted data-[selected=true]:bg-muted touch-manipulation"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-[18px] w-[18px] shrink-0 stroke-[1.9]" aria-hidden="true" />
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
        <span className="truncate text-[11px] text-muted-foreground">
          {CATEGORY_HINT_LABELS[item.category] ?? 'Result'}
        </span>
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
        ...prev.filter((existing) => entry.href !== existing.href),
      ].slice(0, RECENTS_LIMIT);
      sessionStorage.setItem(RECENTS_KEY, JSON.stringify(next));
      return next;
    });
  };

  return { recents, addRecent };
}

function trackSearchEvent(payload: {
  event: 'select_result' | 'query_executed';
  query: string;
  source: string;
  searchId?: string;
  latencyMs?: number;
  resultCount?: number;
  zeroResults?: boolean;
  timeToClickMs?: number;
  categoryCounts?: Record<string, number>;
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

const CATEGORY_HINT_LABELS: Record<SearchItem['category'], string> = {
  navigation: 'Page',
  documentation: 'Doc',
  lines: 'Line',
  reminders: 'Reminder',
  schedules: 'Schedule',
  contacts: 'Contact',
  calls: 'Call',
  safety_events: 'Alert',
};

function countTotalResultItems(results: SearchResponse['results']): number {
  return SEARCH_CATEGORIES.reduce((total, category) => total + (results[category]?.length ?? 0), 0);
}

function summarizeCategoryCounts(results: SearchResponse['results']): Record<string, number> {
  return SEARCH_CATEGORIES.reduce((acc, category) => {
    acc[category] = results[category]?.length ?? 0;
    return acc;
  }, {} as Record<string, number>);
}

function getSearchItemScore(item: SearchItem, normalizedQuery: string): number {
  return item.matchScore ?? scoreMatch(normalizedQuery, `${item.label} ${item.subtitle ?? ''}`);
}

function isStrongSearchMatch(score: number, normalizedQuery: string): boolean {
  const tokenCount = tokenizeText(normalizedQuery, { minLength: 2, maxTokens: 12 }).length;
  const minScore = normalizedQuery.length <= 2 ? 6 : tokenCount <= 1 ? 4.5 : 3.5;
  return score >= minScore;
}

function buildEmptyResults(): SearchResponse['results'] {
  return SEARCH_CATEGORIES.reduce((acc, category) => {
    acc[category] = [];
    return acc;
  }, {} as SearchResponse['results']);
}

export default SearchBottomSheet;
