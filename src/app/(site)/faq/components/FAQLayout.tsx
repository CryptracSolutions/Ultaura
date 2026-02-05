'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FAQCategory } from '../faq-data';
import { FAQSidebar } from './FAQSidebar';
import { FAQContent } from './FAQContent';

interface FAQLayoutProps {
  categories: FAQCategory[];
}

export function FAQLayout({ categories }: FAQLayoutProps) {
  const [activeId, setActiveId] = useState(categories[0]?.id || '');
  const layoutRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

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
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      window.history.replaceState(null, '', `#${id}`);
      setActiveId(id);
    }
  }, []);

  useEffect(() => {
    const layoutEl = layoutRef.current;
    const sidebarEl = sidebarRef.current;
    const anchorEl = anchorRef.current;
    if (!layoutEl || !sidebarEl || !anchorEl) return;

    let rafId = 0;
    let lastTop = -1;
    let lastLeft = -1;
    let lastWidth = -1;
    let lastState: 'top' | 'fixed' | 'bottom' | null = null;
    const stickyOffset = 112; // 7rem to match top-28

    const update = () => {
      rafId = 0;

      const layoutRect = layoutEl.getBoundingClientRect();
      const anchorRect = anchorEl.getBoundingClientRect();
      const sidebarHeight = sidebarEl.offsetHeight;
      if (!sidebarHeight) return;

      const scrollY = window.scrollY || window.pageYOffset;
      const layoutTop = layoutRect.top + scrollY;
      const layoutBottom = layoutTop + layoutRect.height;
      const desiredTop = scrollY + stickyOffset;

      const isAbove = desiredTop <= layoutTop;
      const isBelow = desiredTop >= layoutBottom - sidebarHeight;
      const nextState: 'top' | 'fixed' | 'bottom' = isAbove
        ? 'top'
        : isBelow
          ? 'bottom'
          : 'fixed';

      if (nextState === 'fixed') {
        const nextLeft = Math.round(anchorRect.left);
        const nextWidth = Math.round(anchorRect.width);

        if (lastState !== 'fixed') {
          sidebarEl.style.position = 'fixed';
          sidebarEl.style.top = `${stickyOffset}px`;
          // Always re-apply left/width when entering fixed to avoid stale 0px values.
          sidebarEl.style.left = `${nextLeft}px`;
          sidebarEl.style.width = `${nextWidth}px`;
          lastLeft = nextLeft;
          lastWidth = nextWidth;
        }

        if (nextLeft !== lastLeft) {
          sidebarEl.style.left = `${nextLeft}px`;
          lastLeft = nextLeft;
        }

        if (nextWidth !== lastWidth) {
          sidebarEl.style.width = `${nextWidth}px`;
          lastWidth = nextWidth;
        }
      } else {
        const relativeTop = isAbove
          ? 0
          : Math.max(0, layoutRect.height - sidebarHeight);

        if (lastState !== nextState) {
          sidebarEl.style.position = 'absolute';
          sidebarEl.style.left = '0px';
          // Reset so the next fixed entry re-applies correct left/width.
          lastLeft = -1;
          lastWidth = -1;
        }

        if (Math.abs(anchorRect.width - lastWidth) > 0.5) {
          sidebarEl.style.width = `${anchorRect.width}px`;
          lastWidth = anchorRect.width;
        }

        if (Math.abs(relativeTop - lastTop) > 0.5) {
          sidebarEl.style.top = `${relativeTop}px`;
          lastTop = relativeTop;
        }
      }

      lastState = nextState;
    };

    const schedule = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(layoutEl);
    resizeObserver.observe(sidebarEl);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={layoutRef}
      className="relative flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-12"
    >
      {/* Mobile sidebar (dropdown) */}
      <div className="lg:hidden">
        <FAQSidebar
          categories={categories}
          activeId={activeId}
          onCategoryClick={handleCategoryClick}
          variant="mobile"
        />
      </div>
      {/* Desktop sidebar spacer */}
      <div
        ref={anchorRef}
        className="hidden lg:block w-64 shrink-0"
        aria-hidden="true"
      />
      {/* Main content */}
      <main className="flex-1 min-w-0">
        <FAQContent categories={categories} />
      </main>

      {/* Desktop sidebar (positioned) */}
      <aside
        ref={sidebarRef}
        className="hidden lg:block w-64 max-h-[calc(100vh-7rem)] overflow-y-auto"
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <FAQSidebar
          categories={categories}
          activeId={activeId}
          onCategoryClick={handleCategoryClick}
          variant="desktop"
        />
      </aside>
    </div>
  );
}
