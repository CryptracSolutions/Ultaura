---
name: ultaura-emails
description: |
  Authoritative reference for creating, editing, and auditing all Ultaura email templates. Enforces consistent branding, layout, accessibility, and content standards across 14 emails.

  Use this skill when:
  - Creating or editing any React Email template in src/lib/emails/
  - Converting inline HTML emails to React Email templates
  - Creating or editing Supabase auth email templates in supabase/templates/
  - Auditing email branding, layout, or accessibility
  - Working on email-related API routes that send emails
  - Building or modifying the shared EmailLayout component
---

# Ultaura Emails

## Non-negotiables (low freedom — these are rigid)

1. **Every email uses `EmailLayout`** — the shared layout at `src/lib/emails/components/email-layout.tsx`. No raw `<Html>/<Head>/<Body>/<Container>` in individual templates.
2. **Every React Email template exports a text fallback** via `render(jsx, { plainText: true })` or a manual `text` return alongside `html`.
3. **All colors come from `brandColors`** (`src/lib/brand-colors.ts`). Never hardcode hex values.
4. **Container max-width is 560px, width is 100%.** Uses `maxWidth: '560px', width: '100%'` for responsive behavior on mobile. Supabase templates keep `width="560"` as an HTML attribute (for Outlook) alongside `style="max-width: 560px; width: 100%;"` in CSS.
5. **Border color is `brandColors.border` (`#E7E5E4`).** Not `#eaeaea`.
6. **Logo is a PNG** (`public/logos/logo-email.png`), displayed at 36x36px with the "Ultaura" wordmark next to it (left-aligned, matching the sidebar navigation). SVGs don't render in most email clients.
7. **No `text-black` Tailwind class.** Use `text-stone-900` (headings) or `text-stone-700` (body).

---

## 1. Brand Reference (Email-Specific)

### Colors

Source of truth: `src/lib/brand-colors.ts` — read that file for all hex values.

Email-specific usage mapping (Claude already knows the hex values from the source file):

| Token | Usage in emails |
|-------|----------------|
| `brandColors.primary` | Button backgrounds, link text color |
| `brandColors.stone[50]` | `<Body>` background |
| `brandColors.stone[100]` | Callout/card section backgrounds |
| `brandColors.border` (= `stone[200]`) | Container border, `<Hr>` elements |
| `brandColors.stone[500]` | Muted text, disclaimers, footer |
| `brandColors.stone[700]` | Body text |
| `brandColors.stone[900]` | Headings |
| `brandColors.white` | Container background, button text |

### Typography

Font stack (set once in `EmailLayout` via the `<Body>` style, not per template):

```
Manrope, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif
```

Manrope is loaded as a progressive enhancement via `@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap')` in the `<Head>`. Clients that support web fonts (Apple Mail, iOS Mail, Thunderbird) render Manrope to match the app. Gmail, Outlook, and others gracefully fall back to the system font stack.

| Element | Size | Weight | Tailwind color class |
|---------|------|--------|---------------------|
| Page heading | 22px | `font-semibold` | `text-stone-900` |
| Section heading | 16px | `font-semibold` | `text-stone-900` |
| Body text | 14px | normal | `text-stone-700` |
| Muted / disclaimer | 12px | normal | `text-stone-500` |
| Buttons | 12px | `font-semibold` | `text-white` + `style={{ backgroundColor: brandColors.primary }}` |

### Logo

- **Source:** `public/logos/logo.svg`
- **Email asset:** `public/logos/logo-email.png` (96x96px PNG for retina, displayed at 36x36)
- **Display:** 36x36px, left-aligned, with "Ultaura" wordmark text beside it (18px, `font-semibold`, `brandColors.primary`)
- **Layout:** Uses a `<table>` with two `<td>` cells — logo on left, wordmark on right, both `vertical-align: middle` with 10px gap
- **Alt text:** `"Ultaura"`
- **URL in templates:** `{baseUrl}/logos/logo-email.png` where `baseUrl` = app's public URL

---

## 2. Canonical Email Layout

**File:** `src/lib/emails/components/email-layout.tsx`

### Interface

```tsx
interface EmailLayoutProps {
  preview: string;
  children: React.ReactNode;
  signOff?: string;         // Default: '- The Ultaura Team'
  footerLinks?: Array<{ label: string; href: string }>;
  aiDisclaimer?: boolean;   // Default: false
  baseUrl?: string;         // Default: process.env.NEXT_PUBLIC_SITE_URL
}
```

### Structure (top to bottom)

