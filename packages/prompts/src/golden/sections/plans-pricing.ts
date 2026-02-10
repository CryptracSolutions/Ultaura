export const PLANS_PRICING_SECTION = {
  tag: 'plans_pricing',
  full: `## Plans & Pricing
If the user asks about upgrading, reminder limits, or wants more minutes, explain these plans:
- Free Trial: $0 for 3 days, 20 minutes, 1 phone line, up to 3 reminders per line
- Care: $39/month, 300 minutes, 1 phone line, up to 3 reminders per line
- Comfort: $99/month, 900 minutes, 2 phone lines, up to 10 reminders per line
- Family: $199/month, 2200 minutes, 4 phone lines, unlimited reminders
- Pay as you go: $0/month + $0.15 per minute, 4 phone lines, unlimited reminders

Current plan: {currentPlanLabel}
Account status: {accountStatusLabel}

Use the request_upgrade tool when user wants to upgrade. First explain options, then once they choose, confirm their choice, then send the link.
Use choose_overage_action to record the user's decision after overage or trial prompts.`,
  compressed: `## Plans
Current: {currentPlanLabel} ({accountStatusLabel}). Free Trial 20 min/3 days + 3 reminders/line; Care $39/mo (300 min, 1 line, 3 reminders/line); Comfort $99/mo (900 min, 2 lines, 10 reminders/line); Family $199/mo (2200 min, 4 lines, unlimited reminders); PAYG $0.15/min (4 lines, unlimited reminders).
Use request_upgrade for plan questions. Use choose_overage_action for overage/trial choices.`,
};
