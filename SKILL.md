---
name: Ultaura Design System
description: Apply Ultaura brand guidelines to all UI components, pages, and styling. Use when creating React components, Tailwind classes, layouts, or any visual elements. Ultaura uses Tiffany Blue primary with warm Stone neutrals, OKLCH color format, and Tailwind v4 compatible theming. Designed for a voice companion service targeting caregivers and seniors.
---

# Ultaura Design System

Ultaura's design system combines Tiffany Blue (`#0ABAB5`) as the primary accent with warm Stone neutrals. Built for shadcn/ui with Tailwind CSS v4 using OKLCH color format. The design prioritizes accessibility, warmth, and clarity — essential for a service used by caregivers managing care for elderly loved ones.

## Design Philosophy

- **Warm and trustworthy:** Interfaces that feel caring and reliable, not clinical or cold
- **Accessible first:** Large touch targets, clear contrast, readable typography
- **Calm confidence:** Soft shadows, generous whitespace, no overwhelming visuals
- **Status clarity:** Clear visual distinction between active, pending, and alert states
- **Purposeful color:** Tiffany Blue for primary actions; semantic colors for call/line status

---

## Color System

### Brand Colors

| Name | Hex | OKLCH | Usage |
|------|-----|-------|-------|
| **Tiffany Blue** | `#0ABAB5` | `oklch(0.696 0.119 180.426)` | Primary actions, active states, links |
| **Tiffany Blue Light** | `#5DD3CF` | `oklch(0.785 0.098 180.426)` | Hover states, highlights |
| **Tiffany Blue Dark** | `#088A86` | `oklch(0.55 0.1 180.426)` | Active/pressed states |

### Semantic Status Colors

| Status | Light Mode Hex | Light Mode OKLCH | Ultaura Usage |
|--------|---------------|------------------|---------------|
| **Success** | `#10B981` | `oklch(0.696 0.17 162.48)` | Call completed, line active, verified |
| **Warning** | `#F59E0B` | `oklch(0.828 0.189 84.429)` | Trial expiring, minutes low, pending verification |
| **Info** | `#3B82F6` | `oklch(0.623 0.214 259.815)` | Scheduled calls, informational notices |
| **Destructive** | `#EF4444` | `oklch(0.577 0.245 27.325)` | Errors, opt-out, call failed, minutes exhausted |

### Ultaura-Specific Status Mapping

| State | Color | Example |
|-------|-------|---------|
| Line active & verified | `success` | Green badge on line card |
| Line pending verification | `warning` | Yellow badge, "Verify now" CTA |
| Line opted out / disabled | `destructive` | Red badge, muted card |
| Call in progress | `primary` | Tiffany Blue pulsing indicator |
| Call scheduled | `info` | Blue calendar icon |
| Call completed | `success` | Green checkmark |
| Call missed / failed | `destructive` | Red alert |
| Trial minutes low (≤5) | `warning` | Yellow warning banner |
| Minutes exhausted | `destructive` | Red banner, upgrade CTA |

---

## CSS Variables (Tailwind v4 + shadcn/ui)

Copy this entire block into your `app/globals.css`:

```css
@import "tailwindcss";

:root {
  /* Base */
  --radius: 0.625rem;
  
  /* Background & Foreground - Stone base with warm undertones */
  --background: oklch(0.995 0.001 106.423);
  --foreground: oklch(0.147 0.004 49.25);
  
  /* Card */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.147 0.004 49.25);
  
  /* Popover */
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.147 0.004 49.25);
  
  /* Primary - Tiffany Blue */
  --primary: oklch(0.696 0.119 180.426);
  --primary-foreground: oklch(1 0 0);
  
  /* Secondary - Stone */
  --secondary: oklch(0.97 0.001 106.424);
  --secondary-foreground: oklch(0.216 0.006 56.043);
  
  /* Muted */
  --muted: oklch(0.97 0.001 106.424);
  --muted-foreground: oklch(0.553 0.013 58.071);
  
  /* Accent - Uses primary (Tiffany Blue) */
  --accent: oklch(0.696 0.119 180.426);
  --accent-foreground: oklch(1 0 0);
  
  /* Destructive */
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(1 0 0);
  
  /* Border, Input, Ring */
  --border: oklch(0.923 0.003 48.717);
  --input: oklch(0.923 0.003 48.717);
  --ring: oklch(0.696 0.119 180.426);
  
  /* Chart Colors */
  --chart-1: oklch(0.696 0.119 180.426);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.623 0.214 259.815);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  
  /* Sidebar */
  --sidebar: oklch(0.985 0.001 106.423);
  --sidebar-foreground: oklch(0.147 0.004 49.25);
  --sidebar-primary: oklch(0.696 0.119 180.426);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.97 0.001 106.424);
  --sidebar-accent-foreground: oklch(0.216 0.006 56.043);
  --sidebar-border: oklch(0.923 0.003 48.717);
  --sidebar-ring: oklch(0.696 0.119 180.426);
  
  /* Ultaura Semantic Colors */
  --success: oklch(0.696 0.17 162.48);
  --success-foreground: oklch(1 0 0);
  --warning: oklch(0.828 0.189 84.429);
  --warning-foreground: oklch(0.216 0.006 56.043);
  --info: oklch(0.623 0.214 259.815);
  --info-foreground: oklch(1 0 0);
}

.dark {
  /* Background & Foreground */
  --background: oklch(0.147 0.004 49.25);
  --foreground: oklch(0.985 0.001 106.423);
  
  /* Card */
  --card: oklch(0.216 0.006 56.043);
  --card-foreground: oklch(0.985 0.001 106.423);
  
  /* Popover */
  --popover: oklch(0.216 0.006 56.043);
  --popover-foreground: oklch(0.985 0.001 106.423);
  
  /* Primary - Tiffany Blue (brighter for dark mode) */
  --primary: oklch(0.75 0.12 180.426);
  --primary-foreground: oklch(0.147 0.004 49.25);
  
  /* Secondary */
  --secondary: oklch(0.268 0.007 34.298);
  --secondary-foreground: oklch(0.985 0.001 106.423);
  
  /* Muted */
  --muted: oklch(0.268 0.007 34.298);
  --muted-foreground: oklch(0.709 0.01 56.259);
  
  /* Accent */
  --accent: oklch(0.75 0.12 180.426);
  --accent-foreground: oklch(0.147 0.004 49.25);
  
  /* Destructive */
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(1 0 0);
  
  /* Border, Input, Ring */
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.75 0.12 180.426);
  
  /* Chart Colors */
  --chart-1: oklch(0.75 0.12 180.426);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.623 0.214 259.815);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  
  /* Sidebar */
  --sidebar: oklch(0.216 0.006 56.043);
  --sidebar-foreground: oklch(0.985 0.001 106.423);
  --sidebar-primary: oklch(0.75 0.12 180.426);
  --sidebar-primary-foreground: oklch(0.147 0.004 49.25);
  --sidebar-accent: oklch(0.268 0.007 34.298);
  --sidebar-accent-foreground: oklch(0.985 0.001 106.423);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.75 0.12 180.426);
  
  /* Ultaura Semantic Colors - Dark Mode */
  --success: oklch(0.696 0.17 162.48);
  --success-foreground: oklch(1 0 0);
  --warning: oklch(0.75 0.16 84.429);
  --warning-foreground: oklch(0.147 0.004 49.25);
  --info: oklch(0.623 0.214 259.815);
  --info-foreground: oklch(1 0 0);
}

/* Tailwind v4 Theme Registration */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

---

## Typography

### Font Stack

```css
--font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
```

### Type Scale

| Element | Size | Weight | Line Height | Class |
|---------|------|--------|-------------|-------|
| H1 | 30px / 1.875rem | 600 (semibold) | 1.2 | `text-3xl font-semibold` |
| H2 | 24px / 1.5rem | 600 (semibold) | 1.25 | `text-2xl font-semibold` |
| H3 | 20px / 1.25rem | 600 (semibold) | 1.3 | `text-xl font-semibold` |
| H4 | 16px / 1rem | 600 (semibold) | 1.4 | `text-base font-semibold` |
| Body | 14px / 0.875rem | 400 (normal) | 1.5 | `text-sm` |
| Body Large | 16px / 1rem | 400 (normal) | 1.5 | `text-base` |
| Caption | 12px / 0.75rem | 400 (normal) | 1.4 | `text-xs` |
| Label | 14px / 0.875rem | 500 (medium) | 1.4 | `text-sm font-medium` |

---

## Ultaura Component Patterns

### Line Card

The primary component for displaying a phone line in the dashboard.

```jsx
// Line Card - Active State
<div className="bg-card rounded-xl border border-border p-6 shadow-sm hover:shadow-md transition-all">
  <div className="flex items-start justify-between">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <PhoneIcon className="w-6 h-6 text-primary" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Carmen</h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
            Active
          </span>
        </div>
        <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
      </div>
    </div>
    <Button variant="ghost" size="icon">
      <MoreVerticalIcon className="w-5 h-5" />
    </Button>
  </div>
  
  <div className="mt-4 pt-4 border-t border-border">
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="text-muted-foreground">Last call</p>
        <p className="font-medium text-foreground">Yesterday, 7:12 PM</p>
      </div>
      <div>
        <p className="text-muted-foreground">Next scheduled</p>
        <p className="font-medium text-foreground">Tomorrow, 6:00 PM</p>
      </div>
    </div>
  </div>