The layout wraps everything in `<Html>` / `<Head>` / `<Preview>` / `<Tailwind>` / `<Body>`:

**`<Head>` includes:**
- `<meta name="color-scheme" content="light" />` — hints email clients to prefer light rendering (prevents forced dark mode inversions)
- `<meta name="supported-color-schemes" content="light" />` — Apple Mail specific variant
- `@import` for Manrope font (progressive enhancement)

1. **`<Body>`** — `bg-stone-50`, centered, `style={{ fontFamily: '...' }}`
2. **`<Container>`** — `maxWidth: '560px'`, `width: '100%'`, white bg, `brandColors.border` border, `rounded-lg`, `p-[24px]`, `my-[32px]`
3. **Logo + Wordmark** — Left-aligned table: `<Img>` 36x36 + "Ultaura" text (18px, `font-semibold`, `brandColors.primary`)
4. **`{children}`** — template-specific content
5. **Sign-off** — `text-[14px] text-stone-700 mt-[18px]`, default `"- The Ultaura Team"`
6. **`<Hr>`** — `brandColors.border`, `my-[20px]`
7. **AI disclaimer** (if `aiDisclaimer`) — centered `text-[12px] text-stone-500`
8. **Tagline** — centered `text-[12px] text-stone-500 mt-[8px]`: "Companionship, one call at a time."
9. **Footer links** — centered `text-[12px]`, `brandColors.primary` colored, separated by " | "

**Important:** The `<Tailwind>` wrapper is required inside the layout. All existing templates use it. Without it, Tailwind classes won't compile to inline styles.

### Button Standard

```tsx
<Section className="mt-[20px] text-center">
  <Button
    href={url}
    className="rounded text-white text-[12px] px-[20px] py-[12px] font-semibold no-underline text-center"
    style={{ backgroundColor: brandColors.primary }}
  >
    Descriptive Label
  </Button>
</Section>
```

---

## 3. Email Inventory (14 Emails)

### Category A — React Email Templates (`src/lib/emails/`)

| # | File | Migration Notes |
|---|------|-----------------|
| 1 | `invite.tsx` | MakerKit-inherited. 465px + `#eaeaea` + `text-black` + 24px heading. Full migration needed. |
| 2 | `account-delete.tsx` | MakerKit-inherited. 465px + `#eaeaea` + `text-black` + "Best, The X Team" sign-off. Full migration. |
| 3 | `notification-invite.tsx` | Closest to target (560px, correct border). 20px heading (should be 22px). Wrap with layout. |
| 4 | `weekly-summary.tsx` | Most complex. 600px + teal banner heading. Logo replaces banner. `aiDisclaimer: true`. |
| 5 | `wellness-alert.tsx` | Already 560px, correct patterns. Wrap with layout. Reference template for tone/structure. |
| 6 | `safety-alert.tsx` | 560px. Wrap with layout. No unsubscribe (correct — safety alerts are mandatory). |
| 7 | `missed-calls-alert.tsx` | 560px. Wrap with layout. |

### Category B — Inline HTML Emails (convert to React Email)

| # | Current Location | New File |
|---|-----------------|----------|
| 8 | `src/app/api/telephony/upgrade/route.ts` (~line 163) | `src/lib/emails/plan-upgrade.tsx` |
| 9 | `src/app/api/telephony/alerts/route.ts` (~line 60) | `src/lib/emails/security-alert.tsx` |

### Category C — Supabase Auth Emails (Go HTML templates)

| # | Template | File |
|---|---------|------|
| 10a | Confirmation | `supabase/templates/confirmation.html` |
| 10b | Invite | `supabase/templates/invite.html` |
| 10c | Magic Link | `supabase/templates/magic-link.html` |
| 10d | Email Change | `supabase/templates/email-change.html` |
| 10e | Recovery | `supabase/templates/recovery.html` |

These use Go template variables (`{{ .ConfirmationURL }}`, `{{ .Token }}`, etc.) and must replicate the `EmailLayout` visual structure in static HTML with inline styles. Register them in `supabase/config.toml`:

```toml
[auth.email.template.confirmation]
subject = "Confirm your Ultaura account"
content_path = "./templates/confirmation.html"

[auth.email.template.invite]
subject = "You've been invited to Ultaura"
content_path = "./templates/invite.html"

[auth.email.template.magic_link]
subject = "Your Ultaura sign-in link"
content_path = "./templates/magic-link.html"

[auth.email.template.email_change]
subject = "Confirm your new email address"
content_path = "./templates/email-change.html"

[auth.email.template.recovery]
subject = "Reset your Ultaura password"
content_path = "./templates/recovery.html"
```

