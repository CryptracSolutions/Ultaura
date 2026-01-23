# Ultaura Documentation Specification

## Objective

Replace the existing MakerKit placeholder documentation at `/docs` with comprehensive user documentation for Ultaura, an AI voice companion service for seniors. The documentation should help family caregivers understand and use all features of the Ultaura dashboard.

## Scope

- **Total Pages**: ~35 MDX files across 9 sections
- **Primary Audience**: Family caregivers managing Ultaura for elderly loved ones
- **Terminology**: Use "your loved one" when referring to call recipients
- **Tone**: Warm, clear, simple. Active voice, short sentences, no technical jargon
- **Format**: Text-only (no screenshots initially)

---

## File Structure

All files go in `src/content/docs/`

### Files to Delete

Remove these existing placeholder directories and their contents:
- `src/content/docs/001-getting_started/` (entire directory)
- `src/content/docs/002-authentication/` (entire directory)

### Files to Create

```
src/content/docs/
├── 001-getting-started/
│   ├── index.mdx
│   ├── 001-what-is-ultaura.mdx
│   ├── 002-setting-up-account.mdx
│   └── 003-your-first-line.mdx
├── 002-managing-lines/
│   ├── index.mdx
│   ├── 001-adding-a-line.mdx
│   ├── 002-phone-verification.mdx
│   ├── 003-line-settings.mdx
│   ├── 004-voice-preferences.mdx
│   └── 005-vacation-mode.mdx
├── 003-schedules-and-reminders/
│   ├── index.mdx
│   ├── 001-call-schedules.mdx
│   ├── 002-managing-reminders.mdx
│   ├── 003-skipping-calls.mdx
│   └── 004-quiet-hours.mdx
├── 004-safety-and-contacts/
│   ├── index.mdx
│   ├── 001-trusted-contacts.mdx
│   ├── 002-wellness-alerts.mdx
│   └── 003-safety-monitoring.mdx
├── 005-insights-and-reports/
│   ├── index.mdx
│   ├── 001-mood-tracking.mdx
│   ├── 002-conversation-highlights.mdx
│   ├── 003-weekly-summaries.mdx
│   └── 004-sharing-with-family.mdx
├── 006-personalization/
│   ├── index.mdx
│   ├── 001-milestones.mdx
│   ├── 002-accessibility.mdx
│   └── 003-conversation-topics.mdx
├── 007-billing-and-usage/
│   ├── index.mdx
│   ├── 001-understanding-plans.mdx
│   ├── 002-tracking-usage.mdx
│   └── 003-managing-subscription.mdx
├── 008-privacy/
│   ├── index.mdx
│   ├── 001-consent-management.mdx
│   ├── 002-data-and-recordings.mdx
│   └── 003-export-and-deletion.mdx
└── 009-troubleshooting/
    ├── index.mdx
    ├── 001-call-issues.mdx
    ├── 002-verification-problems.mdx
    └── 003-faq.mdx
```

---

## MDX Format Requirements

### Frontmatter Structure

Every file must include frontmatter:

```yaml
---
title: "Full Page Title"
label: "Short Nav Label"
description: "One-line description for SEO and page subtitle"
---
```

Index pages should add:
```yaml
show_child_cards: true
```

### File Naming Convention

- Use numeric prefixes for ordering: `001-`, `002-`, etc.
- Use kebab-case for file names: `001-what-is-ultaura.mdx`
- Index files are always named `index.mdx`

---

## Section 1: Getting Started (4 files)

### 001-getting-started/index.mdx

```yaml
---
title: "Getting Started"
label: "Getting Started"
description: "Learn how to set up Ultaura and make your first call"
show_child_cards: true
---
```

**Content Outline**:
- Welcome message: "Welcome to Ultaura, your AI voice companion for seniors"
- Brief value proposition for both caregivers (peace of mind, stay connected) and seniors (companionship, friendly conversation)
- Highlight key benefit: **Works on any phone, including landlines**
- What you'll learn in this section (bullet list)

### 001-getting-started/001-what-is-ultaura.mdx

```yaml
---
title: "What Is Ultaura?"
label: "What Is Ultaura"
description: "An overview of Ultaura's AI voice companion service"
---
```

**Content Outline**:
- **How Ultaura Works**: Ultaura calls your loved one at scheduled times for friendly conversation
- **Who It's For**: Seniors who live alone, those who enjoy regular check-ins, families who want peace of mind
- **Key Features Overview**:
  - Scheduled check-in calls
  - Natural voice conversations
  - Reminders during calls
  - Mood and wellness tracking
  - Safety monitoring
  - Weekly email summaries
- **Works on Any Phone**: Landlines, cell phones, no app or internet needed for seniors
- **What Ultaura Is NOT** (Disclaimers):
  - NOT an emergency response service
  - NOT a medical device or health monitoring system
  - NOT a replacement for human care and connection
  - Link to Terms of Service and Privacy Policy for full details
- **Getting Started**: Link to next page

### 001-getting-started/002-setting-up-account.mdx

```yaml
---
title: "Setting Up Your Account"
label: "Account Setup"
description: "Create your Ultaura account and start your free trial"
---
```

**Content Outline**:
- **Creating Your Account**: Sign up process
- **Free Trial Overview**:
  - 3 days of access
  - 20 minutes of call time included
  - 1 phone line
  - No credit card required to start
  - Trial ends automatically (hard stop, no overage charges)
- **Choosing Your Plan** (brief mention, link to billing section for details)
- **Your Dashboard**: Overview of what you'll see after signing in
- **Next Step**: Creating your first line

### 001-getting-started/003-your-first-line.mdx

```yaml
---
title: "Creating Your First Line"
label: "Your First Line"
description: "Set up a phone line for your loved one and make a test call"
---
```

**Content Outline**:
- **What Is a Line?**: A phone profile for one person (your loved one)
- **Step-by-Step Guide**:
  1. Go to Lines in your dashboard
  2. Click "Add Line"
  3. Enter your loved one's name
  4. Enter their phone number (works with landlines and cell phones)
  5. Select their timezone
  6. Verify the phone number (SMS code sent to the phone)
- **Making a Test Call** (two modes available):
  - **Quick Test**: Tests audio and connection only - no disclosures, just verify the call works
  - **Preview Full Experience**: Hear the complete first-call flow including AI disclosures
  - How to initiate: Click "Test Call" on the line page, select mode
  - Let your loved one know Ultaura will be calling