</div>

// Line Card - Pending Verification
<div className="bg-card rounded-xl border border-warning/50 p-6 shadow-sm">
  <div className="flex items-start justify-between">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
        <PhoneIcon className="w-6 h-6 text-warning" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Mom</h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
            Pending
          </span>
        </div>
        <p className="text-sm text-muted-foreground">+1 (555) 987-6543</p>
      </div>
    </div>
  </div>
  
  <div className="mt-4">
    <Button className="w-full" variant="outline">
      <ShieldCheckIcon className="w-4 h-4 mr-2" />
      Verify Phone Number
    </Button>
  </div>
</div>
```

### Usage Stats Card

```jsx
<div className="bg-card rounded-xl border border-border p-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-semibold text-foreground">Minutes This Month</h3>
    <span className="text-sm text-muted-foreground">Care Plan</span>
  </div>
  
  {/* Progress bar */}
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-foreground font-medium">182 used</span>
      <span className="text-muted-foreground">300 included</span>
    </div>
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div 
        className="h-full bg-primary rounded-full transition-all"
        style={{ width: '60.6%' }}
      />
    </div>
    <p className="text-sm text-muted-foreground">
      118 minutes remaining • Resets Jan 15
    </p>
  </div>
</div>

// Warning state (low minutes)
<div className="bg-card rounded-xl border border-warning/50 p-6">
  <div className="flex items-center gap-2 mb-4">
    <AlertTriangleIcon className="w-5 h-5 text-warning" />
    <h3 className="font-semibold text-foreground">Minutes Running Low</h3>
  </div>
  
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-foreground font-medium">285 used</span>
      <span className="text-muted-foreground">300 included</span>
    </div>
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div 
        className="h-full bg-warning rounded-full"
        style={{ width: '95%' }}
      />
    </div>
    <p className="text-sm text-warning">
      Only 15 minutes remaining
    </p>
  </div>
  
  <Button className="w-full mt-4" variant="default">
    Upgrade Plan
  </Button>
