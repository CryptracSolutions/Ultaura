'use client';

import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

interface FAQSidebarProps {
  categories: { id: string; title: string }[];
  activeId: string;
  onCategoryClick: (id: string) => void;
  variant?: 'desktop' | 'mobile';
}

export function FAQSidebar({
  categories,
  activeId,
  onCategoryClick,
  variant = 'desktop',
}: FAQSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCategory = categories.find((cat) => cat.id === activeId);

  const handleCategoryClick = (id: string) => {
    setIsOpen(false);
    onCategoryClick(id);
  };

  if (variant === 'mobile') {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card text-foreground font-medium"
        >
          <span>{activeCategory?.title ?? 'Select category'}</span>
          <ChevronDownIcon
            className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 z-10 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            {categories.map((category) => {
              const isActive = category.id === activeId;
              return (
                <div
                  key={category.id}
                  onClick={() => handleCategoryClick(category.id)}
                  className={`px-4 py-3 hover:bg-muted/50 cursor-pointer ${
                    isActive ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  {category.title}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Desktop variant
  return (
    <nav className="space-y-1">
      {categories.map((category) => {
        const isActive = category.id === activeId;
        return (
          <button
            key={category.id}
            onClick={() => onCategoryClick(category.id)}
            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? 'text-primary bg-primary/10 font-medium border-l-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {category.title}
          </button>
        );
      })}
    </nav>
  );
}