- **Setting Up a Schedule**: Link to scheduling section
- **Tip**: Suggest calling your loved one first to let them know about Ultaura

---

## Section 2: Managing Lines (6 files)

### 002-managing-lines/index.mdx

```yaml
---
title: "Managing Lines"
label: "Managing Lines"
description: "Learn how to set up and manage phone lines for your loved ones"
show_child_cards: true
---
```

**Content Outline**:
- What is a line (phone profile for one person)
- How many lines you can have (depends on plan: 1-4)
- **Works on any phone, including landlines** - recurring callout
- Topics covered in this section

### 002-managing-lines/001-adding-a-line.mdx

```yaml
---
title: "Adding a New Line"
label: "Adding a Line"
description: "How to add a new phone line for a loved one"
---
```

**Content Outline**:
- **When to Add a Line**: Adding another family member, different phone number
- **Line Limits by Plan**:
  | Plan | Lines Included |
  |------|---------------|
  | Free Trial | 1 |
  | Care | 1 |
  | Comfort | 2 |
  | Family | 4 |
  | Usage Based | 4 |
- **Step-by-Step**:
  1. Navigate to Lines
  2. Click "Add Line"
  3. Enter name, phone number, timezone
  4. Optional: Add interests and topics to avoid
  5. Verify the phone number
- **Landline Support**: Works with home phones that can receive calls
- **Next**: Phone verification

### 002-managing-lines/002-phone-verification.mdx

```yaml
---
title: "Phone Verification"
label: "Phone Verification"
description: "Verify your loved one's phone number before calls begin"
---
```

**Content Outline**:
- **Why Verification Is Required**: Safety and consent
- **How It Works**:
  1. We send a 6-digit code via SMS
  2. Enter the code in the dashboard
  3. Verification is complete
- **For Landlines**: Verification code can be sent via voice call
- **Verification Tips**:
  - Let your loved one know to expect the code
  - Codes expire after a short time - request a new one if needed
  - You can request a new code anytime
- **Troubleshooting**: Link to verification problems page

### 002-managing-lines/003-line-settings.mdx

```yaml
---
title: "Line Settings"
label: "Line Settings"
description: "Customize settings for each phone line"
---
```

**Content Outline**:
- **Accessing Line Settings**: Dashboard > Lines > [Line Name] > Settings
- **Settings are organized into three tabs**:

**Calling & Availability Tab**:

| Setting | What It Does |
|---------|-------------|
| Language | Preferred conversation language (or auto-detect) |
| Timezone | Used for scheduling calls and quiet hours |
| Quiet Hours | Times when calls won't be made (default 9 PM - 9 AM) |
| Voicemail | What happens if a call goes to voicemail |
| Inbound Calls | Allow your loved one to call Ultaura anytime |
| Voice Controls | Let your loved one manage reminders/schedules by voice |
| Vacation | Pause calls during travel dates |

- **Voicemail Settings**: What happens if a call goes to voicemail
  - None: Hang up silently
  - Brief: Leave short message ("I'll call back soon")
  - Detailed: Include reason for calling
- **Inbound Calling**: When enabled, your loved one can call Ultaura's number to start a conversation anytime, not just during scheduled calls
- **Voice Controls**:
  - Voice reminder control: Your loved one can create, edit, pause, and cancel reminders during calls
  - Voice schedule control: Your loved one can skip, snooze, or reschedule calls by voice

**Insights & Notifications Tab**:

| Setting | What It Does |
|---------|-------------|
| Insights & Privacy | Enable/disable call insights, pause alerts |
| Weekly Summary | Email recap of calls, mood, and wellbeing notes |
| Missed Call Alerts | Email when consecutive calls are missed |

- **Weekly Summary**: Delivered to the billing email on your account, configurable day and time
- **Missed Call Alerts**: Configurable threshold (2-5 missed calls)

**Accessibility Tab**:
- Hearing mode, cognitive mode, speech rate, context window (see Accessibility section)

- **Deleting a Line**: Go to Line detail page to permanently remove a line

### 002-managing-lines/004-voice-preferences.mdx

```yaml
---
title: "Voice Preferences"
label: "Voice Preferences"
description: "Learn about Ultaura's AI voice options"
---
```

**Content Outline**:
- **Available Voices** (selected during line creation):

| Voice | Personality | Best For |
|-------|-------------|----------|
| **Ara** | Warm and nurturing - Gentle, Comforting, Patient | Those who prefer a soothing, motherly presence |
| **Eve** | Bright and cheerful - Upbeat, Friendly, Energetic | Those who enjoy lively, uplifting conversation |
| **Leo** | Calm and reassuring - Steady, Warm, Thoughtful | Those who appreciate a measured, reliable tone |
| **Rex** | Clear and articulate - Clear, Confident, Engaging | Those who prefer direct, easy-to-understand speech |
| **Sal** | Conversational and natural - Natural, Relaxed, Personable | Those who enjoy casual, everyday conversation |

- **Previewing Voices**: Use the voice demo on the homepage to hear samples before choosing
- **When Voice Is Selected**: During line creation when adding a new line
- **Tips for Choosing**:
  - Consider what your loved one responds well to
  - Think about their hearing needs (clear voices like Rex may help)
  - Try the voice demo to hear each option
- **Default Voice**: Ara (warm and nurturing) is the default if no selection is made

### 002-managing-lines/005-vacation-mode.mdx

```yaml
---
title: "Vacation Mode"
label: "Vacation Mode"
description: "Temporarily pause calls when your loved one is traveling"
---
```

**Content Outline**:
- **What Is Vacation Mode?**: Pause scheduled calls for a date range
- **When to Use It**:
  - Travel or vacation
  - Hospital stay
  - Visiting family
- **Comparison with Other Pause Options**:

| Option | Use When | How Long | What's Paused |
|--------|----------|----------|---------------|
| Vacation Mode | Planned travel with specific dates | Days to weeks | All scheduled calls during dates |
| Skip Next Call | One-time skip | Just one scheduled call | Single upcoming call |
| Snooze Call | Delay a call temporarily | 15-60 minutes | Current scheduled call |

- **How to Set Vacation Mode**:
  1. Go to Line Settings
  2. Add vacation dates (start and end)
  3. Calls automatically pause during that period
  4. Calls resume automatically after the end date