</div>
```

### Schedule Card

```jsx
<div className="bg-card rounded-xl border border-border p-6">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center">
        <CalendarIcon className="w-5 h-5 text-info" />
      </div>
      <div>
        <h3 className="font-semibold text-foreground">Weekly Check-ins</h3>
        <p className="text-sm text-muted-foreground">Carmen's schedule</p>
      </div>
    </div>
    <Switch checked={true} />
  </div>
  
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-sm">
      <ClockIcon className="w-4 h-4 text-muted-foreground" />
      <span className="text-foreground">6:00 PM (Pacific)</span>
    </div>
    <div className="flex flex-wrap gap-2">
      {['Mon', 'Wed', 'Fri'].map(day => (
        <span key={day} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
          {day}
        </span>
      ))}
    </div>
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <BellIcon className="w-4 h-4" />
      <span>Quiet hours: 9 PM – 9 AM</span>
    </div>
  </div>
</div>
```

### Call Activity Item

```jsx
// Completed call
<div className="flex items-center gap-4 py-3">
  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
    <PhoneIncomingIcon className="w-5 h-5 text-success" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="font-medium text-foreground">Inbound call</p>
    <p className="text-sm text-muted-foreground truncate">12 minutes • Yesterday 7:12 PM</p>
  </div>
  <CheckCircleIcon className="w-5 h-5 text-success flex-shrink-0" />
</div>

// Missed call
<div className="flex items-center gap-4 py-3">
  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
    <PhoneMissedIcon className="w-5 h-5 text-destructive" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="font-medium text-foreground">Scheduled call</p>
    <p className="text-sm text-muted-foreground truncate">No answer • Monday 6:00 PM</p>
  </div>
  <span className="text-xs text-muted-foreground flex-shrink-0">Retried</span>
</div>

// Upcoming scheduled
<div className="flex items-center gap-4 py-3">
  <div className="w-10 h-10 rounded-full bg-info/10 flex items-center justify-center flex-shrink-0">
    <PhoneOutgoingIcon className="w-5 h-5 text-info" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="font-medium text-foreground">Scheduled call</p>
    <p className="text-sm text-muted-foreground truncate">Tomorrow 6:00 PM</p>
  </div>
  <Button variant="ghost" size="sm">
    Edit
  </Button>
</div>
```

### Plan Selection Card

```jsx
// Standard plan card
<div className="bg-card rounded-xl border border-border p-6 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer">
  <div className="mb-4">
    <h3 className="text-xl font-semibold text-foreground">Care</h3>
    <p className="text-muted-foreground">For one loved one</p>
  </div>
  
  <div className="mb-4">
    <span className="text-3xl font-bold text-foreground">$40</span>
    <span className="text-muted-foreground">/month</span>
  </div>
  
  <ul className="space-y-2 mb-6">
    <li className="flex items-center gap-2 text-sm">
      <CheckIcon className="w-4 h-4 text-success" />
      <span>300 minutes/month</span>
    </li>
    <li className="flex items-center gap-2 text-sm">
      <CheckIcon className="w-4 h-4 text-success" />
      <span>1 phone line</span>
    </li>
    <li className="flex items-center gap-2 text-sm">
      <CheckIcon className="w-4 h-4 text-success" />
      <span>Scheduled calls</span>
    </li>
  </ul>
  
  <Button className="w-full">Choose Plan</Button>
</div>

// Selected/current plan
<div className="bg-card rounded-xl border-2 border-primary p-6 relative">
  <div className="absolute -top-3 left-4 px-2 py-0.5 bg-primary text-primary-foreground text-xs font-medium rounded-full">
    Current Plan
  </div>
  {/* ... same content ... */}
</div>
```

### Alert Banners

```jsx
// Trial warning
<div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start gap-3">
  <AlertTriangleIcon className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
  <div className="flex-1">
    <p className="font-medium text-foreground">Trial ending soon</p>
    <p className="text-sm text-muted-foreground mt-1">
      You have 5 minutes remaining. Upgrade to keep talking.
    </p>
  </div>
  <Button size="sm" variant="default">Upgrade</Button>
</div>

// Success message
<div className="bg-success/10 border border-success/20 rounded-lg p-4 flex items-center gap-3">
  <CheckCircleIcon className="w-5 h-5 text-success flex-shrink-0" />
  <p className="text-foreground">Phone number verified successfully!</p>
</div>

