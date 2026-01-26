'use client';

import { useCallback } from 'react';

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

        <div className="flex flex-wrap gap-2">
          {INTEREST_TOPIC_OPTIONS.map((topic) => {
            const isSelected = selectedTopics.includes(topic);
            const isDisabled = disabled || (!isSelected && combinedTopics.length >= MAX_INTEREST_TOPICS);

            return (
              <button
                key={topic}
                type="button"
                onClick={() => toggleTopic(topic)}
                disabled={isDisabled}
                className={[
                  'rounded-full border px-3 py-1 text-sm transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-foreground hover:bg-muted',
                  isDisabled ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
              >
                {topic}
              </button>
            );
          })}
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">
            Other topics (comma-separated)
          </label>
          <input
            value={customTopics}
            onChange={(e) => onCustomTopicsChange(e.target.value)}
            placeholder="e.g., baseball, baking, church"
            disabled={customDisabled}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:opacity-50"
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
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 resize-none disabled:opacity-50"
          />
        </div>
      )}
    </div>
  );
}
