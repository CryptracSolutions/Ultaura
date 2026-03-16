'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import TextField from '~/core/ui/TextField';
import type { HealthAutocompleteOption } from '@ultaura/types';

interface HealthAutocompleteInputProps {
  type: 'condition' | 'medication';
  value: string;
  standardizedId: { system: string; code: string } | null;
  onChange: (name: string) => void;
  onStandardizedIdChange: (id: { system: string; code: string } | null) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

const DEBOUNCE_MS = 300;

export function HealthAutocompleteInput({
  type,
  value,
  standardizedId: _standardizedId,
  onChange,
  onStandardizedIdChange,
  disabled,
  placeholder,
  id,
}: HealthAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<HealthAutocompleteOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = `health-autocomplete-${type}-listbox`;

  const search = useCallback(
    async (q: string) => {
      if (!q.trim() || q.trim().length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      setIsLoading(true);
      try {
        const endpoint =
          type === 'condition'
            ? `/api/health/autocomplete/conditions?q=${encodeURIComponent(q)}`
            : `/api/health/autocomplete/medications?q=${encodeURIComponent(q)}`;

        const res = await fetch(endpoint);
        if (!res.ok) {
          setSuggestions([]);
          return;
        }

        const data: HealthAutocompleteOption[] = await res.json();
        setSuggestions(data);
        setShowDropdown(data.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [type],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    onChange(next);
    onStandardizedIdChange(null); // clear standardized id when typing

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(next), DEBOUNCE_MS);
  };

  const handleSelect = (option: HealthAutocompleteOption) => {
    onChange(option.normalizedName);
    onStandardizedIdChange(option.standardizedId);
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      const selected = suggestions[activeIndex];
      if (selected) handleSelect(selected);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <TextField.Input
          id={id}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder ?? (type === 'condition' ? 'e.g. Type 2 Diabetes' : 'e.g. Metformin')}
          className="min-h-[44px] pr-8"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
        />
        {isLoading && (
          <Loader2
            className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`${type} suggestions`}
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-y-auto max-h-60"
        >
          {suggestions.map((option, index) => (
            <li
              key={`${option.standardizedId.system}-${option.standardizedId.code}`}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur before click registers
                handleSelect(option);
              }}
              className={`min-h-[44px] flex items-center px-3 py-2 text-sm cursor-pointer transition-colors ${
                index === activeIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <span className="truncate">{option.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
