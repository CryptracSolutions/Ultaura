/**
 * Generates a single HTML file previewing ALL Ultaura email templates.
 *
 * Run:   npx tsx scripts/preview-all-emails.ts
 * Open:  email-previews.html
 */
import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
// Make React available globally for templates that use JSX without importing it.
(globalThis as any).React = React;

import renderAccountDeleteEmail from '../src/lib/emails/account-delete';
import { renderChangelogEmail } from '../src/lib/emails/changelog';
import renderInviteEmail from '../src/lib/emails/invite';
import renderMissedCallsAlertEmail from '../src/lib/emails/missed-calls-alert';
import renderNewsletterBroadcastEmail from '../src/lib/emails/newsletter-broadcast';
import renderNewsletterWelcomeEmail from '../src/lib/emails/newsletter-welcome';
import renderNotificationInviteEmail from '../src/lib/emails/notification-invite';
import renderPlanUpgradeEmail from '../src/lib/emails/plan-upgrade';
import renderSafetyAlertEmail from '../src/lib/emails/safety-alert';
import renderSecurityAlertEmail from '../src/lib/emails/security-alert';
import renderWeeklySummaryEmail from '../src/lib/emails/weekly-summary';
import renderWellnessAlertEmail from '../src/lib/emails/wellness-alert';

// ---------------------------------------------------------------------------
// Logo base64 (so it renders in local HTML files)
// ---------------------------------------------------------------------------
const logoPath = path.resolve(__dirname, '..', 'public', 'logos', 'logo-email.png');
const logoBase64 = fs.readFileSync(logoPath).toString('base64');
const logoDataUri = `data:image/png;base64,${logoBase64}`;

function embedLogo(html: string): string {
  return html.replace(
    /src="[^"]*\/logos\/logo-email\.png"/g,
    `src="${logoDataUri}"`,
  );
}

// ---------------------------------------------------------------------------
// Render every React Email template with realistic sample data
// ---------------------------------------------------------------------------
interface EmailPreview {
  name: string;
  description: string;
  html: string;
}

const previews: EmailPreview[] = [];

// 1. Changelog / What's New
previews.push({
  name: 'Changelog (What\'s New)',
  description: 'Sent to all active users when new product updates are published.',
  html: embedLogo(renderChangelogEmail({
    entries: [
      { title: 'Recurring Reminders', description: 'Set up daily, weekly, or custom reminders for your loved one — medication, appointments, birthdays, and more.', category: 'new_feature' },
      { title: 'Improved Mood Insights', description: 'The Insights dashboard now shows 30-day emotional trends with clearer charts and actionable summaries.', category: 'improvement' },
      { title: 'Call Scheduling Reliability', description: 'Fixed an issue where calls scheduled during quiet hours could occasionally still ring through.', category: 'fix' },
      { title: 'Family Plan Now Available', description: 'Our new Family plan supports up to 4 lines with 1,200 shared minutes per month.', category: 'announcement' },
    ],
    recipientName: 'Sarah',
    dashboardUrl: 'https://ultaura.com/dashboard',
    previewText: "Here's what's new at Ultaura this month",
    baseUrl: 'https://ultaura.com',
  }).html),
});