---

## 4. Workflows

### Determine type first

**Creating or editing an email?** Start here:
- **New React Email** → "Create" workflow
- **Editing existing React Email** → "Edit" workflow
- **Converting inline HTML** → "Convert" workflow
- **Supabase auth template** → "Supabase" workflow
- **Auditing** → "Audit" workflow

### Create (new React Email)

1. Create `src/lib/emails/{name}.tsx`
2. Define typed props interface
3. Use `EmailLayout` — pass `preview`, `aiDisclaimer`, `footerLinks` as needed
4. Content goes as `children` — no wrapper boilerplate
5. Export: `export default function render{Name}Email(props: Props) { return render(<EmailLayout ...>...</EmailLayout>); }`
6. Add text fallback
7. Wire up: import in the sending route/action
8. Verify (see QA section)

### Edit (existing React Email)

1. Read the template
2. Already uses `EmailLayout`? → Edit content, follow brand reference
3. Does NOT use `EmailLayout`? → Migrate first (see below), then edit

### Migrate (template to EmailLayout)

1. Remove wrappers: `<Html>`, `<Head />`, `<Preview>`, `<Tailwind>`, `<Body>`, `<Container>`
2. Wrap content with `<EmailLayout preview={previewText} ...>`
3. Remove sign-off if it matches default (`"- The Ultaura Team"`)
4. Remove `<Hr>` before footer (layout handles it)
5. Move unsubscribe/settings links to `footerLinks` prop
6. Set `aiDisclaimer={true}` if email contains AI-generated insights
7. Fix violations: `#eaeaea` → gone (layout), `text-black` → `text-stone-700`/`900`, wrong width → gone (layout)
8. Add text fallback if missing

**Example — before (wellness-alert.tsx, abbreviated):**

```tsx
export default function renderWellnessAlertEmail(props: WellnessAlertEmailProps) {
  return render(
    <Html>
      <Head />
      <Preview>{`Wellness alert for ${props.lineName}`}</Preview>
      <Tailwind>
        <Body className="bg-stone-50 my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#e7e5e4] rounded-lg my-[32px] mx-auto p-[24px] w-[560px] bg-white">
            <Text className="text-[14px] text-stone-700 m-0">Hi,</Text>
            {/* ... content ... */}
            <Text className="text-[14px] text-stone-700 mt-[18px] mb-0">- The Ultaura Team</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>,
  );
}
```

**After migration:**

```tsx
export default function renderWellnessAlertEmail(props: WellnessAlertEmailProps) {
  return render(
    <EmailLayout
      preview={`Wellness alert for ${props.lineName}`}
      footerLinks={props.unsubscribeLink ? [
        { label: 'Alert Settings', href: props.settingsUrl },
        { label: 'Unsubscribe', href: props.unsubscribeLink },
      ] : [
        { label: 'Alert Settings', href: props.settingsUrl },
      ]}
    >
      <Text className="text-[14px] text-stone-700 m-0">Hi,</Text>
      {/* ... same content, no wrappers, no sign-off, no Hr ... */}
    </EmailLayout>,
  );
}
```

### Convert (inline HTML to React Email)

1. Create `src/lib/emails/{name}.tsx`
2. Extract all interpolated values as typed props
3. Build template using `EmailLayout` + content from the inline HTML
4. Export render function (same pattern as other templates)
5. In the API route: `import renderXxxEmail from '~/lib/emails/xxx';` and replace inline `html` with the render call
6. Add text fallback
7. Delete the old inline HTML string from the route

### Supabase (auth email templates)

1. Create `supabase/templates/{name}.html`
2. Use static HTML that visually matches `EmailLayout`: 560px table layout, same border/padding/colors, inline `font-family` style
3. Required `<html>` attributes: `xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"` (for VML button support)
4. Required `<head>` elements:
   - `<meta name="color-scheme" content="light" />` and `<meta name="supported-color-schemes" content="light" />`
   - `<style>@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');</style>`
   - `<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]-->`
5. Add a hidden preview/preheader `<div>` immediately after `<body>`: `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">Preview text</div>`
6. Inner table: keep `width="560"` attribute (Outlook) + add `style="max-width: 560px; width: 100%;"` (responsive)
7. Buttons use VML for Outlook: wrap the `<a>` with `<!--[if mso]><v:roundrect ...><![endif]-->` and `<!--[if !mso]><!-->...<a>...<!--<![endif]-->` (see existing templates for exact pattern)
8. Use Go template variables for dynamic content (`{{ .ConfirmationURL }}`, `{{ .SiteURL }}`)
9. Add the `[auth.email.template.{name}]` block to `supabase/config.toml` (see section 3 for exact syntax)
10. Test locally: auth actions send emails to Inbucket at `http://localhost:54324`

