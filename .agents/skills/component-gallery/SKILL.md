---
name: component-gallery
description: |
  Search and reference UI components, patterns, and design system examples from Component.gallery — a curated repository of 60 components across 95+ production design systems with 2,676+ real-world examples.

  Use this skill when:
  - Building or designing a UI component and want to see how production design systems implement it
  - Looking for component naming conventions, alternative names, or common patterns
  - Comparing how different design systems (Shopify Polaris, Chakra UI, Elastic UI, etc.) approach a component
  - Needing inspiration or reference for component structure, variants, or states
  - User asks to "check Component.gallery", "look up [component] examples", or "find design system references"
---

# Component.gallery Reference Skill

## What This Skill Does

This skill teaches Claude how to search and extract useful information from [Component.gallery](https://component.gallery) — a curated directory of UI components from 95+ real-world design systems. Use it as a research tool when building or improving UI components.

**Component.gallery is a directory, not a code library.** It links to real implementations across design systems (Shopify Polaris, Chakra UI, Radix, etc.) rather than providing code directly. Its value is in showing how production teams name, structure, and implement components.

---

## Site Structure & URL Patterns

| Page | URL | What It Contains |
|------|-----|------------------|
| All components | `https://component.gallery/components` | Full list of 60 component categories |
| Single component | `https://component.gallery/components/{slug}` | Definition, alternative names, 10-80+ examples from real design systems, filterable by tech/features, related resources |
| All design systems | `https://component.gallery/design-systems` | 95+ design systems, filterable by tech stack (React, Vue, Web Components, Tailwind) and features (code examples, accessibility, open source) |

### Component Slugs (Complete List)

accordion, alert, avatar, badge, breadcrumbs, button, button-group, card, carousel, checkbox, color-picker, combobox, date-input, datepicker, drawer, dropdown-menu, empty-state, fieldset, file, file-upload, footer, form, header, heading, hero, icon, image, label, link, list, modal, navigation, pagination, popover, progress-bar, progress-indicator, quote, radio-button, rating, rich-text-editor, search-input, segmented-control, select, separator, skeleton, skip-link, slider, spinner, stack, stepper, table, tabs, text-input, textarea, toast, toggle, tooltip, tree-view, video, visually-hidden

---

## How to Use This Skill

### When the user asks to look up a specific component:

1. **Fetch the component page** using WebFetch:
   ```
   URL: https://component.gallery/components/{slug}
   Prompt: "List all design system examples for this component. For each example, include: the design system name, technology used, and any feature tags (code examples, accessibility, etc.). Also include the component definition, alternative names, and any linked resources."
   ```

2. **Summarize findings** for the user — focus on:
   - What the component is called across different systems (alternative names)
   - Which design systems have the best implementations for our stack (React + Tailwind)
   - Any accessibility guidelines or patterns referenced
   - Links to the most relevant implementations they can explore

### When the user asks to compare implementations:

1. Fetch the component page as above
2. Filter mentally for React-based or Tailwind-based design systems (our stack)
3. Highlight differences in naming, structure, and features across systems

### When the user needs inspiration or isn't sure what component to use:

1. Fetch the full components list: `https://component.gallery/components`
2. Suggest relevant component categories based on the UI problem they're solving
3. Fetch individual component pages for the top candidates

### When looking for design system references:

1. Fetch the design systems page: `https://component.gallery/design-systems`
2. Filter for systems matching our tech stack (React, Tailwind CSS)
3. Recommend systems with code examples and accessibility guidelines

---

## Integration with Ultaura Dashboard UI Work

When building or modifying dashboard components, use Component.gallery to:

- **Validate component naming** — check if our component names align with industry conventions
- **Find missing patterns** — identify components we might need but haven't built yet (e.g., empty-state, skeleton, stepper)
- **Reference accessibility patterns** — filter for design systems with strong accessibility documentation
- **Compare before building** — before creating a new component, check how 3-5 production design systems implement it

**Priority design systems for Ultaura's stack (React + Tailwind):**
When filtering examples, prioritize these systems as most relevant:
- Radix UI (our primitive layer)
- shadcn/ui (our component pattern)
- Chakra UI (React + accessible)
- Shopify Polaris (React, strong accessibility)
- Atlassian Design System (enterprise patterns)
- Gov.uk / US Web Design System (accessibility-first, senior-friendly patterns)

---

## Important Notes

- **Always use WebFetch** to get live data from the site — do not guess or fabricate component information
- **Component.gallery links to external implementations** — when the user needs actual code, follow the links to the specific design system's documentation
- **The site has 60 components** — if a component isn't in the slug list above, it doesn't exist on the site. Suggest the closest match instead.
- **Filter by features** — when accessibility is the priority (common for Ultaura), look for examples tagged with "Accessibility" and "Usage guidelines"