// 2. Weekly Summary (full tier — self recipient)
previews.push({
  name: 'Weekly Summary',
  description: 'Sent weekly to payers and notification recipients with a check-in digest.',
  html: embedLogo(renderWeeklySummaryEmail({
    lineId: 'line-001',
    lineName: 'Mom (Dorothy)',
    accountId: 'acct-001',
    billingEmail: 'sarah@example.com',
    weekStartDate: 'Feb 17',
    weekEndDate: 'Feb 23',
    timezone: 'America/New_York',
    sharingTier: 'tier_4',
    isSelfRecipient: true,
    isPrimaryRecipient: true,
    safetyEvents: [
      { severity: 'high', timestamp: '2026-02-19T14:30:00Z', actionTaken: 'Suggested 988 hotline' },
    ],
    usageSummary: { minutesUsed: 145, minutesRemaining: 55, overageMinutes: 0, overageCost: 0 },
    scheduledCalls: 14,
    answeredCalls: 12,
    missedCalls: 2,
    showMissedCallsWarning: true,
    answerTrend: 'down',
    answerTrendValue: -2,
    avgDurationMinutes: 8,
    durationTrend: 'up',
    durationTrendValue: 2,
    engagementNote: 'shorter responses, less elaboration',
    moodSummary: 'Mostly positive this week, with a few lower moments mid-week.',
    moodShiftNote: 'Mood dipped on Wednesday — mentioned feeling lonely.',
    moodDistribution: { positive: 8, neutral: 3, low: 1 },
    socialNeedNote: 'Dorothy mentioned missing her book club friends twice this week.',
    topTopics: [
      { code: 'family', label: 'Family', weight: 0.35 },
      { code: 'health', label: 'Health', weight: 0.25 },
      { code: 'gardening', label: 'Gardening', weight: 0.2 },
      { code: 'cooking', label: 'Cooking', weight: 0.15 },
    ],
    concerns: [
      { code: 'loneliness', label: 'Loneliness', severity: 'moderate', novelty: 'recurring' },
      { code: 'sleep', label: 'Sleep Quality', severity: 'mild', novelty: 'new' },
    ],
    needsFollowUp: true,
    followUpReasons: ['recurring loneliness', 'new sleep concerns'],
    isPaused: false,
    pausedNote: null,
    dashboardUrl: 'https://ultaura.com/dashboard',
    settingsUrl: 'https://ultaura.com/dashboard/settings',
  }).html),
});

// 3. Wellness Alert
previews.push({
  name: 'Wellness Alert',
  description: 'Sent when a wellness concern is detected during calls.',
  html: embedLogo(renderWellnessAlertEmail({
    lineName: 'Mom (Dorothy)',
    title: 'Mood Decline Detected',
    summary: 'Dorothy has expressed low mood in 3 of the last 5 calls, mentioning feeling tired and not wanting to go outside. This is a change from her typical positive outlook.',
    severity: 'warning',
    dashboardUrl: 'https://ultaura.com/dashboard/alerts',
    settingsUrl: 'https://ultaura.com/dashboard/settings',
    unsubscribeLink: 'https://ultaura.com/unsubscribe/abc123',
  }).html),
});

// 4. Safety Alert
previews.push({
  name: 'Safety Alert',
  description: 'Urgent alert sent when distress keywords are detected during a call.',
  html: embedLogo(renderSafetyAlertEmail({
    lineName: 'Mom (Dorothy)',
    actionTaken: 'Ultaura gently suggested the 988 Suicide & Crisis Lifeline and provided the number during the call.',
    severity: 'high',
    dashboardUrl: 'https://ultaura.com/dashboard/safety',
  }).html),
});

// 5. Missed Calls Alert
previews.push({
  name: 'Missed Calls Alert',
  description: 'Sent when a line misses multiple consecutive scheduled calls.',
  html: embedLogo(renderMissedCallsAlertEmail({
    lineName: 'Mom (Dorothy)',
    consecutiveMissedCount: 4,
    dashboardUrl: 'https://ultaura.com/dashboard',
    settingsUrl: 'https://ultaura.com/dashboard/lines/line-001/settings',
    unsubscribeLink: 'https://ultaura.com/unsubscribe/abc123',
  }).html),
});

// 6. Plan Upgrade
previews.push({
  name: 'Plan Upgrade',
  description: 'Sent when a user requests a plan upgrade during a phone call.',
  html: embedLogo(renderPlanUpgradeEmail({
    planName: 'Family',
    planSummary: '4 lines, 1,200 minutes/month, priority support — $99/month.',
    checkoutUrl: 'https://ultaura.com/checkout/family',
  }).html),
});

