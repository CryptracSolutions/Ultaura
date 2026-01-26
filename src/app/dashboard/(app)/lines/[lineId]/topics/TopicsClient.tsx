'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, X } from 'lucide-react';
import { updateLine } from '~/lib/ultaura/lines';
import type { LineRow, UserType } from '~/lib/ultaura/types';
import { Section, SectionBody, SectionHeader } from '~/core/ui/Section';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import {
  modalIconButtonClass,
  modalPrimaryButtonClass,
  modalSecondaryButtonClass,
} from '~/core/ui/modal-button-classes';
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
  const storedEnjoyTopics = line.seed_interests ?? [];
  const storedAvoidTopics = line.seed_avoid_topics ?? [];

  // Separate curated from custom topics for the form
  const initialSelectedTopics = storedEnjoyTopics.filter((t) =>
    INTEREST_TOPIC_OPTIONS.includes(t)
  );
  const initialCustomTopics = storedEnjoyTopics
    .filter((t) => !INTEREST_TOPIC_OPTIONS.includes(t))
    .join(', ');

  // Edit form state
  const [selectedTopics, setSelectedTopics] = useState<string[]>(initialSelectedTopics);
  const [customTopics, setCustomTopics] = useState(initialCustomTopics);
  const [avoidTopics, setAvoidTopics] = useState(storedAvoidTopics.join(', '));

  const canEdit = userType === 'family_managed';

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
      <Section>
        <SectionHeader
          title="Conversation Topics"
          description={
            canEdit
              ? "Topics Ultaura uses to personalize conversations. These can also be updated by your loved one during calls."
              : "Topics Ultaura uses to personalize your conversations. You can update these during calls."
          }
        />
        <SectionBody className="gap-6">
          {/* Topics They Enjoy */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-medium text-foreground">Topics They Enjoy</h3>
              {canEdit && !disabled && (
                <button
                  type="button"
                  onClick={handleOpenEdit}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
            </div>
            {storedEnjoyTopics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
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
              <p className="text-sm text-muted-foreground">
                No topics set yet.{' '}
                {canEdit && !disabled && (
                  <button
                    type="button"
                    onClick={handleOpenEdit}
                    className="text-primary hover:underline"
                  >
                    Add topics
                  </button>
                )}
              </p>
            )}
          </div>

          {/* Topics to Avoid */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Topics to Avoid</h3>
            {storedAvoidTopics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
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
              <p className="text-sm text-muted-foreground">No topics to avoid set.</p>
            )}
          </div>

          {!canEdit && (
            <p className="text-xs text-muted-foreground border-t border-border pt-4">
              You can change these topics by speaking with Ultaura during a call. Just say something like &quot;I&apos;d like to talk more about gardening&quot; or &quot;Please don&apos;t bring up politics.&quot;
            </p>
          )}
        </SectionBody>
      </Section>

      {/* Edit Modal */}
      <Dialog open={isEditing} onOpenChange={(open) => !open && handleCloseEdit()}>
        <DialogContent
          className="max-w-[500px] max-h-[85vh] overflow-y-auto"
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
              className={modalSecondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className={modalPrimaryButtonClass}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
