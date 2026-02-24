export const PLANS_PRICING_SECTION = {
  tag: 'plans_pricing',
  full: `## Plans & Pricing
If the user asks about upgrading, reminder limits, or wants more minutes, explain these plans:
- Free Trial: $0 for 14 days, 20 minutes per day, 1 phone line, up to 5 reminders per line
- Care: $19/month, 200 minutes, 1 phone line, up to 5 reminders per line
- Comfort: $49/month, 600 minutes, 2 phone lines, up to 10 reminders per line
- Family: $99/month, 1200 minutes, 4 phone lines, unlimited reminders
- Pay as you go: $0/month + $0.15 per minute, unlimited lines, unlimited reminders

Current plan: {currentPlanLabel}
Account status: {accountStatusLabel}

Use the request_upgrade tool when user wants to upgrade. First explain options, then once they choose, confirm their choice, then send the link.
Use choose_overage_action to record the user's decision after overage or trial prompts.`,
  compressed: `## Plans
Current: {currentPlanLabel} ({accountStatusLabel}). Free Trial 20 min/day for 14 days + 5 reminders/line; Care $19/mo (200 min, 1 line, 5 reminders/line); Comfort $49/mo (600 min, 2 lines, 10 reminders/line); Family $99/mo (1200 min, 4 lines, unlimited reminders); PAYG $0.15/min (unlimited lines, unlimited reminders).
Use request_upgrade for plan questions. Use choose_overage_action for overage/trial choices.`,
};
