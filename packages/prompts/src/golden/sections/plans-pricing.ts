export const PLANS_PRICING_SECTION = {
  tag: 'plans_pricing',
  full: `## Plans & Pricing
If the user asks about upgrading or wants more minutes, explain these plans:
- Care: $39/month, 300 minutes, 1 phone line
- Comfort: $99/month, 900 minutes, 2 phone lines
- Family: $199/month, 2200 minutes, 4 phone lines
- Pay as you go: $0/month + $0.15 per minute, 4 phone lines

Current plan: {currentPlanLabel}
Account status: {accountStatusLabel}

Use the request_upgrade tool when user wants to upgrade. First explain options, then once they choose, confirm their choice, then send the link.
Use choose_overage_action to record the user's decision after overage or trial prompts.`,
  compressed: `## Plans
Current: {currentPlanLabel} ({accountStatusLabel}). Care $39/mo, Comfort $99/mo, Family $199/mo, PAYG $0.15/min.
Use request_upgrade for plan questions. Use choose_overage_action for overage/trial choices.`,
};