- **Managing Vacation Ranges**: Adding, viewing, removing

---

## Section 3: Schedules and Reminders (5 files)

### 003-schedules-and-reminders/index.mdx

```yaml
---
title: "Schedules and Reminders"
label: "Schedules & Reminders"
description: "Set up regular check-in calls and reminders for your loved one"
show_child_cards: true
---
```

**Content Outline**:
- Overview of scheduling capabilities
- Difference between schedules (regular calls) and reminders (one-time or recurring messages)
- Topics in this section

### 003-schedules-and-reminders/001-call-schedules.mdx

```yaml
---
title: "Setting Up Call Schedules"
label: "Call Schedules"
description: "Schedule regular check-in calls at the times that work best"
---
```

**Content Outline**:
- **What Is a Schedule?**: Recurring calls at set times and days
- **Creating a Schedule**:
  1. Go to Line > Schedule
  2. Select days of the week
  3. Choose time of day
  4. Set timezone (usually matches line timezone)
  5. Save schedule
- **Multiple Schedules**: You can create multiple schedules for different times
- **Retry Settings**: What happens if a call isn't answered
  - Default: 2 retries within 30 minutes
  - Can be customized
- **When Calls Won't Be Made**:
  - During quiet hours
  - During vacation mode
  - If the line is paused

### 003-schedules-and-reminders/002-managing-reminders.mdx

```yaml
---
title: "Managing Reminders"
label: "Reminders"
description: "Set up medication, appointment, and other reminders"
---
```

**Content Outline**:
- **What Are Reminders?**: Messages delivered during calls
- **Types of Reminders**:
  - One-time reminders
  - Daily reminders
  - Weekly reminders
  - Monthly reminders
  - Custom recurring patterns
- **Creating a Reminder**:
  1. Go to Line > Reminders
  2. Enter reminder message
  3. Set date and time
  4. Choose recurrence (if any)
  5. Save reminder
- **How Reminders Are Delivered**: During the next scheduled call
- **Managing Reminders**:
  - Pause a reminder temporarily
  - Snooze a reminder
  - Skip the next occurrence
  - Cancel a reminder
- **Reminder Privacy**: Your loved one controls what they share about reminders

### 003-schedules-and-reminders/003-skipping-calls.mdx

```yaml
---
title: "Skipping and Rescheduling Calls"
label: "Skipping Calls"
description: "How to skip or reschedule upcoming calls"
---
```

**Content Outline**:
- **Skip vs. Snooze vs. Reschedule**:

| Action | What It Does | When to Use |
|--------|-------------|-------------|
| Skip | Cancel the next scheduled call | One-time skip (doctor visit, etc.) |
| Snooze | Delay the call by a set time | Running late, need more time |
| Reschedule | Change to a different time/day | Permanent change for one occurrence |

- **How to Skip a Call**:
  1. Go to the schedule
  2. Click "Skip next call"
  3. The following scheduled call will proceed normally
- **How to Snooze a Call**: Delay by 15, 30, or 60 minutes
- **Voice Control**: Your loved one can also request skips during calls

### 003-schedules-and-reminders/004-quiet-hours.mdx

```yaml
---
title: "Quiet Hours"
label: "Quiet Hours"
description: "Set times when Ultaura won't make calls"
---
```

**Content Outline**:
- **What Are Quiet Hours?**: Times when no calls will be made
- **Default Quiet Hours**: 9:00 PM to 9:00 AM (can be customized)
- **Setting Quiet Hours**:
  1. Go to Line Settings
  2. Find Quiet Hours section
  3. Set start and end times
  4. Save changes
- **How Quiet Hours Work**:
  - Scheduled calls during quiet hours are skipped
  - Calls don't "queue up" - they're simply not made
  - Next call happens at the next scheduled time outside quiet hours
- **Tips**:
  - Match quiet hours to your loved one's sleep schedule
  - Consider nap times for daytime quiet hours

---

## Section 4: Safety and Contacts (4 files)

### 004-safety-and-contacts/index.mdx

```yaml
---
title: "Safety and Contacts"
label: "Safety & Contacts"
description: "Keep your loved one safe with trusted contacts and wellness monitoring"
show_child_cards: true
---
```

**Content Outline**:
- Overview of safety features
- Peace of mind for families
- Topics in this section

### 004-safety-and-contacts/001-trusted-contacts.mdx

```yaml
---
title: "Trusted Contacts"
label: "Trusted Contacts"
description: "Add emergency contacts who can be notified during safety events"
---
```

**Content Outline**:
- **What Are Trusted Contacts?**: Emergency contacts who receive SMS alerts for high-tier safety events (significant distress or crisis situations)
- **Adding a Trusted Contact**:
  1. Go to Line > Contacts
  2. Click "Add Contact"
  3. Enter name and phone number
  4. Add relationship (optional, e.g., "Son", "Daughter", "Caregiver")
  5. Acknowledge the consent notice
  6. Save contact
- **What Trusted Contacts Receive**: SMS text alerts only for high-tier safety events (medium and high severity concerns detected during calls)
- **Managing Contacts**: View list, remove contacts as needed
- **Important Notes**:
  - Trusted contacts receive SMS alerts only (not phone calls)
  - Only high-tier safety events (medium/high severity) trigger notifications - not every concern
  - You can add multiple trusted contacts per line

### 004-safety-and-contacts/002-wellness-alerts.mdx

```yaml
---
title: "Wellness Alerts"
label: "Wellness Alerts"
description: "Understand how wellness alerts keep you informed"
---
```

**Content Outline**:
- **What Are Wellness Alerts?**: Automatic notifications when concerns are detected
- **Types of Alerts**:
  - Info: General updates
  - Warning: Moderate concerns
  - Urgent: Significant concerns requiring attention
- **What Triggers an Alert**:
  - Health mentions: When your loved one mentions health concerns during calls
  - Mood drop: Significant decrease in mood compared to recent calls
  - Cognitive concerns: Observations suggesting cognitive changes
  - Missed calls: Multiple consecutive scheduled calls not answered
- **Receiving Alerts**:
  - Email notifications
  - Dashboard alerts
- **Acknowledging Alerts**: Mark as reviewed after taking action
- **Privacy Note**: Alert content respects sharing tier settings

### 004-safety-and-contacts/003-safety-monitoring.mdx

