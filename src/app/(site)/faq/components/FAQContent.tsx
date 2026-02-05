'use client';

import { useState, useMemo } from 'react';
import type { FAQCategory } from '../faq-data';
import { FAQSearch } from './FAQSearch';
import { FAQSection } from './FAQSection';

interface FAQContentProps {
  categories: FAQCategory[];
}

export function FAQContent({ categories }: FAQContentProps) {
  const [query, setQuery] = useState('');

  const filteredCategories = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return categories;

    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.question.toLowerCase().includes(normalized) ||
            item.answer.toLowerCase().includes(normalized)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, query]);

  const resultsCount = filteredCategories.reduce(
    (sum, cat) => sum + cat.items.length,
    0
  );

  const hasQuery = query.trim().length > 0;
  const noResults = hasQuery && resultsCount === 0;

  return (
    <div>
      <FAQSearch
        query={query}
        onQueryChange={setQuery}
        resultsCount={resultsCount}
        categoriesCount={filteredCategories.length}
      />

      {noResults ? (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">
            No questions found matching &ldquo;{query}&rdquo;
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-primary hover:underline font-medium"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-12">
          {filteredCategories.map((category) => (
            <FAQSection key={category.id} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}