// Error message
<div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3">
  <XCircleIcon className="w-5 h-5 text-destructive flex-shrink-0" />
  <div className="flex-1">
    <p className="font-medium text-foreground">Verification failed</p>
    <p className="text-sm text-muted-foreground">The code you entered is incorrect. Please try again.</p>
  </div>
</div>

// Info notice
<div className="bg-info/10 border border-info/20 rounded-lg p-4 flex items-start gap-3">
  <InfoIcon className="w-5 h-5 text-info flex-shrink-0 mt-0.5" />
  <div>
    <p className="font-medium text-foreground">Privacy note</p>
    <p className="text-sm text-muted-foreground mt-1">
      Conversation transcripts are never stored. Only basic call information (time, duration) is visible here.
    </p>
  </div>
</div>
```

### Phone Verification Flow

```jsx
<div className="max-w-md mx-auto">
  <div className="text-center mb-8">
    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
      <ShieldCheckIcon className="w-8 h-8 text-primary" />
    </div>
    <h2 className="text-2xl font-semibold text-foreground">Verify phone number</h2>
    <p className="text-muted-foreground mt-2">
      We'll send a code to +1 (555) 123-4567
    </p>
  </div>
  
  <div className="space-y-4">
    <div className="flex gap-3">
      <Button variant="outline" className="flex-1">
        <MessageSquareIcon className="w-4 h-4 mr-2" />
        Text me
      </Button>
      <Button variant="outline" className="flex-1">
        <PhoneIcon className="w-4 h-4 mr-2" />
        Call me
      </Button>
    </div>
    
    <p className="text-xs text-center text-muted-foreground">
      For landlines, choose "Call me" to receive a voice code.
    </p>
  </div>
</div>

// Code entry step
<div className="max-w-md mx-auto">
  <div className="text-center mb-8">
    <h2 className="text-2xl font-semibold text-foreground">Enter verification code</h2>
    <p className="text-muted-foreground mt-2">
      We sent a 6-digit code to +1 (555) 123-4567
    </p>
  </div>
  
  <div className="flex justify-center gap-2 mb-6">
    {[...Array(6)].map((_, i) => (
      <input
        key={i}
        type="text"
        maxLength={1}
        className="w-12 h-14 text-center text-xl font-semibold border border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-ring"
      />
    ))}
  </div>
  
  <Button className="w-full" size="lg">Verify</Button>
  
  <p className="text-center text-sm text-muted-foreground mt-4">
    Didn't receive a code? <button className="text-primary hover:underline">Resend</button>
  </p>
