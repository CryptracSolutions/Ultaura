'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { updateOverageCap } from '~/lib/ultaura/actions';

const CAP_OPTIONS = [
  { value: 0, label: 'No limit' },
  { value: 1000, label: '$10' },
  { value: 2500, label: '$25' },
  { value: 5000, label: '$50' },
  { value: 10000, label: '$100' },
];

interface UsageCapControlProps {
  accountId: string;
  capCents: number;
  disabled?: boolean;
}

export default function UsageCapControl({ accountId, capCents, disabled = false }: UsageCapControlProps) {
  const [value, setValue] = useState(String(capCents ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setValue(String(capCents ?? 0));
  }, [capCents]);

  const handleChange = (nextValue: string) => {
    if (disabled) return;

    const previous = value;
    setValue(nextValue);
    setError(null);

    startTransition(async () => {
      try {
        const result = await updateOverageCap(accountId, Number(nextValue));
        if (!result?.success) {
          throw new Error(result?.error || 'Update failed');
        }
        toast.success('Spending cap updated');
      } catch (err) {
        setValue(previous);
        setError('Unable to update the spending cap. Please try again.');
      }
    });
  };

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={handleChange} disabled={disabled || isPending}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CAP_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={String(option.value)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