// 7. Notification Invite
previews.push({
  name: 'Notification Invite',
  description: 'Sent to trusted contacts inviting them to receive updates about a line.',
  html: embedLogo(renderNotificationInviteEmail({
    recipientName: 'Michael',
    accountName: "Sarah's Family",
    lineName: 'Mom (Dorothy)',
    inviterName: 'Sarah',
    confirmLink: 'https://ultaura.com/confirm/notif-abc123',
  }).html),
});

// 8. Team Invite
previews.push({
  name: 'Team Invite',
  description: 'Sent when a user is invited to join an organization/team.',
  html: embedLogo(renderInviteEmail({
    organizationName: "Sarah's Family",
    inviter: 'Sarah Johnson',
    invitedUserEmail: 'michael@example.com',
    link: 'https://ultaura.com/invite/team-abc123',
    productName: 'Ultaura',
  }).html),
});

// 9. Account Deletion
previews.push({
  name: 'Account Deletion',
  description: 'Confirmation sent after an account is deleted.',
  html: embedLogo(renderAccountDeleteEmail({
    productName: 'Ultaura',
    userDisplayName: 'Sarah',
  }).html),
});

// 10. Security Alert (Internal)
previews.push({
  name: 'Security Alert (Internal)',
  description: 'Internal admin alert for anomaly detection and suspicious activity.',
  html: embedLogo(renderSecurityAlertEmail({
    anomalyType: 'rate_limit_exceeded',
    source: '192.168.1.42',
    sourceType: 'ip_address',
    timestamp: '2026-02-23T21:15:00Z',
    detailsJson: JSON.stringify({ endpoint: '/api/verify-phone', count: 47, window: '1h', threshold: 10 }, null, 2),
    recommendedAction: 'Review the source IP and consider temporary blocking if pattern continues.',
  }).html),
});

// 11. Newsletter Welcome
previews.push({
  name: 'Newsletter Welcome',
  description: 'Sent after a visitor subscribes to the Ultaura newsletter.',
  html: embedLogo(renderNewsletterWelcomeEmail({
    firstName: 'Sarah',
    subscribedTopics: ['blog_digest', 'product_updates'],
    unsubscribeUrl: 'https://ultaura.com/newsletter/unsubscribe/abc123',
    baseUrl: 'https://ultaura.com',
  }).html),
});

// 12. Newsletter Broadcast
previews.push({
  name: 'Newsletter Broadcast',
  description: 'General-purpose newsletter sent to subscribers.',
  html: embedLogo(renderNewsletterBroadcastEmail({
    firstName: 'Sarah',
    subject: '5 Ways to Stay Connected with Aging Parents',
    topicLabel: 'Elder Care Tips',
    paragraphs: [
      'Staying connected with aging parents can be challenging, especially when distance is a factor. Here are five practical strategies that families are using to bridge the gap.',
      'From scheduled video calls to AI-powered companions, technology is making it easier than ever to ensure your loved ones feel cared for every single day.',
    ],
    bulletItems: [
      { label: 'Schedule regular call times', href: 'https://ultaura.com/blog/call-scheduling' },
      { label: 'Use a shared family calendar' },
      { label: 'Try an AI companion for daily check-ins', href: 'https://ultaura.com' },
      'Send voice messages between calls',
      'Celebrate small milestones together',
    ],
    cta: { label: 'Read the Full Article', href: 'https://ultaura.com/blog/stay-connected', variant: 'button' },
    unsubscribeUrl: 'https://ultaura.com/newsletter/unsubscribe/abc123',
    baseUrl: 'https://ultaura.com',
  }).html),
});

