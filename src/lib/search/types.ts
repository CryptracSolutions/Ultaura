export type SearchCategory =
  | 'navigation'
  | 'documentation'
  | 'lines'
  | 'reminders'
  | 'schedules'
  | 'contacts'
  | 'calls'
  | 'safety_events';

export type SearchItem = {
  id: string;
  label: string;
  subtitle?: string;
  href: string;
  category: SearchCategory;
  timestamp?: string;
};

export type SearchResponse = {
  query: string;
  results: Record<SearchCategory, SearchItem[]>;
};

export type DocsIndexItem = {
  id: string;
  title: string;
  label: string;
  resolvedPath: string;
  section: string;
  keywords: string[];
};

export const SEARCH_CATEGORIES: SearchCategory[] = [
  'navigation',
  'documentation',
  'lines',
  'reminders',
  'schedules',
  'contacts',
  'calls',
  'safety_events',
];
