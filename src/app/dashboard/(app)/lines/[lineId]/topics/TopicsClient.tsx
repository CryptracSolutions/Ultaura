'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Plus, X } from 'lucide-react';
import { updateLine } from '~/lib/ultaura/lines';
import type { LineRow, UserType } from '~/lib/ultaura/types';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import {
  modalIconButtonClass,
} from '~/core/ui/modal-button-classes';
import {
  COMPACT_OUTLINE_BUTTON_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';
import {
  TopicPreferencesForm,
  INTEREST_TOPIC_OPTIONS,
  MAX_INTEREST_TOPICS,
} from '~/components/ultaura/TopicPreferencesForm';

interface TopicsClientProps {
  line: LineRow;
  userType: UserType;
  disabled?: boolean;
}

export function TopicsClient({ line, userType, disabled = false }: TopicsClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Parse stored topics (already arrays from DB)
  const storedEnjoyTopics = useMemo(
    () => line.seed_interests ?? [],
    [line.seed_interests]
  );
  const storedAvoidTopics = useMemo(
    () => line.seed_avoid_topics ?? [],
    [line.seed_avoid_topics]
  );

  // Separate curated from custom topics for the form
  const initialSelectedTopics = useMemo(
    () => storedEnjoyTopics.filter((t) => INTEREST_TOPIC_OPTIONS.includes(t)),
    [storedEnjoyTopics]
  );
  const initialCustomTopics = useMemo(
    () =>
      storedEnjoyTopics
        .filter((t) => !INTEREST_TOPIC_OPTIONS.includes(t))
        .join(', '),
    [storedEnjoyTopics]
  );

  // Edit form state
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialSelectedTopics);
  const [customTopics, setCustomTopics] = useState(initialCustomTopics);
  const [avoidTopics, setAvoidTopics] = useState(storedAvoidTopics.join(', '));

  const canEdit = userType === 'family_managed';
  const hasAnyTopics = storedEnjoyTopics.length > 0 || storedAvoidTopics.length > 0;

  const resetForm = useCallback(() => {
    setSelectedTopics(initialSelectedTopics);
    setCustomTopics(initialCustomTopics);
    setAvoidTopics(storedAvoidTopics.join(', '));
  }, [initialSelectedTopics, initialCustomTopics, storedAvoidTopics]);

  const handleOpenEdit = () => {
    resetForm();
    setIsEditing(true);
  };

  const handleCloseEdit = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Combine selected + custom topics into array
      const customList = customTopics.split(',').map((t) => t.trim()).filter(Boolean);
      const combinedTopics = Array.from(
        new Set([...selectedTopics, ...customList])
      ).slice(0, MAX_INTEREST_TOPICS);

      const avoidList = avoidTopics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await updateLine(line.id, {
        seedInterests: combinedTopics,  // Always send array (empty or filled)
        seedAvoidTopics: avoidList,     // Always send array (empty or filled)
      });

      if (!result.success) {
        toast.error(result.error?.message || 'Failed to save topics');
        return;
      }

      toast.success('Topics updated');
      setIsEditing(false);
      router.refresh();
    } catch {
      toast.error('Failed to save topics');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    selectedTopics.join(',') !== initialSelectedTopics.join(',') ||
    customTopics !== initialCustomTopics ||
    avoidTopics !== storedAvoidTopics.join(', ');

  return (
    <>
      <div className="space-y-6 pb-12">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {canEdit
              ? 'Topics Ultaura uses to personalize conversations. These can also be updated by your loved one during calls.'
              : 'Topics Ultaura uses to personalize your conversations. You can update these during calls.'}
          </p>
          {canEdit ? (
            <button
              onClick={handleOpenEdit}
              disabled={disabled}
              className={COMPACT_PRIMARY_BUTTON_CLASS}
            >
              {hasAnyTopics ? (
                <Pencil className="h-3 w-3" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              {hasAnyTopics ? 'Edit Topics' : 'Add Topics'}
            </button>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <div className="space-y-6">
            {/* Topics They Enjoy */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-foreground">Topics They Enjoy</h3>
              </div>
              {storedEnjoyTopics.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {storedEnjoyTopics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  No topics set yet.
                </p>
              )}
            </div>

            {/* Topics to Avoid */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <h3 className="text-sm font-semibold text-foreground">Topics to Avoid</h3>
              {storedAvoidTopics.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {storedAvoidTopics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-sm text-destructive"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No topics to avoid set.</p>
              )}
            </div>

            {!canEdit && (
              <p className="text-xs text-muted-foreground">
                You can change these topics by speaking with Ultaura during a call. Just say something like &quot;I&apos;d like to talk more about gardening&quot; or &quot;Please don&apos;t bring up politics.&quot;
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={isEditing} onOpenChange={(open) => !open && handleCloseEdit()}>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:w-[min(90vw,500px)] sm:max-w-[500px]"
          overlayClassName="bg-black/50 backdrop-blur-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">Edit Topics</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update conversation topics for {line.display_name}.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={handleCloseEdit}
              disabled={isSaving}
              className={modalIconButtonClass}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <TopicPreferencesForm
            selectedTopics={selectedTopics}
            customTopics={customTopics}
            avoidTopics={avoidTopics}
            onSelectedTopicsChange={setSelectedTopics}
            onCustomTopicsChange={setCustomTopics}
            onAvoidTopicsChange={setAvoidTopics}
            disabled={isSaving}
          />

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleCloseEdit}
              disabled={isSaving}
              className={COMPACT_OUTLINE_BUTTON_CLASS}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className={COMPACT_PRIMARY_BUTTON_CLASS}
            >
              {isSaving ? (
                <>
                  <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
