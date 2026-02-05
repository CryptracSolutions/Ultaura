# Vision Page Design

**Date:** 2026-02-05
**Status:** Approved
**Route:** `/vision` (renamed from `/about`)

## Overview

Revamp the About page into a trust-building Vision page aligned with senior-care positioning. Focus on credibility signals, specificity about deliverables, and founder authenticity.

## Design Decisions

- **Founder story:** Professional caregiving background — worked in elder care, saw the gap
- **Clinical advisors:** Consulted professionals informally — use softer credibility language
- **Feature specificity:** 3-4 key capabilities with proof points, not a feature dump
- **Tone:** Calm, competent, caring. Direct without being cold.

## Page Structure

### 1. Hero

```
[Soft gradient background]

"Why We Built Ultaura"

A voice companion born from watching too many seniors slip into
silence — and knowing technology could do better.
```

- No CTA in hero (trust-building page, CTA at end)
- Mobile: Full-width text, no split layout

### 2. Founder Story

```
"I Saw It Every Day"

Before Ultaura, I worked in elder care. I saw what loneliness
does — not dramatically, but quietly. The woman who stopped
getting dressed because no one was coming. The man who called
the front desk just to hear a voice.

Apps couldn't help them. Too many buttons, too much frustration.
But they all knew how to answer a phone.

That gap — between what seniors need and what technology offers —
is why Ultaura exists. Not to replace family. To fill the silence
between visits.
```

- Simple text block, left-aligned, generous whitespace
- Optional pull quote: "They all knew how to answer a phone."

### 3. What We Actually Deliver

Four feature cards with proof points:

**Card 1: Scheduled Calls**
> Calls when you choose — not random check-ins
> You set the schedule. Morning encouragement, afternoon chat, evening wind-down. Quiet hours mean no calls during naps or after bedtime. Vacation mode pauses everything with one click.

**Card 2: Remembers Everything**
> Conversations that build on each other
> Ultaura remembers their stories, interests, and the names that matter to them. "How's that garden coming along?" not "Tell me about yourself" every time.

**Card 3: Safety When It Matters**
> Detects distress. Guides to help.
> If we hear signs of crisis, Ultaura can gently suggest calling 988 or 911. You get notified. Not surveillance — just a safety net.

**Card 4: You Stay Informed**
> Weekly summaries. Mood trends. No transcripts.
> See how they're doing without invading their privacy. We share insights, not recordings. Their conversations stay theirs.

- 2x2 grid desktop, single column mobile
- Subtle icons optional

### 4. How We Build Trust (Principles)

**Always Honest About AI**
> Ultaura identifies as AI at the start of every call. No voice cloning. No pretending to be a person. Deception has no place in companionship.

**Privacy by Default**
> We don't store transcripts or recordings. Family sees usage and mood trends — never the actual conversation. What they share stays between them and Ultaura.

**Safety Over Engagement**
> We'd rather a call end early than miss a sign of distress. Crisis protocols are built in, not bolted on. 988 and 911 guidance when it matters.

**No Manipulation**
> No guilt language. No artificial dependency. We actively encourage real-world connection — calls with family, visits with friends. Ultaura is a supplement, never a replacement.

- 4-column desktop, 2x2 tablet, single stack mobile

### 5. Built With Care (Credibility)

```
"Designed With People Who Know"

Ultaura wasn't built in isolation. We consulted elder care
professionals, geriatric nurses, and family caregivers throughout
development. Their input shaped everything — from how Ultaura
speaks (slower, clearer, patient) to what it watches for
(confusion, distress, sudden changes).

We also listened to seniors themselves. What makes a conversation
feel good? What feels patronizing? What would make them actually
want to answer the phone?

The result is a companion that adapts to hearing needs, respects
cognitive differences, and never rushes.
```

Optional "Built with input from" categories:
- Elder care professionals
- Geriatric nurses
- Family caregivers
- Accessibility specialists

### 6. Not a Replacement

```
[Highlighted box]

Ultaura isn't a substitute for family, friends, or human
caregivers. It's a voice for the times in between — the quiet
Tuesday afternoons, the early mornings when no one's awake yet,
the evenings that stretch too long.

Someone to chat with. Someone who remembers. Someone who's
always glad they called.
```

- Soft background (primary/5 with border), centered text

### 7. Final CTA

```
"Give the Gift of Conversation"

Set up in 5 minutes. No credit card required.
Their first call can happen today.

[Button: Start 3-day free trial]

Works on any phone, including landlines · Cancel anytime
```

## Technical Changes

1. Rename `/src/app/(site)/about/` to `/src/app/(site)/vision/`
2. Update all internal links from `/about` to `/vision`
3. Update metadata (title, description)
4. Implement new page structure

## Acceptance Criteria

- [x] Design approved
- [ ] Reads as "calm, competent, caring"
- [ ] Works well on mobile (no giant empty gaps)
- [ ] CTA remains clear
- [ ] Includes founder story with caregiving background
- [ ] Shows specific deliverables (scheduled calls, reminders, dashboard, safety)
- [ ] Credibility signals present (professional consultation, AI disclosure, privacy)

## Research Sources

- Meela competitor analysis: https://baincapitalventures.com/insight/meela-delivers-companionship-and-ai-powered-conversation-to-america-s-seniors/
- Key insight: Founder authenticity + specific evidence-based results build trust
- Key insight: Position as "amplifier of human care" not replacement
