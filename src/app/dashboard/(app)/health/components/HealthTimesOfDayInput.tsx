'use client';

import { Plus, X } from 'lucide-react';
import Button from '~/core/ui/Button';

interface HealthTimesOfDayInputProps {
  value: string[];
  onChange: (times: string[]) => void;
}

const MAX_TIMES = 8;

export function HealthTimesOfDayInput({ value, onChange }: HealthTimesOfDayInputProps) {
  function handleTimeChange(index: number, newTime: string) {
    const updated = [...value];
    updated[index] = newTime;
    onChange(dedupeAndSort(updated));
  }

  function handleRemove(index: number) {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  }

  function handleAdd() {
    if (value.length >= MAX_TIMES) return;
    onChange([...value, '08:00']);
  }

  return (
    <div className="space-y-2">
      {value.map((time, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="time"
            value={time}
            onChange={(e) => handleTimeChange(index, e.target.value)}
            className="flex min-h-[44px] rounded-md border border-input bg-background px-3 py-2 text-base sm:text-sm transition-colors focus-visible:outline-none focus-visible:border-primary"
            aria-label={`Time ${index + 1}`}
          />
          <button
            type="button"
            onClick={() => handleRemove(index)}
            aria-label={`Remove time ${index + 1}`}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:border-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {value.length < MAX_TIMES && (
        <Button
          type="button"
          variant="outline"
          size="small"
          onClick={handleAdd}
          className="min-h-[44px] gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add time
        </Button>
      )}

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">No times set. Use &quot;Add time&quot; to schedule doses.</p>
      )}
    </div>
  );
}

function dedupeAndSort(times: string[]): string[] {
  const unique = Array.from(new Set(times.filter(Boolean)));
  unique.sort();
  return unique;
}