```yaml
---
title: "Safety Monitoring"
label: "Safety Monitoring"
description: "How Ultaura monitors for safety concerns during calls"
---
```

**Content Outline**:
- **How Safety Monitoring Works**:
  - Ultaura listens for signs of distress during conversations
  - Concerns are classified by severity
  - Appropriate actions are taken based on severity
- **Response Levels** (reassuring tone, not scary):

| Level | What It Means | What Happens |
|-------|---------------|--------------|
| Low | Mild concern detected | Ultaura offers support, logged for review |
| Medium | Moderate concern | Ultaura provides resources, may notify contacts |
| High | Significant concern | Ultaura provides crisis resources (988 Lifeline), notifies contacts |

- **Crisis Resources**: Ultaura can provide the 988 Suicide and Crisis Lifeline number
- **What Ultaura Is NOT**:
  - NOT an emergency response service
  - NOT a replacement for calling 911 in emergencies
  - NOT a medical monitoring device
- **Your Role**: Review alerts promptly, maintain other safety measures

---

## Section 5: Insights and Reports (5 files)

### 005-insights-and-reports/index.mdx

```yaml
---
title: "Insights and Reports"
label: "Insights & Reports"
description: "Stay connected to your loved one's wellbeing with insights and summaries"
show_child_cards: true
---
```

**Content Outline**:
- Overview of insights dashboard
- How insights help you stay connected
- Topics in this section

### 005-insights-and-reports/001-mood-tracking.mdx

```yaml
---
title: "Mood Tracking"
label: "Mood Tracking"
description: "Monitor your loved one's emotional wellbeing over time"
---
```

**Content Outline**:
- **What Is Mood Tracking?**: Wellness monitoring to help you stay connected to your loved one's wellbeing
- **How It Works**:
  - After each call, Ultaura notes the overall mood
  - Moods are tracked as: Positive, Neutral, or Low
  - Patterns are identified over time
- **Viewing Mood Data**:
  - Mood calendar (monthly view)
  - Mood trends (over time)
  - Mood distribution (positive/neutral/low percentages)
- **Understanding Patterns**:
  - Look for consistent trends, not single data points
  - Consider external factors (weather, holidays, health)
  - Use insights to guide your own check-ins
- **Privacy**: Mood data visibility depends on sharing tier settings

### 005-insights-and-reports/002-conversation-highlights.mdx

```yaml
---
title: "Conversation Highlights"
label: "Conversation Highlights"
description: "See key moments and topics from recent calls"
---
```

**Content Outline**:
- **What Are Conversation Highlights?**: Key moments from calls
- **What's Included**:
  - Topics discussed (family, activities, memories, etc.)
  - New information learned about your loved one
  - Milestones mentioned (birthdays, anniversaries)
- **Topic Categories**:
  - Family
  - Friends
  - Activities
  - Interests
  - Memories
  - Plans
  - Daily Life
  - Entertainment
  - Feelings
- **Viewing Highlights**: Dashboard > Insights > Conversation Highlights
- **Privacy**: Topic visibility depends on sharing tier settings

### 005-insights-and-reports/003-weekly-summaries.mdx

```yaml
---
title: "Weekly Summaries"
label: "Weekly Summaries"
description: "Receive weekly email digests about your loved one's calls"
---
```

**Content Outline**:
- **What Are Weekly Summaries?**: Email digests sent once a week for each line
- **What's Included**:
  - Number of calls made and answered
  - Overall mood summary
  - Topics discussed
  - Any concerns or follow-up suggestions
  - Usage summary (minutes used)
- **Setting Up Weekly Summaries** (configured per line):
  1. Go to Line > Settings
  2. Select the "Insights & Notifications" tab
  3. Find "Weekly Summary" section
  4. Toggle on "Send weekly summary emails"
  5. Choose delivery day (e.g., Sunday)
  6. Choose delivery time (e.g., 6:00 PM)
  7. Save changes
- **Where Summaries Are Sent**: Delivered to the billing email on your account
- **Content Varies by Sharing Tier**: Summary detail depends on your loved one's sharing consent
- **Disabling Summaries**: Toggle off in Line Settings > Insights & Notifications

### 005-insights-and-reports/004-sharing-with-family.mdx

```yaml
---
title: "Sharing with Family"
label: "Sharing with Family"
description: "Invite family members to receive summaries and alerts"
---
```

**Content Outline**:
- **Family Sharing Overview**: Multiple family members can stay informed
- **Prerequisite**: You must enable "Share insights with other family members" in Privacy Center first. This master toggle controls whether sharing is available at all.
- **Step-by-Step: Inviting a Family Member**:
  1. Go to Privacy Center → Family Recipients
  2. Enable "Share insights with other family members" if not already on
  3. Click "Invite Recipient"
  4. Enter their name and email address
  5. Choose their relationship (optional)
  6. Send invitation
  7. They receive an email to confirm
  8. Once confirmed, they receive summaries and alerts
- **What Family Members Receive**:
  - Weekly email summaries
  - Wellness alerts
  - Safety notifications (if enabled)
- **Managing Recipients**:
  - View pending and confirmed recipients
  - Remove a recipient
  - Resend invitation
- **Recipient Limit**: You can invite up to 5 family members to receive updates
- **Sharing Tiers** (what information is shared):

| Tier | Name | What's Shared |
|------|------|---------------|
| Tier 1 | Basic Updates & Safety | Safety alerts only - that you're using the service, call stats |
| Tier 2 | Wellness Check | + Mood tracking - how they're feeling overall |
| Tier 3 | Full Summary | + Conversation topics - what they talked about |
| Tier 4 | Complete Visibility | + Concerns, relationship mentions, and detailed insights |

- **How Sharing Consent Works**: Your loved one can adjust sharing during calls
- **Privacy Considerations**: Respect your loved one's preferences - they control what tier is shared

---

## Section 6: Personalization (4 files)

### 006-personalization/index.mdx

```yaml
---
title: "Personalization"
label: "Personalization"
description: "Make calls more meaningful with personalization features"
show_child_cards: true
---
```

**Content Outline**:
- Overview of personalization features
- How personalization improves calls
- Topics in this section

### 006-personalization/001-milestones.mdx

```yaml
---
title: "Milestones"
label: "Milestones"
description: "Track birthdays, anniversaries, and special dates"
---
```

