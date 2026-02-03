'use client';

import { useCallback, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { cn } from '~/core/generic/shadcn-utils';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';

export const MAX_INTEREST_TOPICS = 5;

// Curated topics that tend to work well for 60+ conversation starters
export const INTEREST_TOPIC_OPTIONS = [
  'Family',
  'Grandkids',
  'Friends',
  'Memories',
  'Hometown',
  'Holidays',
  'Cooking',
  'Baking',
  'Gardening',
  'Music',
  'Movies',
  'TV shows',
  'Reading',
  'Faith / spirituality',
  'Pets',
  'Sports',
  'Travel',
  'History',
  'Nature',
  'Games & puzzles',
  'Hobbies & crafts',
  'Community events',
];

export interface TopicPreferencesFormProps {
  /** Currently selected curated topics */
  selectedTopics: string[];
  /** Comma-separated custom topics entered by user */
  customTopics: string;
  /** Comma-separated topics to avoid */
  avoidTopics: string;
  /** Callback when selected topics change */
  onSelectedTopicsChange: (topics: string[]) => void;
  /** Callback when custom topics change */
  onCustomTopicsChange: (value: string) => void;
  /** Callback when avoid topics change */
  onAvoidTopicsChange: (value: string) => void;
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Label for the "enjoy" section */
  enjoyLabel?: string;
  /** Label for the "avoid" section */
  avoidLabel?: string;
  /** Whether to show the avoid topics section */
  showAvoidTopics?: boolean;
}

export function TopicPreferencesForm({
  selectedTopics,
  customTopics,
  avoidTopics,
  onSelectedTopicsChange,
  onCustomTopicsChange,
  onAvoidTopicsChange,
  disabled = false,
  enjoyLabel = 'Topics They Enjoy (optional)',
  avoidLabel = 'Topics to Avoid (optional)',
  showAvoidTopics = true,
}: TopicPreferencesFormProps) {
  const [isTopicsDropdownOpen, setIsTopicsDropdownOpen] = useState(false);
  const normalizeTopic = (topic: string) => topic.trim();

  const parseCustomTopics = useCallback(
    (raw: string) =>
      raw
        .split(',')
        .map(normalizeTopic)
        .filter(Boolean),
    []
  );

  const customTopicList = parseCustomTopics(customTopics);

  const combinedTopics = Array.from(
    new Set(
      [...selectedTopics, ...customTopicList].map((topic) => normalizeTopic(topic))
    )
  ).slice(0, MAX_INTEREST_TOPICS);

  const selectedCount = combinedTopics.length;
  const customDisabled = disabled || selectedTopics.length >= MAX_INTEREST_TOPICS;

  const toggleTopic = (topic: string) => {
    const exists = selectedTopics.includes(topic);
    if (exists) {
      onSelectedTopicsChange(selectedTopics.filter((t) => t !== topic));
    } else if (combinedTopics.length < MAX_INTEREST_TOPICS) {
      onSelectedTopicsChange([...selectedTopics, topic]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Topics They Enjoy */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <label className="block text-sm font-medium text-foreground">
            {enjoyLabel}
          </label>
          <div className="text-xs text-muted-foreground">
            Selected: {selectedCount}/{MAX_INTEREST_TOPICS}
          </div>
        </div>

        <DropdownMenu open={isTopicsDropdownOpen} onOpenChange={setIsTopicsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'flex h-10 w-full space-x-2 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              <span className="truncate text-foreground">
                {selectedTopics.length > 0
                  ? `${selectedTopics.length} selected`
                  : 'Select topics'}
              </span>
              <ChevronDownIcon
                className={cn(
                  'h-4 text-muted-foreground transition-transform',
                  isTopicsDropdownOpen ? 'rotate-180' : '',
                )}
              />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            sideOffset={6}
            alignOffset={0}
            className={cn(
              // Ensure it renders above Dialog overlay/content (both z-50)
              'z-[60]',
              // Constrain within viewport, scroll internally
              'max-h-[min(280px,var(--radix-dropdown-menu-content-available-height))] overflow-auto',
              // Match trigger width as closely as possible
              'min-w-[var(--radix-dropdown-menu-trigger-width)]',
              // Make sure pointer events work inside modals
              'pointer-events-auto',
            )}
          >
            {INTEREST_TOPIC_OPTIONS.map((topic) => {
              const isSelected = selectedTopics.includes(topic);
              const isDisabled =
                disabled || (!isSelected && combinedTopics.length >= MAX_INTEREST_TOPICS);

              return (
                <DropdownMenuCheckboxItem
                  key={topic}
                  checked={isSelected}
                  disabled={isDisabled}
                  // Keep menu open for multi-select
                  onSelect={(event) => {
                    event.preventDefault();
                    toggleTopic(topic);
                  }}
                >
                  <span className="truncate">{topic}</span>
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">
            Other topics (comma-separated)
          </label>
          <input
            value={customTopics}
            onChange={(e) => onCustomTopicsChange(e.target.value)}
            placeholder="e.g., baseball, baking, church"
            disabled={customDisabled}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground transition-colors placeholder:text-muted-foreground focus-visible:!outline-none focus-visible:!border-primary disabled:opacity-50"
          />
          {customDisabled && !disabled ? (
            <p className="text-xs text-muted-foreground">
              Remove a selected topic to add a custom one.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              We&apos;ll save up to {MAX_INTEREST_TOPICS} total topics.
            </p>
          )}
        </div>
      </div>

      {/* Topics to Avoid */}
      {showAvoidTopics && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {avoidLabel}
          </label>
          <textarea
            value={avoidTopics}
            onChange={(e) => onAvoidTopicsChange(e.target.value)}
            placeholder="e.g., politics, health issues..."
            rows={2}
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground transition-colors placeholder:text-muted-foreground focus-visible:!outline-none focus-visible:!border-primary resize-none disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}
