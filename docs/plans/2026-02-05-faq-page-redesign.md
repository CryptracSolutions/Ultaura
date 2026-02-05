# FAQ Page Redesign

**Date:** 2026-02-05
**Status:** Approved

## Overview

Redesign the FAQ page with a two-column layout featuring sticky sidebar navigation, real-time search filtering, and expanded content (37 items across 8 categories).

## Data Model

**File:** `src/app/(site)/faq/faq-data.ts`

```typescript
interface FAQItem {
  id: string;        // Unique within category
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;        // Slug for anchors
  title: string;
  description?: string;
  items: FAQItem[];
}

export const FAQ_DATA: FAQCategory[];
```

**Categories (8):**
1. General (5 items)
2. Getting Started (4 items)
3. Calls & Scheduling (5 items)
4. Features & Capabilities (5 items)
5. Safety & Privacy (5 items)
6. Family & Trusted Contacts (4 items)
7. Billing & Plans (5 items)
8. Troubleshooting (4 items)

## Component Structure

```
src/app/(site)/faq/
├── page.tsx              # Main page (hero + FAQLayout)
├── faq-data.ts           # FAQ content
└── components/
    ├── FAQLayout.tsx     # Two-column grid wrapper
    ├── FAQSidebar.tsx    # Sticky sidebar + mobile dropdown
    ├── FAQSearch.tsx     # Search input with filtering
    ├── FAQContent.tsx    # Main content area
    └── FAQSection.tsx    # Single category accordion
```

## Layout

**Desktop:** `grid grid-cols-[260px_1fr] gap-12`
- Sidebar: sticky at `top-24`
- Content: search bar + stacked category sections

**Mobile:** Single column
- Dropdown category selector (replaces sidebar)
- Search bar
- Stacked sections

## Sidebar Navigation

**Desktop:**
- Vertical list of category links
- Click → smooth scroll to section + update URL hash
- Scroll spy via IntersectionObserver updates active state
- Active: `bg-primary/10 border-l-2 border-primary text-primary`

**Mobile:**
- Dropdown selector above search
- Shows current category name
- On change → scroll to section

## Search

- Full-width input with search icon + clear button
- Filters questions AND answers (case-insensitive)
- Shows "X results in Y categories" when filtering
- "No results" state with clear action
- Debounced 150ms

## Accordion

- Uses existing `~/core/ui/Accordion` component
- Single open per category (collapsible)
- Chevron rotates on expand
- Accessible: button triggers, aria attributes

## Styling

- Hero: unchanged
- Section headings: `text-xl font-semibold`
- Sidebar links: `text-muted-foreground` → active: `text-primary bg-primary/10`
- Cards: existing `border rounded-xl bg-card` pattern
- Answers: `text-muted-foreground leading-relaxed`

## Implementation Tasks

1. Create `faq-data.ts` with expanded content (37 items)
2. Create `FAQSection.tsx` component
3. Create `FAQSearch.tsx` component
4. Create `FAQSidebar.tsx` component (desktop + mobile)
5. Create `FAQContent.tsx` component
6. Create `FAQLayout.tsx` wrapper
7. Update `page.tsx` to use new components
8. Test scroll spy, search, responsive behavior
9. Verify TypeScript compiles, no console errors