**Content Outline**:
- **What Are Milestones?**: Important dates that Ultaura remembers
- **Types of Milestones**:
  - Birthdays
  - Anniversaries
  - Memorials (honor loved ones who have passed - gentle framing)
  - Achievements
  - Holidays
  - Custom dates
- **Adding a Milestone**:
  1. Go to Line > Milestones
  2. Click "Add Milestone"
  3. Enter title and type
  4. Select date (month, day, optionally year)
  5. Add related person's name (optional)
  6. Choose if it recurs yearly
  7. Save
- **How Milestones Are Used**: Ultaura brings up milestones in conversation near the date
- **Managing Milestones**: Edit, delete, view upcoming

### 006-personalization/002-accessibility.mdx

```yaml
---
title: "Accessibility Settings"
label: "Accessibility"
description: "Adjust settings for hearing and cognitive support"
---
```

**Content Outline**:
- **Accessibility Overview**: Settings to accommodate different needs
- **Hearing Settings**:

| Setting | What It Does |
|---------|-------------|
| Normal | Standard speech clarity and pace |
| Enhanced Clarity | Clearer pronunciation, slightly slower |
| Slow Pace | Noticeably slower speech for easier understanding |

- **Speech Rate**: Fine-tune how fast Ultaura speaks (0.7x to 1.3x)
- **Cognitive Support Settings**:

| Setting | What It Does |
|---------|-------------|
| Normal | Standard conversation flow |
| Supportive | More patience, simpler language, gentle repetition |
| High Support | Extra time to respond, shorter sentences, more prompts |

- **Context Window**: How many recent calls Ultaura remembers for context (1-20)
- **How to Change Settings**: Line > Settings > Accessibility
- **Tips**: Start with moderate settings and adjust based on your loved one's comfort

### 006-personalization/003-conversation-topics.mdx

```yaml
---
title: "Conversation Topics"
label: "Conversation Topics"
description: "Guide what Ultaura talks about with your loved one"
---
```

**Content Outline**:
- **Seed Interests**: Topics your loved one enjoys
  - Add during line setup or in settings
  - Examples: gardening, cooking, sports, music
  - Ultaura uses these to start conversations
- **Topics to Avoid**: Subjects to steer clear of
  - Set sensitive topics to avoid
  - Examples: recent loss, stressful news topics
  - Ultaura will not bring these up
- **Topic Preferences Over Time**: Ultaura learns from conversations
- **Your Loved One's Control**: They can mark topics as private during calls
- **Managing Topic Preferences**: Line Settings

---

## Section 7: Billing and Usage (4 files)

### 007-billing-and-usage/index.mdx

```yaml
---
title: "Billing and Usage"
label: "Billing & Usage"
description: "Understand plans, track usage, and manage your subscription"
show_child_cards: true
---
```

**Content Outline**:
- Overview of billing
- Minutes-based usage
- Topics in this section

### 007-billing-and-usage/001-understanding-plans.mdx

```yaml
---
title: "Understanding Plans"
label: "Understanding Plans"
description: "Compare Ultaura plans and pricing"
---
```

**Content Outline**:
- **Plan Comparison**:

| Plan | Monthly Price | Annual Price | Minutes Included | Lines |
|------|--------------|--------------|------------------|-------|
| Free Trial | Free | - | 20 | 1 |
| Care | $39/month | $399/year | 300 | 1 |
| Comfort | $99/month | $999/year | 900 | 2 |
| Family | $199/month | $1,999/year | 2,200 | 4 |
| Usage Based | Free | - | 0 (pay per minute) | 4 |

- **Annual Savings**: Save 15% with annual billing (Care, Comfort, Family plans)
- **Free Trial Details**:
  - 3 days of access
  - 20 minutes of call time
  - 1 phone line
  - Hard stop at limit (no surprise charges)
  - No credit card required to start
- **Usage Based (Pay As You Go) Plan**:
  - No monthly fee
  - Pay $0.15 per minute used
  - Up to 4 lines included
  - Best for: Occasional use or unpredictable call patterns
- **Overage Pricing**: $0.15 per minute beyond included minutes (Care, Comfort, Family plans)
- **Choosing the Right Plan**:
  - Care: One loved one, daily check-ins
  - Comfort: Two loved ones, or one with longer calls
  - Family: Multiple family members
  - Usage Based: Occasional use, pay only for what you use
- **View Full Pricing**: Link to /pricing page

### 007-billing-and-usage/002-tracking-usage.mdx

```yaml
---
title: "Tracking Usage"
label: "Tracking Usage"
description: "Monitor your minutes and call activity"
---
```

**Content Outline**:
- **Usage Dashboard**: Where to find usage information (Dashboard > Usage)
- **What's Tracked**:
  - Minutes used this billing cycle
  - Minutes remaining
  - Overage minutes (if any)
  - Cost of overage
- **Call History**: View all calls with duration
- **Usage Alerts**:
  - Low minutes warning (15 minutes remaining)
  - Critical warning (5 minutes remaining)
- **Minutes Pool**: All lines share the same minutes pool
- **Billing Cycle**: When usage resets
- **Spending Cap** (Overage Protection):
  - Set a maximum monthly overage spend
  - When the cap is reached, calls stop until the next cycle
  - Available options: No limit, $10, $25, $50, $100
  - Protects against unexpected charges
  - Adjust anytime in the Usage dashboard

### 007-billing-and-usage/003-managing-subscription.mdx

```yaml
---
title: "Managing Your Subscription"
label: "Managing Subscription"
description: "Upgrade, downgrade, or cancel your subscription"
---
```

**Content Outline**:
- **Upgrading Your Plan**:
  - More minutes
  - More lines
  - Prorated billing
- **Downgrading Your Plan**:
  - Takes effect at next billing cycle
  - May lose access to extra lines
- **Switching to Annual Billing**: Save 15%
- **Overage Cap**: Set a maximum overage amount
- **Canceling Your Subscription**:
  - Access continues until end of billing period
  - Data retention options
- **Payment Methods**: Managing credit cards
- **Billing History**: View past invoices

---

## Section 8: Privacy (4 files)

### 008-privacy/index.mdx

```yaml
---
title: "Privacy"
label: "Privacy"
description: "Understand how Ultaura protects your loved one's privacy"
show_child_cards: true
---
```

**Content Outline**:
- Privacy overview
- Your loved one's control
- Topics in this section

### 008-privacy/001-consent-management.mdx