</div>
```

---

## Spacing System

Use Tailwind's default spacing scale consistently:

| Token | Value | Usage |
|-------|-------|-------|
| `p-2` / `m-2` | 8px | Tight spacing, inline elements |
| `p-3` / `m-3` | 12px | Form inputs, small cards |
| `p-4` / `m-4` | 16px | Standard padding, card padding |
| `p-6` / `m-6` | 24px | Section padding, generous cards |
| `p-8` / `m-8` | 32px | Large section padding |
| `gap-2` | 8px | Tight gaps in flex/grid |
| `gap-4` | 16px | Standard gaps |
| `gap-6` | 24px | Section gaps |

### Spacing Guidelines

- Cards: Use `p-6` for standard cards, `p-4` for compact cards
- Sections: Use `py-8` or `py-12` between major sections
- Form fields: Use `space-y-4` for stacked form fields
- Button groups: Use `gap-2` or `gap-3` between buttons
- List items: Use `space-y-2` for tight lists, `space-y-4` for cards
- Dashboard grid: Use `gap-6` between cards

---

## Border Radius

| Token | Value | Tailwind Class | Usage |
|-------|-------|----------------|-------|
| `--radius-sm` | ~6px | `rounded-sm` | Small elements |
| `--radius-md` | ~8px | `rounded-md` | Buttons, inputs |
| `--radius-lg` | 10px | `rounded-lg` | Cards, standard components |
| `--radius-xl` | 14px | `rounded-xl` | Large cards, modals |
| - | 9999px | `rounded-full` | Avatars, status badges |

### Radius Guidelines

- Buttons: `rounded-lg`
- Inputs: `rounded-lg`
- Cards: `rounded-xl`
- Badges: `rounded-full`
- Modals: `rounded-xl`
- Avatars: `rounded-full`
- Progress bars: `rounded-full`

---

## Shadows

Use subtle shadows that match the warm aesthetic:

| Class | Usage |
|-------|-------|
| `shadow-sm` | Subtle depth, cards at rest |
| `shadow` | Default shadow, dropdowns |
| `shadow-md` | Elevated cards, hover states |
| `shadow-lg` | Modals, popovers |

### Shadow Guidelines

- Cards at rest: `shadow-sm`
- Cards on hover: `shadow-md`
- Modals and dialogs: `shadow-lg`
- Dropdowns: `shadow-md`
- Never use `shadow-xl` or `shadow-2xl` (too heavy for Ultaura's warm aesthetic)

---

## Icons

Use [Lucide React](https://lucide.dev) icons throughout the application.

### Ultaura Icon Set

```jsx
import { 
  // Navigation & Actions
  Phone,              // Lines, calls
  PhoneIncoming,      // Inbound calls
  PhoneOutgoing,      // Outbound calls
  PhoneMissed,        // Missed calls
  PhoneOff,           // Opted out
  Calendar,           // Schedules
  Clock,              // Time, quiet hours
  Bell,               // Notifications, reminders
  BellOff,            // Do not disturb
  
  // Status
  Check,              // Success, verified
  CheckCircle,        // Completed
  AlertTriangle,      // Warning
  AlertCircle,        // Error/alert
  Info,               // Information
  XCircle,            // Failed, error
  
  // Users & Lines
  User,               // Single user/line
  Users,              // Multiple lines/family
  UserPlus,           // Add line
  ShieldCheck,        // Verification
  
  // Settings & Controls
  Settings,           // Settings
  MoreVertical,       // More options
  Edit,               // Edit
  Trash,              // Delete
  Plus,               // Add new
  X,                  // Close
  ChevronRight,       // Navigate
  ChevronDown,        // Expand
  
  // Billing
  CreditCard,         // Payment
  Receipt,            // Billing history
  TrendingUp,         // Usage stats
  
  // Communication
  MessageSquare,      // SMS
  Mail,               // Email
  HelpCircle,         // Help/support
  
  // Privacy
  Eye,                // Visible
  EyeOff,             // Hidden
  Lock,               // Private/encrypted
} from 'lucide-react';
```

### Icon Sizes

- `w-4 h-4` — Small/inline icons, within text
- `w-5 h-5` — Standard icons, buttons, lists
- `w-6 h-6` — Featured icons in cards
- `w-8 h-8` — Large feature icons

---

## Animation Guidelines

Keep animations subtle and purposeful — caregivers may be stressed or in a hurry.

```css
/* Standard transitions */
transition-colors      /* Color changes: 150ms default */
transition-all         /* Multiple properties: 150ms default */
duration-200           /* Slightly slower: 200ms */
duration-300           /* Emphasis animations: 300ms */
```

### Animation Patterns

```jsx
// Button/link hover
className="transition-colors"

// Card hover with shadow
className="transition-all hover:shadow-md"

// Focus ring
className="focus:ring-2 focus:ring-ring transition-colors"

// Expanding content
className="transition-all duration-200"
```

### When NOT to Animate

- Don't animate page transitions (caregivers want fast navigation)
- Don't animate data changes in tables
- Don't use bounce or elastic easing (too playful for the context)
- Don't animate more than 2-3 properties at once
- Don't use loading spinners longer than necessary — show skeletons instead

---

## Responsive Breakpoints

| Breakpoint | Min Width | Usage |
|------------|-----------|-------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

### Common Responsive Patterns

```jsx
// Dashboard sidebar layout
<div className="lg:flex">
  <aside className="hidden lg:block lg:w-64 lg:flex-shrink-0">...</aside>
  <main className="flex-1 min-w-0">...</main>