// ---------------------------------------------------------------------------
// Supabase Auth templates (raw HTML with Go template vars replaced)
// ---------------------------------------------------------------------------
const supabaseTemplateDir = path.resolve(__dirname, '..', 'supabase', 'templates');
const supabaseTemplates: Array<{ name: string; description: string; file: string }> = [
  { name: 'Auth: Email Confirmation', description: 'Sent when a new user signs up to verify their email.', file: 'confirmation.html' },
  { name: 'Auth: Invite', description: 'Sent when a user is invited via Supabase auth.', file: 'invite.html' },
  { name: 'Auth: Magic Link', description: 'Passwordless sign-in link (expires in 10 minutes).', file: 'magic-link.html' },
  { name: 'Auth: Email Change', description: 'Sent when a user changes their email address.', file: 'email-change.html' },
  { name: 'Auth: Password Recovery', description: 'Sent when a user requests a password reset.', file: 'recovery.html' },
];

for (const tpl of supabaseTemplates) {
  const filePath = path.join(supabaseTemplateDir, tpl.file);
  let html = fs.readFileSync(filePath, 'utf-8');
  html = html.replace(/\{\{\s*\.SiteURL\s*\}\}/g, 'https://ultaura.com');
  html = html.replace(/\{\{\s*\.ConfirmationURL\s*\}\}/g, 'https://ultaura.com/auth/confirm?token=sample');
  html = html.replace(/\{\{\s*\.Token\s*\}\}/g, '123456');
  html = embedLogo(html);
  previews.push({ name: tpl.name, description: tpl.description, html });
}

// ---------------------------------------------------------------------------
// Build the combined HTML page
// ---------------------------------------------------------------------------
const navItems = previews
  .map((p, i) => `<a href="#email-${i}" style="display:block;padding:8px 16px;color:#44403C;text-decoration:none;font-size:14px;border-radius:6px;transition:background .15s;" onmouseover="this.style.background='#F5F5F4'" onmouseout="this.style.background='transparent'">${i + 1}. ${p.name}</a>`)
  .join('\n');

const emailSections = previews
  .map((p, i) => `
    <div id="email-${i}" style="scroll-margin-top:20px;margin-bottom:60px;">
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:4px;">
        <h2 style="font-size:20px;font-weight:600;color:#1C1917;margin:0;">${p.name}</h2>
        <span style="font-size:13px;color:#78716C;">#${i + 1} of ${previews.length}</span>
      </div>
      <p style="font-size:14px;color:#78716C;margin:4px 0 16px 0;">${p.description}</p>
      <div style="border:1px solid #E7E5E4;border-radius:8px;overflow:hidden;background:#fff;">
        <iframe srcdoc="${p.html.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}" style="width:100%;height:800px;border:none;" sandbox="allow-same-origin"></iframe>
      </div>
    </div>`)
  .join('\n');

const combinedHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ultaura Email Previews</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Manrope, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #FAFAF9; color: #1C1917; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { position: sticky; top: 0; height: 100vh; width: 280px; flex-shrink: 0; background: #fff; border-right: 1px solid #E7E5E4; padding: 24px 12px; overflow-y: auto; }
    .sidebar h1 { font-size: 16px; font-weight: 700; color: #0ABAB5; padding: 0 16px; margin-bottom: 4px; }
    .sidebar .subtitle { font-size: 12px; color: #78716C; padding: 0 16px; margin-bottom: 16px; }
    .main { flex: 1; padding: 32px 40px; max-width: 960px; }
    @media (max-width: 800px) { .sidebar { display: none; } .main { padding: 16px; } }
  </style>
</head>
<body>
  <div class="layout">
    <nav class="sidebar">
      <h1>Ultaura Emails</h1>
      <p class="subtitle">${previews.length} templates</p>
      ${navItems}
    </nav>
    <main class="main">
      <h1 style="font-size:28px;font-weight:700;color:#1C1917;margin-bottom:4px;">Email Template Previews</h1>
      <p style="font-size:14px;color:#78716C;margin-bottom:32px;">All ${previews.length} Ultaura email templates rendered with sample data.</p>
      ${emailSections}
    </main>
  </div>
</body>
</html>`;

const outPath = path.resolve(__dirname, '..', 'email-previews.html');
fs.writeFileSync(outPath, combinedHtml, 'utf-8');
console.log(`Preview written to ${outPath} (${previews.length} emails)`);