```yaml
---
title: "Consent Management"
label: "Consent Management"
description: "How consent works for calls, sharing, and data"
---
```

**Content Outline**:
- **Types of Consent**:
  - Call consent: Permission to make calls
  - Recording consent: Permission to record calls (if enabled)
  - Sharing consent: Permission to share insights with family
  - Data retention consent: Permission to store call data
- **How Consent Is Collected**:
  - Payer acknowledgment during line setup (you acknowledge consent on behalf of your loved one)
  - Voice consent during calls (your loved one confirms consent verbally)
- **Sharing Tiers** (repeated from sharing section for context):
  - Tier 1: Basic Updates & Safety (safety alerts and call stats only)
  - Tier 2: Wellness Check (adds mood tracking)
  - Tier 3: Full Summary (adds conversation topics)
  - Tier 4: Complete Visibility (adds concerns and relationship details)
- **Your Loved One's Control**: They can change sharing preferences during any call
- **Opting Out of Calls**: Your loved one can stop calls at any time:
  - During a call: Press 9 on their phone keypad
  - During a call: Simply tell Ultaura they want to stop receiving calls
  - The line will be marked as opted-out and no further calls will be made
- **Consent Audit Log**: View history of consent changes in Privacy Center

### 008-privacy/002-data-and-recordings.mdx

```yaml
---
title: "Data and Recordings"
label: "Data & Recordings"
description: "How call data and recordings are handled"
---
```

**Content Outline**:
- **What Data Is Collected**:
  - Call metadata (time, duration)
  - Conversation insights (mood, topics)
  - Memory summaries
  - Safety events
- **Call Recordings**:
  - Optional feature (can be disabled)
  - Requires explicit consent
  - Encrypted storage
- **Data Retention Options**:
  - 30 days
  - 90 days
  - 365 days
  - Indefinite
- **Security** (general reassurance without technical details):
  - All data is encrypted
  - Industry-standard security practices
  - Your data is never sold
- **Changing Retention Settings**: Privacy Center location

### 008-privacy/003-export-and-deletion.mdx

```yaml
---
title: "Export and Deletion"
label: "Export & Deletion"
description: "Request your data or delete your account"
---
```

**Content Outline**:
- **Data Export**:
  - Request a copy of all your data
  - Includes call history, insights, memories
  - Delivered via secure download
  - You'll receive an email when your export is ready
- **How to Request Export**:
  1. Go to Privacy Center
  2. Click "Request Data Export"
  3. Confirm your request
  4. Receive email when ready
- **Account Deletion**:
  - Permanently delete all data
  - Cannot be undone
  - All lines, schedules, and history removed
- **How to Delete Account**:
  1. Go to Privacy Center
  2. Click "Delete Account"
  3. Confirm deletion
  4. Account is scheduled for deletion
- **What Happens After Deletion**: Calls stop immediately, data removed within 30 days

---

## Section 9: Troubleshooting (4 files)

### 009-troubleshooting/index.mdx

```yaml
---
title: "Troubleshooting"
label: "Troubleshooting"
description: "Find solutions to common issues"
show_child_cards: true
---
```

**Content Outline**:
- Overview of common issues
- How to get help
- Topics in this section

### 009-troubleshooting/001-call-issues.mdx

```yaml
---
title: "Call Issues"
label: "Call Issues"
description: "Troubleshoot problems with calls not connecting"
---
```

**Content Outline**:
- **Call Not Connecting**:
  - Check if the line is paused
  - Check if it's during quiet hours
  - Check if vacation mode is active
  - Verify phone number is correct and verified
- **Call Going to Voicemail**:
  - Check voicemail behavior setting
  - Your loved one may not hear the phone
  - Consider adjusting call time
- **Call Quality Issues**:
  - Phone line quality affects calls
  - Landlines generally have good quality
  - Cell phone signal strength matters
- **Missed Calls**:
  - Check call history for attempts
  - Review retry settings
  - Consider adjusting schedule times
- **Still Having Issues?**: Contact support@ultaura.com

### 009-troubleshooting/002-verification-problems.mdx

```yaml
---
title: "Verification Problems"
label: "Verification Problems"
description: "Troubleshoot phone number verification issues"
---
```

**Content Outline**:
- **Code Not Received**:
  - Check the phone number is correct
  - For landlines, use voice call option
  - Wait a few minutes and try again
  - Check if phone has call/text blocking
- **Code Expired**:
  - Verification codes expire after a short time
  - Request a new code if the original doesn't work
- **Invalid Code**:
  - Enter digits only (no spaces)
  - Check for typos
  - Request a new code if needed
- **Too Many Attempts**:
  - Wait 30 minutes before trying again
  - Rate limits protect against abuse
- **Still Having Issues?**: Contact support@ultaura.com

### 009-troubleshooting/003-faq.mdx

```yaml
---
title: "Frequently Asked Questions"
label: "FAQ"
description: "Answers to common questions about using Ultaura"
---
```

**Content Outline** (how-to focused, complements marketing FAQ):

**Getting Started**
- Q: How do I know if a call went through?
- Q: Can my loved one call Ultaura back? (Yes, if inbound calling is enabled)
- Q: What if my loved one doesn't want to talk?
- Q: How can my loved one stop calls entirely? (Press 9 during a call or ask verbally)

**Calls and Scheduling**
- Q: How long do calls usually last?
- Q: Can I change the call schedule?
- Q: What happens if my loved one hangs up early?

**Privacy and Sharing**
- Q: Can my loved one change what's shared with me?
- Q: Is the conversation recorded?
- Q: Who else can see the insights?

**Billing**
- Q: What happens when I run out of minutes?
- Q: Can I add more minutes mid-cycle?
- Q: How do I cancel?

**Technical**
- Q: Does my loved one need a smartphone?
- Q: Does Ultaura work internationally?
- Q: What languages does Ultaura support?

**Need More Help?**: Contact support@ultaura.com

---

## Sample Content: Getting Started Section

Below is complete sample content for the Getting Started section to establish tone and style.

### 001-getting-started/index.mdx (Complete)