### Audit

Run through every item in the QA checklist (section 6) for each email in the inventory. Group findings by severity:
- **Must fix:** Brand violations, missing text fallbacks, broken layout
- **Should fix:** Inconsistent spacing, non-standard sign-off
- **Nice to have:** Minor copy improvements

---

## 5. Content Guidelines (medium freedom — adapt to context)

### Audience

- **Primary:** Family caregivers (payers) — adult children managing a parent's line
- **Secondary:** Seniors (line users) — auth emails, self-summaries
- **Tertiary:** Trusted contacts — non-account-holders receiving alerts/summaries

### Tone

- Warm but direct. Not clinical, not saccharine.
- Reassuring for alerts — give context and actionable next steps.
- No jargon ("check-in call" not "voice session," "weekly summary" not "engagement report").
- Short sentences. Recipients scan.

### Privacy (low freedom — these are rigid)

- Never include call transcripts
- Never include specific health details — use "a wellness concern was detected"
- Respect sharing tiers — weekly summary handles this via `effectiveTier`; other emails must not leak tier-restricted info
- Honor topic exclusions

### Accessibility

- All `<Img>` have descriptive `alt` text
- Buttons use descriptive labels ("View Dashboard" not "Click here")
- Link text is descriptive (not bare URLs)
- Contrast: `stone-700` on white = ~8.5:1 (body), `stone-500` on white = ~4.6:1 (muted) — do not go lighter than `stone-500`

---

## 6. QA Checklist

Before marking any email work as done, verify every applicable item:

1. [ ] Uses `EmailLayout` (or static HTML equivalent for Supabase)
2. [ ] Logo displays at 36x36px with wordmark text beside it, left-aligned, `alt="Ultaura"`
3. [ ] No hardcoded hex values — all colors via `brandColors`
4. [ ] No `text-black` class
5. [ ] Heading sizes: 22px (page), 16px (section)
6. [ ] Button uses standard style (12px, primary bg, rounded, 20px/12px padding)
7. [ ] Links use `brandColors.primary` color
8. [ ] Sign-off present (default `"- The Ultaura Team"` or justified custom)
9. [ ] Text fallback exported/returned
10. [ ] `aiDisclaimer` set for AI-generated content emails
11. [ ] `<Tailwind>` wrapper present (inside layout, wrapping `<Body>`)
12. [ ] Container uses responsive width (`maxWidth: '560px', width: '100%'`)
13. [ ] Dark mode meta tags present (`color-scheme` and `supported-color-schemes`)
14. [ ] Supabase templates: hidden preheader `<div>` present after `<body>`
15. [ ] Supabase templates: VML button conditionals for Outlook (`<!--[if mso]>...<![endif]-->`)
16. [ ] TypeScript compiles (`pnpm tsc --noEmit`)
17. [ ] Visual check in Inbucket if local dev available (`http://localhost:54324`)
18. [ ] Render previews with `npx tsx scripts/test-emails.tsx` and verify at `file:///tmp/ultaura-emails/index.html`

### Common Mistakes

| Mistake | Fix |
|---------|-----|
| `#eaeaea` border | `brandColors.border` (`#E7E5E4`) — layout handles it |
| `text-black` | `text-stone-700` (body) or `text-stone-900` (headings) |
| 465px or 600px container | 560px — layout handles it |
| SVG logo in email | PNG only (`logo-email.png`) |
| No text fallback | Export both `html` and `text` from render |
| Hardcoded color hex | Import `brandColors` from `~/lib/brand-colors` |
| "Best, The X Team" sign-off | Default: `"- The Ultaura Team"` |
| Raw `<Html>/<Body>/<Container>` with `EmailLayout` | Layout handles all wrappers |
| Unsubscribe link in body content | Pass to `footerLinks` prop |
| Missing `<Preview>` text | Always set — it shows in inbox list views |
| Missing `<Tailwind>` wrapper | Required for Tailwind classes to compile to inline styles |
| Fixed `width: 560px` on container | Use `maxWidth: '560px', width: '100%'` for mobile responsiveness |
| No dark mode meta tags | Add `<meta name="color-scheme" content="light" />` in `<Head>` |
| Supabase template missing preheader | Add hidden `<div>` after `<body>` with preview text |
| Supabase button without VML | Wrap `<a>` with MSO conditionals for Outlook rendering |
