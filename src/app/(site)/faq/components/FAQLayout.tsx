'use client';

import { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import type { FAQCategory } from '../faq-data';
import { FAQSidebar } from './FAQSidebar';
import { FAQContent } from './FAQContent';

interface FAQLayoutProps {
  categories: FAQCategory[];
}

export function FAQLayout({ categories }: FAQLayoutProps) {
  const [activeId, setActiveId] = useState(categories[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const sections = categories
      .map((cat) => document.getElementById(cat.id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [categories]);

  const handleCategoryClick = useCallback((id: string) => {
    flushSync(() => {
      setSearchQuery('');
    });
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', `#${id}`);
      setActiveId(id);
    }
  }, []);

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
      {/* Mobile sidebar (dropdown) */}
      <div className="lg:hidden">
        <FAQSidebar
          categories={categories}
          activeId={activeId}
          onCategoryClick={handleCategoryClick}
          variant="mobile"
        />
      </div>
      {/* Sidebar - sticky on desktop (matches docs pattern) */}
      <aside
        style={{ height: 'calc(100vh - 7rem)' }}
        className="hidden lg:flex w-64 shrink-0 sticky top-28 flex-col overflow-y-auto"
      >
        <FAQSidebar
          categories={categories}
          activeId={activeId}
          onCategoryClick={handleCategoryClick}
          variant="desktop"
        />
      </aside>
      {/* Main content */}
      <main className="flex-1 min-w-0">
        <FAQContent categories={categories} searchQuery={searchQuery} onSearchQueryChange={setSearchQuery} />
      </main>
    </div>
  );
}