```mdx
---
title: "Getting Started"
label: "Getting Started"
description: "Learn how to set up Ultaura and make your first call"
show_child_cards: true
---

Welcome to Ultaura, your AI voice companion for seniors.

Ultaura makes friendly check-in calls to your loved ones at times you choose. Through natural conversation, we provide companionship, deliver reminders, and keep you connected to how they're doing.

**For you**, Ultaura offers peace of mind. Know that your loved one is getting regular check-ins, even when you can't be there. Receive weekly summaries and alerts if anything needs your attention.

**For your loved one**, Ultaura offers companionship. A friendly voice to chat with, someone who remembers their stories, and a gentle reminder system that respects their independence.

**Works on any phone, including landlines.** Your loved one doesn't need a smartphone or internet access. If they can receive a phone call, Ultaura can reach them.

In this section, you'll learn how to:

- Understand what Ultaura does and who it's for
- Create your account and start your free trial
- Set up your first phone line and make a test call
```

### 001-getting-started/001-what-is-ultaura.mdx (Complete)

```mdx
---
title: "What Is Ultaura?"
label: "What Is Ultaura"
description: "An overview of Ultaura's AI voice companion service"
---

Ultaura is an AI-powered voice companion that makes friendly phone calls to seniors. We help families stay connected to their loved ones through regular check-in calls, reminders, and wellness monitoring.

## How Ultaura Works

You set up a schedule, and Ultaura calls your loved one at those times. During the call, our AI companion has a natural conversation, asks how they're doing, and can deliver reminders you've set up. After the call, you receive insights about how they're feeling and what they talked about.

## Who Ultaura Is For

Ultaura is designed for:

- **Seniors who live alone** and would benefit from regular friendly conversation
- **Family caregivers** who want peace of mind between visits
- **Long-distance families** who can't check in as often as they'd like
- **Anyone caring for an elderly loved one** who appreciates their independence

## Key Features

- **Scheduled check-in calls** at times that work for your loved one
- **Natural voice conversations** that feel like talking to a friend
- **Reminders** for medications, appointments, and daily tasks
- **Mood tracking** to help you understand how they're doing over time
- **Safety monitoring** that alerts you if something seems wrong
- **Weekly email summaries** so you stay informed

## Works on Any Phone

Ultaura works with landlines, cell phones, and everything in between. Your loved one doesn't need:

- A smartphone
- Internet access
- Any apps or downloads
- Technical knowledge

If they can answer a phone call, Ultaura can reach them.

## What Ultaura Is NOT

We want to be clear about what Ultaura can and cannot do:

- **Ultaura is NOT an emergency response service.** In an emergency, always call 911.
- **Ultaura is NOT a medical device.** We don't monitor vital signs or provide medical advice.
- **Ultaura is NOT a replacement for human care.** We complement your care, not replace it.

For complete details about our service, please review our [Terms of Service](/terms) and [Privacy Policy](/privacy).

## Ready to Get Started?

Setting up Ultaura takes just a few minutes. [Create your account](/auth/sign-up) to begin your free trial, or continue to learn about the setup process.
```

### 001-getting-started/002-setting-up-account.mdx (Complete)

```mdx
---
title: "Setting Up Your Account"
label: "Account Setup"
description: "Create your Ultaura account and start your free trial"
---

Getting started with Ultaura is quick and easy. In this guide, you'll create your account and learn what to expect from your free trial.

## Creating Your Account

1. Visit the [sign-up page](/auth/sign-up)
2. Enter your email address
3. Create a password
4. Verify your email
5. You're in!

## Your Free Trial

Every new account starts with a free trial so you can experience Ultaura before committing.

**What's included:**

| Feature | Free Trial |
|---------|------------|
| Duration | 3 days |
| Call minutes | 20 minutes |
| Phone lines | 1 |
| All features | Yes |

**No credit card required.** Your trial starts immediately and gives you full access to all features.

**Hard stop, no surprises.** When your trial minutes run out, calls stop. You won't be charged anything unless you choose to upgrade.

## Choosing a Plan

After your trial, you can continue with a paid plan. Here's a quick comparison:

| Plan | Monthly | Minutes | Lines |
|------|---------|---------|-------|
| Care | $39 | 300 | 1 |
| Comfort | $99 | 900 | 2 |
| Family | $199 | 2,200 | 4 |

Save 15% with annual billing. [View full pricing details](/pricing).

## Your Dashboard

After signing in, you'll see your dashboard. This is your home base for:

- Managing phone lines for your loved ones
- Setting up call schedules
- Creating reminders
- Viewing insights and reports
- Managing your account and billing

Don't worry if it looks empty at first. In the next section, we'll add your first phone line.

## Next Step

Ready to set up your first call? Continue to [Your First Line](/docs/getting-started/your-first-line) to add your loved one's phone number and make a test call.
```

### 001-getting-started/003-your-first-line.mdx (Complete)

```mdx
---
title: "Creating Your First Line"
label: "Your First Line"
description: "Set up a phone line for your loved one and make a test call"
---

A "line" in Ultaura is a phone profile for one person. It includes their phone number, name, preferred call times, and all their personalized settings. Let's create your first one.

## What You'll Need

- Your loved one's phone number
- Their timezone
- A few minutes to verify the phone number

**Tip:** Let your loved one know you're setting this up. It helps if they're expecting the verification call or text.

## Step-by-Step Setup

### 1. Open the Lines Page

From your dashboard, click **Lines** in the navigation menu.

### 2. Add a New Line

Click the **Add Line** button.

### 3. Enter Their Information

- **Name:** How you'd like us to refer to them (e.g., "Mom" or "Margaret")
- **Phone number:** Their phone number, including area code
- **Timezone:** Their local timezone (for scheduling calls correctly)

### 4. Verify the Phone Number

For safety and consent, we need to verify your loved one's phone number.

1. Click **Send Verification Code**
2. We'll send a 6-digit code via text message
3. Enter the code in the dashboard
4. Done!

**For landlines:** Choose "Call me instead" to receive the code via voice call.

### 5. Make a Test Call

Before setting up a regular schedule, we recommend making a test call.

1. On the line page, click **Test Call**
2. Choose a test mode:
   - **Quick Test**: Just tests audio and connection - no disclosures
   - **Preview Full Experience**: Hear the complete first-call flow including disclosures
3. Ultaura will call your loved one within a minute
4. This lets you (and them) experience what Ultaura is like

**Tip:** Use "Quick Test" first to verify the connection works, then try "Preview Full Experience" to hear the complete introduction.

## What Happens During a Call

During a test call (and all Ultaura calls), the conversation includes:

- A friendly greeting
- Questions about how they're doing
- Topics they enjoy (if you've added interests)
- Any reminders you've set up
- A warm goodbye

Your loved one can hang up anytime. There's no pressure to talk for a specific length of time.

## Next Steps

Now that you have a line set up, you can:

- [Set up a call schedule](/docs/schedules-and-reminders/call-schedules) for regular check-ins
- [Add reminders](/docs/schedules-and-reminders/managing-reminders) for medications or appointments
- [Add trusted contacts](/docs/safety-and-contacts/trusted-contacts) for safety alerts
- [Customize the voice](/docs/managing-lines/voice-preferences) and other settings

## Need Help?

If you run into any issues during setup, check our [Troubleshooting](/docs/troubleshooting) section or contact us at support@ultaura.com.
```