</div>

// Line cards grid
<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
  ...
</div>

// Stack to row
<div className="flex flex-col sm:flex-row gap-4">
  ...
</div>

// Stats grid
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
  ...
</div>
```

---

## Accessibility Guidelines

Ultaura serves caregivers who may be older or less tech-savvy. Prioritize accessibility:

### Touch Targets
- Minimum 44x44px for all interactive elements
- Use `min-h-[44px]` on buttons and clickable areas

### Color Contrast
- All text meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Don't rely on color alone — use icons + text

### Focus States
- Always show visible focus rings
- Use `focus:ring-2 focus:ring-ring focus:ring-offset-2`

### Labels
- All form inputs must have visible labels
- Use `sr-only` for icon-only buttons to provide screen reader text

---

## Do's and Don'ts

### ✅ Do

- Use warm Stone-based neutrals from the CSS variables
- Use `text-foreground` for primary text (warm dark gray)
- Use generous padding (`p-6`) on cards
- Use subtle shadows (`shadow-sm`) at rest
- Use Tiffany Blue (`bg-primary`) only for primary actions
- Use semantic colors consistently: success (active/verified), warning (pending/low), info (scheduled), destructive (error/failed)
- Maintain consistent border radius (`rounded-xl` for cards, `rounded-lg` for inputs)
- Use OKLCH color values for any custom colors
- Show status with both color AND text/icon
- Prioritize clarity over cleverness

### ❌ Don't

- Don't use pure black (`#000000`) for text
- Don't use pure white (`#FFFFFF`) for page backgrounds
- Don't use harsh shadows (`shadow-xl`, `shadow-2xl`)
- Don't use the primary color for everything
- Don't use red (`destructive`) for non-error states
- Don't mix border radius sizes inconsistently
- Don't use more than 2 font weights on a single component
- Don't use HSL colors (use OKLCH for consistency)
- Don't rely on color alone to convey meaning
- Don't use animations that could cause distraction or motion sickness

---

## Quick Reference

```
/* Core Colors */
Primary Action:      bg-primary text-primary-foreground
Secondary Action:    bg-secondary text-secondary-foreground
Page Background:     bg-background
Card Background:     bg-card
Primary Text:        text-foreground
Secondary Text:      text-muted-foreground
Borders:             border-border
Focus Ring:          ring-ring

/* Status Colors */
Active/Verified:     bg-success/10 text-success
Pending/Warning:     bg-warning/10 text-warning
Scheduled/Info:      bg-info/10 text-info
Error/Failed:        bg-destructive/10 text-destructive

/* Sidebar */
Sidebar Background:  bg-sidebar
Sidebar Text:        text-sidebar-foreground
Sidebar Active:      bg-sidebar-accent text-sidebar-primary
```

---

## Color Reference Table

| Variable | Light Mode OKLCH | Approx. Hex | Purpose |
|----------|------------------|-------------|---------|
| `--primary` | `oklch(0.696 0.119 180.426)` | `#0ABAB5` | Tiffany Blue - buttons, links |
| `--background` | `oklch(0.995 0.001 106.423)` | `#FAFAF9` | Page background (warm white) |
| `--foreground` | `oklch(0.147 0.004 49.25)` | `#1C1917` | Primary text |
| `--card` | `oklch(1 0 0)` | `#FFFFFF` | Card backgrounds |
| `--muted` | `oklch(0.97 0.001 106.424)` | `#F5F5F4` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.553 0.013 58.071)` | `#78716C` | Secondary text |
| `--border` | `oklch(0.923 0.003 48.717)` | `#E7E5E4` | Borders |
| `--success` | `oklch(0.696 0.17 162.48)` | `#10B981` | Active, verified, completed |
| `--warning` | `oklch(0.828 0.189 84.429)` | `#F59E0B` | Pending, low minutes |
| `--info` | `oklch(0.623 0.214 259.815)` | `#3B82F6` | Scheduled, informational |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `#EF4444` | Errors, failed, opted out |
