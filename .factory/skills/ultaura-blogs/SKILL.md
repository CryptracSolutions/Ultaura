---
name: ultaura-blogs
description: Create, update, and QA Ultaura public blog posts that use the exact existing canonical blog UI/layout. Use when adding any new file under `src/content/posts/*.mdx`, updating post frontmatter/SEO, generating the required cover photo, or ensuring the post appears on `/blog` without changing layout components.
---

# Ultaura Blogs (Canonical Layout)

## Non-negotiables (do these, always)

1) **Do not invent a new blog layout.** Treat the existing placeholder post as the canonical template:
   - Content: `src/content/posts/post-01.mdx`
   - Post page route: `src/app/(site)/blog/[slug]/page.tsx` (wraps `Post` + injects JSON-LD)
   - Canonical layout component: `src/app/(site)/blog/components/Post.tsx` (uses `PostHeader` + `MDXRenderer`)
   - Header structure: `src/app/(site)/blog/components/PostHeader.tsx` (title/description/meta + cover photo location)

2) **Every new Ultaura post must use a cover photo** that matches the placeholder’s **format, size, and quality**, and is Ultaura-specific to the topic.

## How the blog works (current implementation)

### Listing page (`/blog`)

- Route: `src/app/(site)/blog/page.tsx`
- Source: `posts` comes from Velite output (`@/.velite`) configured in `velite.config.ts`.
- Filtering behavior (important):
  - In **non-production**: only posts with `live: true` are shown.
  - In **production**: the current code shows **all** posts regardless of `live`.

### Post page (`/blog/[slug]`)

- Route: `src/app/(site)/blog/[slug]/page.tsx`
- Uses:
  - `generateMetadata()` to set OG/Twitter metadata from the post fields.
  - JSON-LD: injects `post.structuredData` into a `<Script type="application/ld+json">`.
  - Canonical UI: `Container` → JSON-LD `<Script>` → `<Post post={post} content={post.body} />`.

### Canonical layout (the “template” you must reuse)

The canonical layout is code-driven, not MDX-driven:

- `Post.tsx` renders:
  - outer wrapper: `mx-auto max-w-2xl my-8`
  - `PostHeader` (title/description/date/reading time + cover photo)
  - `<article className="mx-auto flex justify-center">` with `MDXRenderer` as the body renderer
- `PostHeader.tsx` renders cover photo in a fixed location/size (do not change this):
  - cover wrapper uses `relative mx-auto h-[378px] w-full`
  - `CoverImage` is rendered when `image` exists

## Add a new Ultaura blog post (step-by-step)

### 1) Clone the placeholder post file

1. Copy `src/content/posts/post-01.mdx` to a new filename in the same folder.
   - The filename becomes the URL slug (e.g., `my-post.mdx` → `/blog/my-post`).
2. Keep the same frontmatter keys and types:
   - `title` (string)
   - `date` (YYYY-MM-DD; must be parseable ISO date)
   - `live` (boolean)
   - `description` (string; required for good SEO + header)
   - `image` (string; required for canonical UI/UX)

### 2) Write MDX content that fits the canonical rendering

- Use normal Markdown/MDX content (headings, lists, blockquotes, links, code blocks).
- Prefer simple structure like the placeholder (no custom wrappers, no new page templates).
- Avoid importing or defining custom React components inside the MDX unless you are reusing existing `MDXRenderer` components (see `src/core/ui/MDXRenderer/MDXComponents.tsx`).

### 3) Generate the required cover photo (Ultaura-specific)

You must use photo generation for the cover image for the post you are creating.

**Hard requirements (match the placeholder image):**
- **Format:** `.webp`
- **Pixel size:** `3276x2170` (same as `public/assets/images/posts/lorem-ipsum.webp`)
- **Quality:** photo-realistic, crisp at large size (not an icon/illustration)
- **Placement:** save under `public/assets/images/posts/`
- **Frontmatter:** set `image` to `/assets/images/posts/<your-file>.webp`

**Content requirements (Ultaura-specific, tied to the post topic):**
- The image must clearly relate to the post’s subject and Ultaura’s mission (seniors, caregivers, companionship, scheduled check-in calls).
- Keep it warm and dignified; avoid medical alarmism, stereotypes, and “sad elderly” tropes.
- Do not include identifiable real people, real phone numbers, or any private info.
- Do not include brand logos unless provided by the repo assets.

**Practical workflow:**
1. Decide the scene based on the post outline (1 sentence).
2. Generate a **photo-realistic** image at or above the required resolution, then export/crop to exactly `3276x2170` and convert to `.webp`.
3. Name it to match the post slug (recommended): `public/assets/images/posts/<slug>.webp`.
4. Set the MDX frontmatter `image: /assets/images/posts/<slug>.webp`.

If you cannot generate an image that meets the size/quality requirement, stop and ask the user for either (a) an approved image asset or (b) permission to adjust the requirement.

### 4) Set `live` so it shows up on `/blog`

- To verify locally in dev: set `live: true` (otherwise it won’t show on `/blog` in non-production).
- If you are intentionally keeping it hidden during drafting: `live: false`, but be aware the current production filter does **not** hide it.

## SEO + metadata consistency (must not regress)

Velite schema + transforms live in `velite.config.ts`.

### Required frontmatter (recommended “required” for Ultaura posts)

- `title`: used for page title and JSON-LD headline.
- `description`: used for:
  - page description
  - `PostHeader` subheading
  - OG/Twitter description
  - JSON-LD `description`
- `date`: used for:
  - OG `publishedTime`
  - on-page date display
  - JSON-LD `datePublished` / `dateModified`
- `image`: used for:
  - cover photo in the canonical header
  - OG/Twitter images
  - JSON-LD image URL

## Editorial + compliance (Ultaura-specific)

- Write for seniors and family caregivers:
  - short paragraphs (1–3 sentences)
  - clear H2/H3 headings
  - minimal jargon; define unavoidable terms
- Avoid medical/legal claims. If discussing health or safety, include a brief disclaimer that it’s not medical advice and encourage consulting professionals.
- Privacy/safety: never include personal data, call recordings, or customer stories without explicit consent.
- Author voice: write as **“Ultaura Team”** (no personal bylines; no “I did X”).

## Post QA checklist (run before you say “done”)

- File exists at `src/content/posts/<slug>.mdx` and Velite builds without schema errors.
- Frontmatter contains: `title`, `date`, `live`, `description`, `image`.
- Cover photo exists at `public/assets/images/posts/<slug>.webp` and is **exactly** `3276x2170`.
- `/blog` shows the post card (in dev, confirm `live: true`).
- `/blog/<slug>` renders with:
  - Title + description + date + reading time
  - Cover photo in the same header location/size as the placeholder
  - Body renders through `MDXRenderer` with expected typography
- Metadata looks sane (no missing OG/Twitter image/description), JSON-LD script is present.