---

## Implementation Notes

### File Ordering

The numeric prefixes (001-, 002-, etc.) control the order in the navigation. The MDX system extracts the `order` from these prefixes automatically.

### Index Pages

Index pages (`index.mdx`) should:
- Have `show_child_cards: true` in frontmatter
- Provide a brief introduction (2-3 paragraphs max)
- List what topics are covered in that section
- NOT duplicate content from child pages

### Content Pages

Content pages should:
- Start with a brief intro explaining what the page covers
- Use clear headings (##) for major sections
- Include tables where comparing options
- End with "Need Help?" pointing to support@ultaura.com
- Link to related pages where relevant

### Tone Guidelines

- Use "your loved one" (not "the senior" or "the user")
- Active voice: "Click the button" not "The button should be clicked"
- Short sentences: Aim for 15-20 words max
- No jargon: "Phone number" not "E.164 formatted telephone number"
- Reassuring on safety topics: Focus on peace of mind, not scary scenarios

### Recurring Callouts

Include these prominently where relevant:
- "Works on any phone, including landlines" - Getting Started, Managing Lines
- "Not an emergency service, not medical device, not replacement for care" - Getting Started, Safety section
- Test call guidance - Getting Started, before first scheduled call

### Internal Links

Use relative paths for internal links:
- `/docs/managing-lines/vacation-mode` - Full docs path
- `/pricing` - Marketing page
- `/auth/sign-up` - App pages

### External Links

- support@ultaura.com - Support email
- `/terms` - Terms of Service
- `/privacy` - Privacy Policy

---

## Testing and Verification

After implementation, verify:

1. **Navigation works**: All pages appear in sidebar in correct order
2. **Links work**: Internal links resolve correctly
3. **Child cards display**: Index pages show cards for child pages
4. **Frontmatter renders**: Title, description appear correctly
5. **No placeholder content**: Search for "JP3", "MakerKit", "SaaS" to ensure no old content remains
6. **Consistent terminology**: Search for variations to ensure consistency ("your loved one" not "the senior")
7. **Support email**: All pages mention support@ultaura.com where appropriate

---

## Critical Files for Reference

When implementing, reference these files for accurate data:

| Reference | File Location |
|-----------|---------------|
| Pricing, plans, voices | `src/lib/ultaura/constants.ts` |
| Type definitions | `src/lib/ultaura/types.ts` |
| MDX page rendering | `src/app/(site)/docs/[...slug]/page.tsx` |
| Navigation tree building | `src/app/(site)/docs/utils/build-documentation-tree.ts` |
| Existing docs structure | `src/content/docs/` |

---

## Summary

This specification covers the complete replacement of Ultaura's documentation:

- **35 MDX files** across 9 sections
- **Complete content outlines** for every page
- **4 fully-written sample pages** establishing tone and style
- **All pricing, plans, and feature details** accurate to the codebase
- **Clear implementation notes** for consistency

The documentation prioritizes:
- Warm, clear language for non-technical family caregivers
- Emphasis on landline support and test calls
- Balance between caregiver peace of mind and senior companionship
- Appropriate disclaimers without being alarmist
- Easy navigation and findability

---

## Revision History

### v1.2 - Additional Corrections

The following additional corrections were made:

1. **Trusted Contacts**: Updated language to "high-tier safety alerts only" - clarified that only medium/high severity events trigger notifications, not all concerns
2. **Wellness Alerts**: Updated trigger types to match actual alert types (health mentions, mood drop, cognitive concerns, missed calls)
3. **Sharing with Family**: Fixed path to "Privacy Center → Family Recipients" and added the prerequisite that "Share insights with other family members" toggle must be enabled first
4. **Adding a Line**: Added Usage Based plan to the line-limits table (4 lines)
5. **Consent Management**: Corrected consent collection wording to reflect payer acknowledgment during line setup + voice consent during calls (not phone verification)
6. **Data Export**: Removed specific processing time claim, replaced with "You'll receive an email when ready"

### v1.1 - Corrections Based on Codebase Verification

The following corrections were made after verifying against the actual UI and codebase:

1. **Line Settings**: Updated to match actual settings tabs and fields (Language, Timezone, Quiet Hours, Voicemail, Inbound Calls, Voice Controls, Vacation) - removed non-existent "Display Name" and "Pausing a Line" options
2. **Trusted Contacts**: Corrected to SMS-only alerts, removed per-severity notification toggles that don't exist in UI
3. **Weekly Summaries**: Fixed setup steps to reflect per-line configuration in Line Settings → Insights & Notifications tab
4. **Plans**: Added Usage Based (PAYG) plan with $0.15/min, 4 lines, no included minutes
5. **Usage Tracking**: Added Spending Cap feature (overage protection with $10-$100 options)
6. **Inbound Calling**: Added documentation for allowing loved ones to call Ultaura
7. **Voice Controls**: Added documentation for voice-based reminder and schedule management
8. **Test Call Modes**: Added Quick Test vs Preview Full Experience options
9. **Opt-out**: Added guidance for opting out via pressing 9 or verbal request
10. **Sharing Tiers**: Corrected tier descriptions to match actual gating (Tier 1 = safety + stats, Tier 2 = +mood, Tier 3 = +topics, Tier 4 = +concerns/relationships)
11. **Family Recipients**: Added 5 recipient limit
12. **Phone Verification**: Softened "10 minutes" expiry claim since timing may vary
13. **Voice Preferences**: Clarified that voice is selected during line creation, not in settings
14. **Vacation Mode Comparison**: Removed non-existent "Line Pause" toggle, added Snooze option
